# ADR-0017 — Matching persistente, reproduzível e explicável

- Status: Accepted
- Date: 2026-08-30
- Scope: Wave 0020 — Matching

## Contexto

O Nexora TMS já possui um avaliador funcional de compatibilidade entre uma solicitação de transporte e a capacidade operacional disponível. Esse avaliador calcula, em tempo de requisição, se um candidato é compatível e devolve motivos objetivos de incompatibilidade.

O comportamento funcional é útil, porém efêmero: sem persistência da execução não existe trilha histórica suficiente para reproduzir uma decisão, comparar versões do algoritmo, decompor score, explicar uma rejeição posteriormente ou diferenciar o estado atual dos cadastros do estado observado no instante do matching.

A evolução precisa preservar os aggregate roots canônicos já aprovados: `transport_requests`, `drivers`, `capacity_assets`, `capacity_assignments`, `business_parties`, `freight_proposals`, `capacity_reservations` e `transport_contracts`.

## Decisão

### 1. O avaliador atual permanece a fonte canônica do cálculo de compatibilidade

A Wave 0020 não cria um segundo algoritmo paralelo. O serviço existente de capacity matching continua responsável por avaliar a compatibilidade operacional.

O endpoint de consulta `GET /api/v1/matching/requests/:requestId/capacity` permanece sem efeito colateral. Persistência é iniciada explicitamente por `POST /api/v1/matching/requests/:requestId/runs`.

### 2. Cada execução é uma entidade histórica reproduzível

`matching_runs` registra:

- solicitação de transporte avaliada;
- versão do algoritmo;
- preferência aplicada;
- snapshot dos parâmetros/requisitos;
- snapshot das regras consideradas;
- usuário solicitante;
- início/fim e estado da execução;
- contagens de avaliados, elegíveis e rejeitados;
- diagnóstico de falha quando aplicável.

Alterações futuras em regras, preferências ou cadastros não reescrevem o snapshot de uma execução anterior.

### 3. Candidatos e explicações são históricos append-only

A persistência é decomposta em:

- `matching_candidates`: candidato avaliado, status, rank, score e snapshot operacional;
- `matching_candidate_scores`: decomposição do score por dimensão;
- `matching_rule_results`: resultado de cada regra com versão, impacto, mensagem e valores requerido/observado;
- `matching_rejections`: motivos impeditivos contextualizados.

Essas quatro estruturas recebem `SELECT` e `INSERT` para `nexora_app`, mas não `UPDATE` nem `DELETE`.

### 4. Configuração é mutável, histórico não

`matching_rules` e `matching_preferences` são configuração tenant-scoped e permitem `SELECT`, `INSERT` e `UPDATE`, sem `DELETE` runtime.

`matching_runs` pode ser atualizado somente para transicionar seu próprio lifecycle operacional e consolidar contagens/diagnósticos; seus candidatos/resultados históricos permanecem imutáveis.

### 5. Explicabilidade é parte do contrato, não telemetria opcional

Uma recomendação ou rejeição deve permitir responder:

- qual candidato foi avaliado;
- contra qual carga/requisitos;
- qual versão do algoritmo foi usada;
- quais regras participaram;
- quais regras passaram, falharam ou não eram aplicáveis;
- qual valor era requerido e qual foi observado;
- como o score foi composto;
- por que o candidato foi rejeitado, quando aplicável.

### 6. Score inicial conservador e evolução aditiva

A primeira persistência oficial preserva a semântica do avaliador existente: compatibilidade sem blockers recebe score total 100; presença de blocker recebe score 0.

O schema já suporta pesos, dimensões, `score_delta`, bônus e penalidades para permitir evolução posterior para ranking ponderado sem alterar ou reinterpretar execuções históricas. Qualquer mudança relevante no algoritmo deve incrementar `algorithm_version`.

### 7. Não duplicar negociação

Matching termina na recomendação/seleção explicável de capacidade. Propostas, contrapropostas e aceite continuam no bounded context existente de negociação (`freight_proposals`, reservas e contratos). A Wave 0020 não cria raízes paralelas de proposta ou contratação.

### 8. Multi-tenancy e segurança

Todas as sete tabelas da Wave 0020 são tenant-scoped, têm RLS e FKs tenant-aware. Nenhuma execução pode apontar para request, assignment, driver, asset, carrier, regra ou preferência de outro tenant.

Snapshots devem guardar somente dados necessários à explicação operacional; não devem conter tokens, segredos, credenciais bancárias ou payloads documentais binários.

## Estruturas aprovadas

- `matching_rules`
- `matching_preferences`
- `matching_runs`
- `matching_candidates`
- `matching_candidate_scores`
- `matching_rule_results`
- `matching_rejections`

## API inicial

- `GET /api/v1/matching/requests/:requestId/capacity` — avaliação efêmera, sem escrita;
- `POST /api/v1/matching/requests/:requestId/runs` — execução persistida;
- `GET /api/v1/matching/requests/:requestId/runs` — histórico da carga;
- `GET /api/v1/matching/runs/:runId` — execução;
- `GET /api/v1/matching/runs/:runId/candidates` — candidatos persistidos;
- `GET /api/v1/matching/candidates/:candidateId/explanation` — score, regras e rejeições;
- `GET /api/v1/matching/rules` — regras tenant-scoped;
- `GET /api/v1/matching/preferences` — preferências ativas.

## Validação

A decisão é protegida por:

- CI, lint, formatting, typecheck, testes e build;
- geração/check dos artefatos Drizzle;
- Neon Database Gate geral;
- Neon Matching Gate dedicado em branch efêmera;
- testes positivos/negativos de RLS;
- rejeição de FKs cross-tenant;
- validação de grants mutáveis versus históricos append-only;
- promoção sequencial `development → staging` com baseline 0020 verificada.

Production permanece fora da sequência até uma promoção explicitamente aprovada.

## Consequências

### Positivas

- decisões de matching tornam-se auditáveis e reproduzíveis;
- explicações não dependem do estado atual de motorista/veículo;
- ranking ponderado pode evoluir de forma aditiva;
- rejeições deixam de ser apenas mensagens transitórias;
- frontend e analytics ganham uma fonte histórica estável.

### Trade-offs

- há aumento deliberado de volume de dados por execução;
- snapshots exigem disciplina de minimização de dados;
- mudanças de algoritmo precisam ser versionadas para preservar semântica histórica.

## Próxima evolução

A Wave 0021 poderá consumir o candidato selecionado/execução de matching como contexto para negociação complementar, sem acoplar a persistência de matching ao lifecycle das propostas.
