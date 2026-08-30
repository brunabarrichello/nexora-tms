import { headers } from 'next/headers';

export type ApiResult<T> =
  | { readonly kind: 'ready'; readonly data: T }
  | { readonly kind: 'unconfigured'; readonly message: string }
  | { readonly kind: 'unauthorized'; readonly message: string }
  | { readonly kind: 'error'; readonly message: string };

export async function apiGet<T>(
  path: string,
  query?: Readonly<Record<string, string | undefined>>,
): Promise<ApiResult<T>> {
  const baseUrl = process.env.NEXORA_API_BASE_URL?.trim();
  if (!baseUrl) {
    return {
      kind: 'unconfigured',
      message: 'NEXORA_API_BASE_URL ainda não foi configurada para este ambiente web.',
    };
  }

  const incomingHeaders = await headers();
  const outgoingHeaders = new Headers({ Accept: 'application/json' });
  for (const headerName of ['authorization', 'x-correlation-id']) {
    const value = incomingHeaders.get(headerName);
    if (value) outgoingHeaders.set(headerName, value);
  }

  const url = new URL(path, baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`);
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined && value !== '') url.searchParams.set(key, value);
  }

  try {
    const response = await fetch(url, {
      headers: outgoingHeaders,
      cache: 'no-store',
    });

    if (response.status === 401 || response.status === 403) {
      return {
        kind: 'unauthorized',
        message: 'A API está configurada, mas a sessão atual ainda não possui autorização válida.',
      };
    }

    if (!response.ok) {
      return {
        kind: 'error',
        message: `A API respondeu com HTTP ${response.status}.`,
      };
    }

    return { kind: 'ready', data: (await response.json()) as T };
  } catch {
    return {
      kind: 'error',
      message: 'Não foi possível alcançar a API do Nexora neste momento.',
    };
  }
}
