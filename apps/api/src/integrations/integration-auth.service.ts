import { createHash, randomBytes } from 'node:crypto';

import { Injectable, UnauthorizedException } from '@nestjs/common';

import {
  TenantDatabaseService,
  type IntegrationAuthenticationRecord,
} from '../tenancy/tenant-database.service.js';

const TOKEN_PATTERN =
  /^nxint_([0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})\.([A-Za-z0-9_-]{32,128})$/i;

export interface GeneratedIntegrationCredential {
  readonly apiKey: string;
  readonly secretHashHex: string;
}

@Injectable()
export class IntegrationAuthService {
  constructor(private readonly database: TenantDatabaseService) {}

  async authenticate(authorization: string | undefined): Promise<IntegrationAuthenticationRecord> {
    const parsed = parseIntegrationAuthorization(authorization);
    const authenticated = await this.database.authenticateIntegrationClient(
      parsed.clientId,
      hashIntegrationSecret(parsed.secret),
    );
    if (!authenticated) {
      throw new UnauthorizedException('Invalid integration credential');
    }
    return authenticated;
  }
}

export function generateIntegrationCredential(clientId: string): GeneratedIntegrationCredential {
  const secret = randomBytes(32).toString('base64url');
  return {
    apiKey: `nxint_${clientId}.${secret}`,
    secretHashHex: hashIntegrationSecret(secret),
  };
}

export function hashIntegrationSecret(secret: string): string {
  return createHash('sha256').update(secret, 'utf8').digest('hex');
}

export function parseIntegrationAuthorization(authorization: string | undefined): {
  readonly clientId: string;
  readonly secret: string;
} {
  if (!authorization) {
    throw new UnauthorizedException('Integration bearer credential is required');
  }
  const [scheme, token, extra] = authorization.trim().split(/\s+/);
  if (scheme?.toLowerCase() !== 'bearer' || !token || extra) {
    throw new UnauthorizedException('Invalid integration credential');
  }
  const match = TOKEN_PATTERN.exec(token);
  if (!match?.[1] || !match[2]) {
    throw new UnauthorizedException('Invalid integration credential');
  }
  return { clientId: match[1].toLowerCase(), secret: match[2] };
}
