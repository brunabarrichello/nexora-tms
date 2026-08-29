export interface AuthenticatedPrincipal {
  readonly userId: string;
  readonly subject: string;
}

export interface AuthenticatedHttpRequest {
  readonly headers: Record<string, string | string[] | undefined>;
  authenticatedPrincipal?: AuthenticatedPrincipal;
}
