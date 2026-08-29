import { Injectable, UnauthorizedException } from '@nestjs/common';
import {
  createRemoteJWKSet,
  jwtVerify,
  type JWTVerifyGetKey,
  type KeyLike,
} from 'jose';

import { OidcConfigService, type OidcRuntimeConfig } from './oidc-config.service.js';

export interface VerifiedOidcIdentity {
  readonly providerKey: string;
  readonly subject: string;
}

export async function verifyOidcJwt(
  token: string,
  key: JWTVerifyGetKey | KeyLike | Uint8Array,
  config: Pick<OidcRuntimeConfig, 'issuer' | 'audience' | 'algorithms'>,
): Promise<string> {
  const { payload } = await jwtVerify(token, key, {
    algorithms: config.algorithms,
    audience: config.audience,
    issuer: config.issuer,
  });

  const subject = payload.sub?.trim();
  if (!subject) {
    throw new Error('OIDC token does not contain a subject');
  }

  return subject;
}

@Injectable()
export class OidcTokenVerifierService {
  private jwks?: JWTVerifyGetKey;
  private jwksUrl?: string;

  constructor(private readonly configService: OidcConfigService) {}

  async verify(token: string): Promise<VerifiedOidcIdentity> {
    const config = this.configService.require();

    try {
      const subject = await verifyOidcJwt(
        token,
        this.getRemoteJwks(config),
        config,
      );
      return {
        providerKey: config.providerKey,
        subject,
      };
    } catch {
      throw new UnauthorizedException('Bearer token is invalid or expired');
    }
  }

  private getRemoteJwks(config: OidcRuntimeConfig): JWTVerifyGetKey {
    const nextUrl = config.jwksUrl.toString();
    if (!this.jwks || this.jwksUrl !== nextUrl) {
      this.jwks = createRemoteJWKSet(config.jwksUrl);
      this.jwksUrl = nextUrl;
    }
    return this.jwks;
  }
}
