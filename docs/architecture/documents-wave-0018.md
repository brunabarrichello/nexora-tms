# Documents — Wave 0018

## Status

Implementação da Wave 0018 do bounded context **Documents**, seguindo `module-boundaries-and-contracts-v1.md`.

## Responsabilidade do contexto

Documents é responsável pelo documento lógico reutilizável pelo TMS, seu histórico de versões, validações e vínculos tipados. Ele não substitui `driver_documents` nem `capacity_asset_documents`: esses registros continuam pertencendo ao contexto Capacity e representam o estado de compliance do motorista/ativo.

## Modelo

### `documents`

Aggregate root mutável do documento:

- `tenant_id` obrigatório e RLS;
- `document_type_id` referenciando o catálogo `document_types` do mesmo tenant;
- título, número/referência, emissor, emissão e validade;
- lifecycle `draft | active | expired | blocked | archived`;
- validação agregada `pending | validated | rejected | not_required`;
- `current_version_number` atualizado atomicamente;
- `is_blocking` para documentos cujo resultado de validação pode bloquear o aggregate;
- criação/atualização auditáveis por usuário.

### `document_versions`

Histórico imutável de versões do arquivo:

- numeração sequencial por documento;
- provider e storage key, sem credenciais ou URL assinada persistida;
- nome, MIME type, tamanho e SHA-256;
- origem `upload | integration | migration | generated`;
- metadados JSON;
- usuário e timestamp de inclusão.

O runtime `nexora_app` possui somente `SELECT, INSERT`. UPDATE e DELETE não fazem parte do contrato.

### `document_validations`

Histórico append-only de decisões:

- validação manual, automática, antifraude, compliance ou outra;
- opcionalmente ligada a uma versão específica por FK composta `(tenant_id, document_id, version_id)`;
- resultado `pending | validated | rejected | warning | not_applicable`;
- provider/regra, detalhes JSON, observações e usuário validador.

Uma nova validação atualiza o estado agregado em `documents`, mas o histórico não é reescrito.

### `document_links`

Vínculos tipados com FKs reais. A Wave 0018 suporta:

- business party;
- motorista;
- registro documental de motorista;
- ativo;
- registro documental de ativo;
- solicitação/carga (`transport_requests`);
- contrato de transporte (`transport_contracts`).

Não existe `entity_type + entity_id` sem integridade referencial. Exatamente um target é permitido por link. A desvinculação usa `unlinked_at`, `unlinked_by_user_id` e `unlink_reason`; a aplicação não executa DELETE.

Trips e Finance receberão novos targets quando seus aggregate roots oficiais existirem.

## Tipos documentais

`document_types.subject_scope` passa a aceitar também `contract`:

`party | driver | asset | request | trip | financial | contract | other`

O serviço valida a compatibilidade entre o scope do tipo documental e o target do vínculo. `other` continua sendo o scope explícito para documentos transversais.

## API REST v1

Base: `/api/v1/documents`

- `GET /` — lista com busca, status, validação, tipo, vencimento, limit/offset;
- `POST /` — cria o aggregate root;
- `GET /:documentId` — detalhe e contadores;
- `GET /:documentId/versions`;
- `POST /:documentId/versions` — acrescenta versão imutável;
- `GET /:documentId/validations`;
- `POST /:documentId/validations` — acrescenta decisão;
- `GET /:documentId/links`;
- `POST /:documentId/links` — cria vínculo tipado;
- `POST /:documentId/links/:linkId/unlink` — encerra vínculo com motivo.

Todos os endpoints usam `TenantRuntimeGateGuard`, `TenantContext` e `TenantDatabaseService`; `tenantId` e `userId` nunca são aceitos do payload do browser.

## Storage

A Wave 0018 não acopla o domínio a S3/GCS/Azure. O core persiste `storage_provider`, `storage_key`, metadados e hash do objeto já armazenado. O futuro adapter de upload/presigned URL poderá ser implementado em Integrations sem mudar o modelo documental.

## Web

Rotas funcionais:

- `/documentos`;
- `/documentos/novo`;
- `/documentos/[documentId]` com abas Versões, Validações e Vínculos;
- `/documentos/[documentId]/versoes/nova`;
- `/documentos/[documentId]/validacoes/nova`;
- `/documentos/[documentId]/vinculos/novo`;
- `/documentos/[documentId]/vinculos/[linkId]/desvincular`;
- `/documentos/validacoes`;
- `/documentos/vencimentos`.

As telas não usam dados operacionais fictícios. Estados sem API, sem autorização, vazios e erros permanecem explícitos.

## Segurança e invariantes

- RLS em todas as quatro tabelas;
- FKs compostas por tenant nos relacionamentos tenant-owned;
- versões e validações append-only por privilégio de runtime;
- links sem DELETE e com motivo obrigatório para unlink;
- SHA-256 obrigatório em versão;
- documento arquivado é imutável no serviço;
- storage credentials nunca são persistidas/expostas pelo domínio;
- tipos/targets são whitelists do servidor, não SQL controlado pelo usuário.
