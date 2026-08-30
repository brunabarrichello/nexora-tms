# Wave 0020 — Matching persistente e explicável

## Objetivo

Persistir e explicar cada execução do motor de compatibilidade sem substituir as raízes canônicas existentes nem duplicar o bounded context de negociação.

## Baseline de entrada

- Wave 0019 concluída e promovida em `development` e `staging`;
- 96 tabelas de aplicação;
- 88 tabelas tenant-scoped com RLS;
- 20 migrations Drizzle;
- `transport_requests`, `drivers`, `capacity_assets` e `capacity_assignments` permanecem as referências operacionais canônicas.

## Migration

- migration: `0020_dapper_zuras`;
- tipo: aditiva;
- não contém `DROP`, `TRUNCATE` ou renomeação destrutiva;
- journal esperado após a Wave: 21 migrations.

## Tabelas

### Configuração / lifecycle

- `matching_rules` — catálogo tenant-scoped de regras, versão, categoria, blocker, peso e configuração;
- `matching_preferences` — perfis de execução, score mínimo, limite de candidatos e preferência padrão;
- `matching_runs` — execução, request, algoritmo, snapshots, estado, contagens e diagnóstico.

### Histórico append-only

- `matching_candidates` — candidato avaliado, assignment/driver/asset/carrier, status, rank, score e snapshot;
- `matching_candidate_scores` — decomposição de score por dimensão;
- `matching_rule_results` — regra, versão, resultado, impacto e valores requerido/observado;
- `matching_rejections` — código, motivo e contexto de rejeição.

## Relacionamentos canônicos

`matching_runs` referencia `transport_requests`.

`matching_candidates` referencia:

- `matching_runs`;
- `capacity_assignments`;
- `drivers`;
- `capacity_assets`;
- `business_parties` para a transportadora.

`matching_rule_results` referencia `matching_candidates` e `matching_rules`.

`matching_rejections` referencia `matching_candidates` e, quando aplicável, o `matching_rule_result` que originou a rejeição.

Todos os vínculos de domínio usam FKs tenant-aware.

## RLS e privilégios runtime

Todas as sete tabelas têm RLS baseada em `app.tenant_id`.

`nexora_app`:

| Tabelas | SELECT | INSERT | UPDATE | DELETE |
| --- | --- | --- | --- | --- |
| `matching_rules`, `matching_preferences`, `matching_runs` | sim | sim | sim | não |
| `matching_candidates`, `matching_candidate_scores`, `matching_rule_results`, `matching_rejections` | sim | sim | não | não |

A separação permite configuração/lifecycle controlado sem permitir reescrita dos fatos produzidos por uma execução.

## Algoritmo e persistência

O avaliador existente em `CapacityMatchingService` permanece a fonte canônica do cálculo de compatibilidade.

O `GET /api/v1/matching/requests/:requestId/capacity` continua somente leitura.

O `POST /api/v1/matching/requests/:requestId/runs` executa o mesmo avaliador dentro de uma transação tenant-aware e persiste:

1. snapshot dos requisitos e preferência;
2. snapshot das regras;
3. execução;
4. candidatos e snapshot operacional;
5. score por dimensão;
6. resultado de cada regra;
7. rejeições impeditivas;
8. contagens e conclusão da execução.

A versão inicial do algoritmo persistente é `capacity-v1`.

## Score inicial

Para preservar a semântica do matching existente:

- candidato sem blocker: `total_score = 100`;
- candidato com um ou mais blockers: `total_score = 0`.

O modelo físico já suporta pesos, score por dimensão, bônus, penalidades e `score_delta`. A evolução para score ponderado deverá ser aditiva e acompanhada de nova `algorithm_version`.

## API

- `GET /api/v1/matching/requests/:requestId/capacity`;
- `POST /api/v1/matching/requests/:requestId/runs`;
- `GET /api/v1/matching/requests/:requestId/runs`;
- `GET /api/v1/matching/runs/:runId`;
- `GET /api/v1/matching/runs/:runId/candidates`;
- `GET /api/v1/matching/candidates/:candidateId/explanation`;
- `GET /api/v1/matching/rules`;
- `GET /api/v1/matching/preferences`.

## Gates

### Neon Database Gate

A ledger geral passa de 20 para 21 migrations e todas as regressões anteriores permanecem obrigatórias.

### Neon Matching Gate

O gate dedicado cria uma branch Neon efêmera e executa a cadeia completa de migrations. Valida:

- sete tabelas e RLS;
- grants mutáveis versus append-only;
- FKs canônicas;
- execução persistida completa;
- candidato, score, regra e rejeição;
- tentativa de UPDATE nos fatos históricos rejeitada;
- FK cross-tenant rejeitada;
- tenant B incapaz de observar dados do tenant A;
- cleanup da branch efêmera.

### Promoção compartilhada

`neon-migrate.yml` valida as baselines 0018, 0019 e 0020 após cada promoção.

Sequência permitida:

`main verde → development → staging`

Production não é endereçável por esse workflow.

## Frontend relacionado

As rotas de Matching evoluem em PR independente para permitir integração sem acoplar deploy de páginas à migration:

- `/matching`;
- `/matching/execucoes`;
- `/matching/candidatos`;
- `/matching/explicabilidade`;
- `/matching/rejeicoes`;
- `/matching/regras`;
- `/matching/regras/nova`;
- `/matching/preferencias`;
- `/matching/propostas` permanece no bounded context de negociação existente.

## ADR

Ver `ADR-0017 — Matching persistente, reproduzível e explicável`.

## Próxima Wave

Wave 0021 — Negociação complementar, preservando `freight_proposals`, `capacity_reservations` e `transport_contracts` como raízes já existentes.