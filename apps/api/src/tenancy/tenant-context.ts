import {
  Injectable,
  InternalServerErrorException,
  Scope,
} from '@nestjs/common';

export interface TenantContextSnapshot {
  readonly userId: string;
  readonly subject: string;
  readonly tenantId: string;
}

@Injectable({ scope: Scope.REQUEST })
export class TenantContext {
  private snapshot?: TenantContextSnapshot;

  establish(next: TenantContextSnapshot): void {
    if (!this.snapshot) {
      this.snapshot = Object.freeze({ ...next });
      return;
    }

    if (
      this.snapshot.userId === next.userId &&
      this.snapshot.subject === next.subject &&
      this.snapshot.tenantId === next.tenantId
    ) {
      return;
    }

    throw new InternalServerErrorException(
      'Tenant context cannot be replaced during the same request',
    );
  }

  require(): TenantContextSnapshot {
    if (!this.snapshot) {
      throw new InternalServerErrorException(
        'Tenant context has not been established for this request',
      );
    }

    return this.snapshot;
  }
}
