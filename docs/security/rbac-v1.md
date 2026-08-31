# RBAC v1 — Nexora TMS

## Objetivo

Estabelecer um catálogo canônico de permissões tenant-scoped para a API, mantendo negação por padrão e sem conceder privilégios automaticamente.

## Modelo

A autorização runtime segue a cadeia:

`membership ativo -> membership_roles -> roles -> role_permissions -> permissions`

A resolução ocorre dentro do `TenantContext`, portanto `app.user_id` e `app.tenant_id` permanecem ativos para RLS durante a consulta de autorização.

## Permissões

As chaves são estáveis e seguem `<domínio>.<ação>`:

- `iam.read`, `iam.manage`
- `tenant.read`, `tenant.manage`
- `master-data.read`, `master-data.write`
- `capacity.read`, `capacity.write`
- `documents.read`, `documents.write`
- `freight.read`, `freight.write`
- `matching.read`, `matching.write`
- `negotiation.read`, `negotiation.write`
- `trips.read`, `trips.write`
- `audit.read`

## Templates de papel

O catálogo define cinco templates para provisioning futuro:

- `tenant_admin`
- `operations_manager`
- `dispatcher`
- `auditor`
- `viewer`

Esses templates são declarativos. Esta tranche **não** persiste roles, não cria assignments de membership e não promove usuários automaticamente.

## Regras de segurança

- ausência de permissão explícita no endpoint: deny;
- chave fora do catálogo: deny;
- membership sem grant: deny;
- resolução sempre tenant-scoped;
- rotas existentes não são migradas em massa até existir provisioning controlado;
- Production continua pinada ao release aprovado até um novo gate de promoção.

## Próxima tranche

Implementar provisioning idempotente de permissões/templates por tenant em ambiente não produtivo e migrar rotas por módulo com testes positivos e negativos de RBAC antes de qualquer promoção.
