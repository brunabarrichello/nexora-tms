import { Controller, Get, Req, UnauthorizedException, UseGuards } from '@nestjs/common';

import type { AuthenticatedHttpRequest } from './authenticated-principal.js';
import { OidcAuthenticationGuard } from './oidc-authentication.guard.js';

@Controller('api/v1/auth')
@UseGuards(OidcAuthenticationGuard)
export class AuthController {
  @Get('me')
  getAuthenticatedUser(@Req() request: AuthenticatedHttpRequest): {
    authenticated: true;
    userId: string;
  } {
    const principal = request.authenticatedPrincipal;
    if (!principal) {
      throw new UnauthorizedException('Authenticated principal is unavailable');
    }

    return {
      authenticated: true,
      userId: principal.userId,
    };
  }
}
