import { headers } from 'next/headers';

import { auth0 } from './auth0';

export type ApiResult<T> =
  | { readonly kind: 'ready'; readonly data: T }
  | { readonly kind: 'unconfigured'; readonly message: string }
  | { readonly kind: 'unauthorized'; readonly message: string }
  | { readonly kind: 'error'; readonly message: string };

export async function apiGet<T>(
  path: string,
  query?: Readonly<Record<string, string | undefined>>,
): Promise<ApiResult<T>> {
  return apiRequest<T>(path, { method: 'GET' }, query);
}

export async function apiSend<T>(
  path: string,
  method: 'POST' | 'PATCH' | 'PUT',
  body: Readonly<Record<string, unknown>>,
): Promise<ApiResult<T>> {
  return apiRequest<T>(path, {
    method,
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  });
}

async function apiRequest<T>(
  path: string,
  init: RequestInit,
  query?: Readonly<Record<string, string | undefined>>,
): Promise<ApiResult<T>> {
  if (!path.startsWith('/') || path.startsWith('//')) {
    return { kind: 'error', message: 'O caminho solicitado para a API é inválido.' };
  }

  const apiBaseUrlValue = process.env.NEXORA_API_BASE_URL?.trim();
  if (!apiBaseUrlValue) {
    return {
      kind: 'unconfigured',
      message: 'A integração Web/API ainda não foi configurada para este ambiente.',
    };
  }

  let apiBaseUrl: URL;
  try {
    apiBaseUrl = new URL(apiBaseUrlValue);
  } catch {
    return {
      kind: 'unconfigured',
      message: 'A URL da API configurada para este ambiente é inválida.',
    };
  }

  let accessToken: string;
  try {
    const session = await auth0.getSession();
    if (!session) {
      return {
        kind: 'unauthorized',
        message: 'A sessão Web não está autenticada. Entre novamente no Nexora.',
      };
    }

    const token = await auth0.getAccessToken();
    accessToken = token.token;
  } catch {
    return {
      kind: 'unauthorized',
      message: 'A sessão Web expirou ou não pôde obter autorização para a API.',
    };
  }

  const incomingHeaders = await headers();
  const outgoingHeaders = new Headers(init.headers);
  outgoingHeaders.set('Accept', 'application/json');
  outgoingHeaders.set('Authorization', `Bearer ${accessToken}`);
  const correlationId = incomingHeaders.get('x-correlation-id');
  if (correlationId) outgoingHeaders.set('x-correlation-id', correlationId);

  const baseUrl = apiBaseUrl.toString();
  const url = new URL(path, baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`);
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined && value !== '') url.searchParams.set(key, value);
  }

  try {
    const response = await fetch(url, {
      ...init,
      headers: outgoingHeaders,
      cache: 'no-store',
    });

    if (response.status === 401 || response.status === 403) {
      return {
        kind: 'unauthorized',
        message: 'A sessão existe, mas a API recusou a identidade ou a autorização atual.',
      };
    }

    if (!response.ok) {
      return {
        kind: 'error',
        message: await safeApiErrorMessage(response),
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

async function safeApiErrorMessage(response: Response): Promise<string> {
  try {
    const payload = (await response.json()) as { message?: unknown };
    if (typeof payload.message === 'string' && payload.message.trim()) {
      return payload.message.trim().slice(0, 300);
    }
    if (Array.isArray(payload.message)) {
      const messages = payload.message.filter((item): item is string => typeof item === 'string');
      if (messages.length > 0) return messages.join(' • ').slice(0, 300);
    }
  } catch {
    // Fall back to a stable HTTP-only message below.
  }
  return `A API respondeu com HTTP ${response.status}.`;
}
