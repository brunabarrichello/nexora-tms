# Nexora TMS — Template Mestre de Frontend

Status: baseline oficial de interface para evolução incremental
Jira relacionado: NEX-14 (infra/runtime) e waves funcionais subsequentes

## Objetivo

Padronizar a construção das páginas do Nexora TMS sem criar layouts paralelos por módulo. O frontend deve evoluir reutilizando os componentes estruturais existentes em `apps/web/app/_components`.

O Template Mestre não é um único componente monolítico. Ele é um conjunto de templates de página com contratos claros, todos renderizados dentro do `AppShell` global.

## Camadas do Template Mestre

### 1. AppShell

Arquivo: `apps/web/app/_components/app-shell.tsx`

Responsável por:

- identidade visual Nexora;
- navegação principal;
- navegação administrativa;
- topbar;
- busca global;
- contexto visual de tenant;
- perfil do usuário;
- identificação de ambiente;
- área de conteúdo principal.

Nenhuma página funcional deve recriar sidebar, topbar ou shell próprio.

### 2. HubPage

Arquivo: `apps/web/app/_components/hub-page.tsx`

Use para páginas que agrupam subáreas de um domínio.

Exemplos:

- Cadastros;
- Administração;
- Configurações;
- Documentos quando organizado por famílias;
- Relatórios por categoria.

Contrato principal:

- `eyebrow`;
- `title`;
- `description`;
- `items[]` com `href`, `title`, `description` e `badge` opcional.

Não use `HubPage` para tabelas operacionais ou formulários.

### 3. ModulePage

Arquivo: `apps/web/app/_components/module-page.tsx`

Use como landing page de módulo ainda em evolução, quando a área já precisa existir na navegação mas ainda não possui fluxo operacional completo.

Contrato principal:

- `eyebrow`;
- `title`;
- `description`;
- `status`;
- `highlights[]`;
- `primaryAction` opcional.

Estados previstos atualmente:

- `Em construção`;
- `Próximo`;
- `Planejado`.

Esse template deve desaparecer progressivamente de áreas maduras em favor de páginas operacionais reais.

### 4. OperationalPage

Arquivo: `apps/web/app/_components/operational-page.tsx`

Template padrão para telas de consulta operacional, listagem e acompanhamento.

Já suporta:

- hero da página;
- status;
- ações primárias e secundárias;
- métricas;
- tabs;
- busca;
- filtros;
- tabela;
- links por coluna;
- status na tabela;
- estado vazio;
- paginação;
- notas de integração;
- bloco de readiness para API, segurança, auditoria e UX.

Use este template como padrão para:

- clientes;
- motoristas;
- veículos;
- implementos;
- cargas;
- negociações;
- viagens;
- ocorrências;
- documentos;
- contas financeiras;
- auditoria;
- demais coleções operacionais.

### 5. FormPage

Arquivo: `apps/web/app/_components/form-page.tsx`

Template base para criação/edição estruturada de entidades.

Já suporta:

- hero;
- navegação de retorno;
- grupos de campos;
- inputs de texto, e-mail, telefone, número e data;
- selects;
- obrigatoriedade;
- campos largos;
- checklist lateral;
- ações de salvar rascunho e salvar cadastro.

Integrações futuras devem conectar este template a:

- server actions/API;
- validação de domínio;
- TenantContext;
- RBAC;
- auditoria;
- tratamento de duplicidade;
- lifecycle;
- soft delete quando aplicável.

## Componentes especializados existentes

Os componentes abaixo são extensões do Template Mestre e não devem ser duplicados sem necessidade:

- `api-collection-page.tsx`;
- `document-forms.tsx`;
- `qualification-block-release-form.tsx`;
- `qualification-editor-page.tsx`;
- `qualification-form.tsx`;
- `qualification-resource-page.tsx`.

Antes de criar um novo template, verificar se um componente estrutural existente pode ser estendido.

## Ordem de decisão para novas páginas

Ao criar uma página, aplicar esta sequência:

1. é apenas agrupador de áreas? → `HubPage`;
2. é módulo ainda sem operação completa? → `ModulePage`;
3. é listagem/consulta operacional? → `OperationalPage`;
4. é criação/edição estruturada? → `FormPage`;
5. existe necessidade de comportamento especializado? → estender um template existente;
6. criar novo template apenas quando nenhum contrato atual atender sem violar responsabilidade.

## Estrutura visual obrigatória

As páginas devem preservar, quando aplicável:

1. eyebrow/contexto;
2. título;
3. descrição curta;
4. status;
5. ações principais;
6. métricas relevantes;
7. tabs/contexto secundário;
8. filtros;
9. conteúdo principal;
10. estados de loading/vazio/erro;
11. paginação quando coleção;
12. readiness ou informação contextual apenas quando útil.

## Estados obrigatórios

Toda página conectada a dados reais deve prever:

- loading;
- vazio;
- erro recuperável;
- erro de permissão;
- registro não encontrado;
- sucesso de mutação;
- validação de formulário;
- operação sem permissão;
- tenant sem acesso ao recurso;
- indisponibilidade temporária da API.

## Contrato de tabelas

Coleções operacionais devem priorizar:

- colunas essenciais;
- status legível;
- links para detalhe quando aplicável;
- filtros persistidos na URL;
- paginação server-side;
- ordenação server-side quando necessária;
- total de registros quando disponível;
- ações condicionadas por permissão;
- responsividade sem esconder informação crítica.

Evitar tabelas gigantes como substituto de telas de detalhe.

## Contrato de formulários

Formulários devem:

- agrupar campos por domínio;
- diferenciar obrigatórios e opcionais;
- validar no cliente apenas para UX;
- validar novamente no servidor;
- nunca confiar em tenant, role ou ownership enviados pelo browser;
- preservar mensagens de erro de domínio;
- evitar perda silenciosa de dados;
- registrar auditoria após integração com backend.

## Multi-tenant e autorização

A interface pode exibir tenant e permissões para UX, mas nunca deve ser a fonte de segurança.

Quando TenantContext/RBAC forem retomados:

- esconder ações sem permissão melhora UX;
- a API continua responsável pela autorização definitiva;
- tenant nunca deve ser selecionado livremente para escapar do escopo da sessão;
- páginas devem tratar explicitamente `403` e recursos fora do tenant.

## Design tokens e estilos

Os estilos estruturais atualmente vivem em:

- `apps/web/app/globals.css`;
- `apps/web/app/workbench.css`.

Antes de criar novas classes, reutilizar padrões existentes como:

- `page-stack`;
- `page-hero`;
- `operational-hero`;
- `eyebrow`;
- `title-row`;
- `status-badge`;
- `button`;
- `button-primary`;
- `button-secondary`;
- `metric-grid`;
- `metric-card`;
- `page-tabs`;
- `data-panel`;
- `filter-grid`;
- `data-table`;
- `table-empty`;
- `readiness-panel`;
- `entity-form`;
- `form-section`;
- `field-grid`.

O objetivo é impedir variações visuais acidentais entre módulos.

## Regras para evolução

- Não criar sidebar específica por módulo.
- Não criar topbar específica por módulo.
- Não duplicar `OperationalPage` para trocar apenas textos ou colunas.
- Não duplicar `FormPage` para trocar apenas campos.
- Não introduzir biblioteca visual externa apenas para uma página isolada.
- Mudanças transversais de UX devem ser feitas no template compartilhado quando possível.
- Mudanças incompatíveis de arquitetura visual devem ser documentadas antes de ampla adoção.

## Checklist para uma nova página

- rota definida;
- template correto escolhido;
- título e descrição coerentes;
- ações definidas;
- estados loading/vazio/erro tratados;
- filtros e paginação definidos quando coleção;
- dados não mockados quando integração já existe;
- TenantContext/RBAC considerados;
- auditoria considerada para mutações;
- responsividade revisada;
- typecheck/test/build verdes;
- Preview Deployment Vercel validado antes do merge.

## Relação com Vercel

Toda evolução do Template Mestre deve ser validada em Preview Deployment no projeto Vercel `nexora-tms-web` quando esse projeto estiver fisicamente criado.

O gate mínimo de Preview deve verificar:

- build Next.js bem-sucedido;
- navegação pelo AppShell;
- página alterada acessível;
- ausência de erro runtime não tratado;
- responsividade básica;
- nenhuma variável secreta exposta como `NEXT_PUBLIC_*`.

## Resultado esperado

Com este padrão, novos módulos podem evoluir de landing page para operação real sem redesenhar shell, navegação, tabelas e formulários a cada wave. O Template Mestre passa a ser um contrato reutilizável e incremental do produto, não um conjunto de telas independentes.
