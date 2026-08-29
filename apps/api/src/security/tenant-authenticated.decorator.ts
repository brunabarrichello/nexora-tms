import { UseGuards } from '@nestjs/common';

import { TenantContextGuard } from '../tenancy/tenant-context.guard.js';
import { OidcAuthenticationGuard } from './oidc-authentication.guard.js';

export const TenantAuthenticated = () =>
  UseGuards(OidcAuthenticationGuard, TenantContextGuard);
