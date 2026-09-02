import { Injectable, InternalServerErrorException, Scope } from '@nestjs/common';

export interface IntegrationContextSnapshot {
  readonly clientId: string;
  readonly tenantId: string;
  readonly clientName: string;
  readonly scopes: readonly string[];
}

@Injectable({ scope: Scope.REQUEST })
export class IntegrationContext {
  private snapshot?: IntegrationContextSnapshot;

  establish(next: IntegrationContextSnapshot): void {
    if (!this.snapshot) {
      this.snapshot = Object.freeze({ ...next, scopes: Object.freeze([...next.scopes]) });
      return;
    }

    if (
      this.snapshot.clientId === next.clientId &&
      this.snapshot.tenantId === next.tenantId &&
      this.snapshot.clientName === next.clientName &&
      this.snapshot.scopes.join('\0') === next.scopes.join('\0')
    ) {
      return;
    }

    throw new InternalServerErrorException(
      'Integration context cannot be replaced during the same request',
    );
  }

  require(): IntegrationContextSnapshot {
    if (!this.snapshot) {
      throw new InternalServerErrorException(
        'Integration context has not been established for this request',
      );
    }
    return this.snapshot;
  }
}
