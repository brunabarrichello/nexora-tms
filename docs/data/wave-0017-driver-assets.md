# Wave 0017 — Motoristas e Ativos

**Status técnico:** implementação em validação de PR  
**Migration:** `0017_supreme_scalphunter.sql`  
**Baseline esperado após merge:** 84 tabelas de aplicação / 76 tabelas com RLS / 18 migrations

## Objetivo

Evoluir os roots existentes `drivers`, `capacity_assets` e `capacity_assignments` para que motorista, veículo e implemento possuam dados suficientes de qualificação, disponibilidade, bloqueios, capacidade operacional, manutenção, seguros, inspeções e histórico antes do Matching persistente e de Viagens.

A Wave não cria roots paralelos para motorista/veículo e não antecipa o núcleo documental versionado da Wave 0018.

## Modelo físico

### Motoristas

| Tabela | Papel | Lifecycle/runtime |
| --- | --- | --- |
| `driver_documents` | registro cadastral de documento, tipo, validade, status e validação | mutável; sem DELETE runtime |
| `driver_qualifications` | habilitações, endorsements, certificações e autorizações | mutável; vencimento preservado |
| `driver_courses` | cursos e certificados | mutável; vencimento preservado |
| `driver_availability` | snapshot atual de disponibilidade | 1 por tenant+driver; upsert |
| `driver_unavailability_periods` | indisponibilidades programadas/reais | histórico por período |
| `driver_emergency_contacts` | contatos de emergência | um contato principal ativo por driver |
| `driver_blocks` | bloqueios operacional/compliance/legal/safety | release explícito; sem delete |
| `driver_ratings` | avaliações dimensionais 0..5 | append-oriented: SELECT+INSERT |

### Ativos

| Tabela | Papel | Lifecycle/runtime |
| --- | --- | --- |
| `capacity_asset_capabilities` | refrigeração, lacre, carregamento lateral/traseiro, cargas perigosas, food grade, tracking, pallets e temperatura | 1 por tenant+asset; upsert |
| `capacity_asset_documents` | registro cadastral de documentos do ativo | mutável; Wave 0018 liga ao documento canônico |
| `capacity_asset_maintenance_plans` | recorrência por dias/odômetro e próxima execução | ativação/inativação |
| `capacity_asset_maintenance` | execução planejada/em andamento/concluída/cancelada | histórico operacional |
| `capacity_asset_maintenance_items` | peças/serviços/custos da manutenção | filho da manutenção |
| `capacity_asset_insurances` | apólices, vigência e cobertura | histórico; vencimento indexado |
| `capacity_asset_inspections` | inspeções, resultado, checklist e próxima inspeção | histórico operacional |
| `capacity_asset_availability` | snapshot atual de disponibilidade | 1 por tenant+asset; upsert |
| `capacity_asset_unavailability_periods` | indisponibilidades do ativo | histórico por período |
| `capacity_asset_locations` | posições observadas | append-oriented: SELECT+INSERT |
| `capacity_asset_blocks` | bloqueios operacional/compliance/legal/safety/maintenance | release explícito; sem delete |

## Normalização de catálogos

`capacity_assets` recebe:

- `vehicle_type_id uuid NULL`
- `body_type_id uuid NULL`

Ambos usam FKs tenant-aware para os catálogos da Wave 0015. Os campos legados de texto `vehicle_type` e `body_type` permanecem para compatibilidade; nenhuma remoção destrutiva ocorre na 0017.

## Integridade e multi-tenancy

- todas as 19 novas tabelas são tenant-scoped;
- todas possuem RLS baseada em `app.tenant_id`;
- referências a driver/asset usam FKs compostas `(tenant_id,id)`;
- referências de vehicle/body type em `capacity_assets` também são tenant-aware;
- datas de validade/fim não podem preceder emissão/início;
- quantidades, distâncias, odômetros e custos possuem checks de domínio;
- custos/coberturas exigem moeda quando informados;
- temperaturas mínima/máxima possuem coerência;
- latitude/longitude possuem limites geográficos;
- ratings ficam entre 0 e 5;
- `driver_ratings` e `capacity_asset_locations` são append-oriented para `nexora_app`;
- nenhuma tabela nova concede DELETE ao runtime normal.

## API

Controller: `CapacityQualificationController`  
Service: `CapacityQualificationService`  
Base: `api/v1/capacity`

### Rotas de motorista

- `GET|POST /drivers/:driverId/documents`
- `GET|POST /drivers/:driverId/qualifications`
- `GET|POST /drivers/:driverId/courses`
- `GET|PUT /drivers/:driverId/availability`
- `GET|POST /drivers/:driverId/unavailability`
- `GET|POST /drivers/:driverId/emergency-contacts`
- `GET|POST /drivers/:driverId/blocks`
- `POST /drivers/:driverId/blocks/:blockId/release`
- `GET|POST /drivers/:driverId/ratings`

### Rotas de ativos

- `GET|PUT /assets/:assetId/capabilities`
- `GET|POST /assets/:assetId/documents`
- `GET|POST /assets/:assetId/maintenance-plans`
- `GET|POST /assets/:assetId/maintenance`
- `GET|POST /assets/:assetId/maintenance/:maintenanceId/items`
- `GET|POST /assets/:assetId/insurances`
- `GET|POST /assets/:assetId/inspections`
- `GET|PUT /assets/:assetId/availability`
- `GET|POST /assets/:assetId/unavailability`
- `GET|POST /assets/:assetId/locations`
- `GET|POST /assets/:assetId/blocks`
- `POST /assets/:assetId/blocks/:blockId/release`

Todas usam o `TenantRuntimeGateGuard` e executam acesso ao PostgreSQL dentro de `TenantDatabaseService`.

## Regras adicionais de serviço

Além das constraints PostgreSQL:

- tipo documental de motorista aceita apenas scope `driver|other`;
- tipo documental de ativo aceita apenas `asset|other`;
- plano informado na manutenção deve pertencer ao mesmo ativo;
- item de manutenção só pode ser adicionado à manutenção do mesmo ativo;
- entidades relacionadas são resolvidas no tenant atual;
- conflitos/violação de FK/check são convertidos em erros HTTP controlados.

## Testes

A suíte `capacity-qualification.validation.spec.ts` cobre:

- disponibilidade e janelas temporais;
- validade documental;
- cursos e carga horária;
- períodos de indisponibilidade;
- severidade de bloqueios;
- rating 0..5;
- capabilities, pallets e temperatura;
- recorrência de manutenção;
- custo + moeda;
- seguro + vigência/moeda;
- checklist de inspeção;
- coordenadas e source de localização;
- validação UUID.

O Neon Database Gate foi estendido para validar:

- baseline 84/76/18;
- grants das 19 tabelas;
- RLS positivo/negativo da 0017;
- disponibilidade de motorista;
- capabilities do ativo;
- bloqueio de motorista;
- posição append-only;
- proibição de DELETE runtime;
- rejeição de vehicle type de outro tenant pela FK composta;
- regressões pré-existentes de reservas, contratos e isolamento.

## Boundary com Wave 0018

Os registros `driver_documents` e `capacity_asset_documents` não contêm bytes, storage key ou versionamento. A Wave 0018 criará o core `documents`/versions/validations e o vínculo canônico entre esses registros de qualificação e os arquivos versionados.

## Gate de conclusão

A Wave 0017 só pode ser marcada `CONCLUÍDA` depois de:

1. CI verde;
2. replay completo `0000 -> 0017` em Neon efêmero;
3. baseline 84/76/18 confirmado;
4. RLS/grants/negative cross-tenant tests verdes;
5. API Tenant Neon Gate verde;
6. regressões OIDC/Matching/Negociação verdes quando disparadas;
7. merge protegido no `main`;
8. CI pós-merge verde.
