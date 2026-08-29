import { Injectable, ServiceUnavailableException } from '@nestjs/common';

export interface OidcRuntimeConfig {
  readonly providerKey: string;
  readonly issuer: string;
  readonly audience: string[];
  readonly jwksUrl: URL;
  readonly algorithms: string[];
}

const PROVIDER_KEY_PATTERN = /^[a-z0-9][a-z0-9._-]{0,79}$/i;

@Injectable()
export class OidcConfigService {
  require(): OidcRuntimeConfig {
    const providerKey = this.required('OIDC_PROVIDER_KEY');
    if (!PROVIDER_KEY_PATTERN.test(providerKey)) {
      throw new ServiceUnavailableException(
        'OIDC_PROVIDER_KEY must be 1-80 characters using letters, digits, dot, underscore or hyphen',
      );
    }

    const issuer = this.requiredHttpsUrl('OIDC_ISSUER_URL').toString().replace(/\/$/, '');
    const jwksUrl = this.requiredHttpsUrl('OIDC_JWKS_URL');
    const audience = this.list('OIDC_AUDIENCE');
    const algorithms = this.list('OIDC_ALLOWED_ALGORITHMS', [
      'RS256',
      'PS256',
      'ES256',
    ]);

    return {
      providerKey,
      issuer,
      audience,
      jwksUrl,
      algorithms,
    };
  }

  private required(name: string): string {
    const value = process.env[name]?.trim();
    if (!value) {
      throw new ServiceUnavailableException(`${name} is not configured`);
    }
    return value;
  }

  private requiredHttpsUrl(name: string): URL {
    const value = this.required(name);
    let parsed: URL;
    try {
      parsed = new URL(value);
    } catch {
      throw new ServiceUnavailableException(`${name} must be a valid URL`);
    }

    if (parsed.protocol !== 'https:') {
      throw new ServiceUnavailableException(`${name} must use HTTPS`);
    }

    return parsed;
  }

  private list(name: string, fallback?: string[]): string[] {
    const raw = process.env[name]?.trim();
    const values = raw
      ? raw.split(',').map((value) => value.trim()).filter(Boolean)
      : fallback;

    if (!values || values.length === 0) {
      throw new ServiceUnavailableException(`${name} is not configured`);
    }

    return [...new Set(values)];
  }
}
