import {
  BadRequestException,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';

import type { AuthenticatedHttpRequest } from '../security/authenticated-principal.js';
import { TenantContext } from './tenant-context.js';
import { isUuid } from './tenant-id.js';
import { TenantMembershipService } from './tenant-membership.service.js';

export const TENANT_SELECTION_HEADER = 'x-nexora-tenant-id';

@Injectable()
export class TenantContextGuard implements CanActivate {
  constructor(
    private readonly memberships: TenantMembershipService,
    private readonly tenantContext: TenantContext,
  ) {}

  async canActivate(executionContext: ExecutionContext): Promise<boolean> {
    const request = executionContext
      .switchToHttp()
      .getRequest<AuthenticatedHttpRequest>();

    const principal = request.authenticatedPrincipal;
    if (
      !principal ||
      !isUuid(principal.userId) ||
      principal.subject.trim().length === 0
    ) {
      throw new UnauthorizedException(
        'A trusted authenticated principal is required',
      );
    }

    const tenantId = this.readTenantSelection(request);
    if (!tenantId || !isUuid(tenantId)) {
      throw new BadRequestException(
        `${TENANT_SELECTION_HEADER} must contain a valid tenant UUID`,
      );
    }

    const activeMember = await this.memberships.isActiveMember(
      principal.userId,
      tenantId,
    );
    if (!activeMember) {
      throw new ForbiddenException(
        'The authenticated user is not an active member of the selected tenant',
      );
    }

    this.tenantContext.establish({
      subject: principal.subject,
      tenantId,
      userId: principal.userId,
    });

    return true;
  }

  private readTenantSelection(
    request: AuthenticatedHttpRequest,
  ): string | undefined {
    const header = request.headers[TENANT_SELECTION_HEADER];
    if (Array.isArray(header)) {
      return header.length === 1 ? header[0]?.trim() : undefined;
    }

    return header?.trim();
  }
}
