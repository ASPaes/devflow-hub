# Agente de Dev para correção automática de demandas

**Data:** 2026-07-20
**Status:** Aprovado (design) — pendente escrita do plano de implementação
**Autor:** brainstorming DoctorDev

## Contexto e problema

Usuários do **DoctorSaaS** relatam problemas que viram **demandas** no **DoctorDev**
(devflow-hub). Hoje o time trata cada demanda manualmente. Para as demandas que são
falhas no produto ("Correção"), queremos um **agente de desenvolvimento** que:

1. Recebe o contexto da demanda — **incluindo as imagens/prints** anexados (a demanda
   quase sempre traz um screenshot mostrando o local e o erro; o agente precisa
   **enxergar** a imagem, não só ler o texto).
2. Corrige o problema no código do DoctorSaaS.
3. Publica a correção (até deploy).
4. Monta um texto explicando a origem do problema e como foi corrigido.
5. Devolve esse texto ao time como **Retorno** na demanda.

O objetivo é reduzir horas de desenvolvimento e ganhar agilidade na resolução.

### O que já existe no DoctorDev (reaproveitado)

- Edge Function `gerar-prompt-demanda` (usa `ANTHROPIC_API_KEY`): monta um prompt com o
  contexto da demanda (descrição, comentários, anexos). Hoje o dev copia e cola no
  Claude Code manualmente. Colunas `prompt_ia` e `prompt_ia_atualizado_em` na demanda.
- Feature de **Retornos** (`demanda_retornos`, tipos em `src/types/retorno.ts`): texto +
  mídia devolvidos ao cliente — é o passo final "Envia devolutiva".
- Página de detalhe da demanda (`src/routes/_authenticated/demandas.$codigo.tsx`) com
  toolbar de ações (onde entra o botão), restrita a Desenvolvedores para ações de IA.
- Tabela `produtos` (a demanda tem `produto_id`), sem configuração de repositório.

### O que falta (foco desta fase)

O passo central do fluxo: sair de "gerar prompt" para o **agente executar de fato** a
correção no DoctorSaaS, publicar e devolver o texto da devolutiva.

## Decisões de arquitetura (definidas no brainstorming)

| Decisão | Escolha |
|---|---|
| Onde o Claude Code roda | **GitHub Actions** (Claude Code Action) no repo do DoctorSaaS |
| Entrega da correção | **Automático até deploy** (com guardrails; ver abaixo) |
| Canal da devolutiva | **Só registra Retorno** no DoctorDev (WhatsApp fica pra fase futura) |
| Escopo do botão | **Qualquer demanda**, apenas **Desenvolvedores** |
| Status/callback | **Workflow chama Edge Function de callback** por etapa |
| Mapeamento repo | Config de repo **dentro de `produtos`** |
| Guardrails de deploy | Flag `auto_deploy` por produto, **iniciando em `false` (abre PR)** |

## Visão geral do fluxo

```
Demanda (DoctorDev)
  └─ [Botão "Acionar Agente"] (Desenvolvedor)
      └─ Edge Function `disparar-agente`
          ├─ valida permissão (Desenvolvedor) + repo do produto configurado
          ├─ monta contexto (reusa lógica do gerar-prompt-demanda)
          ├─ cria linha em `agente_execucoes` (status=enfileirada)
          └─ dispara workflow_dispatch no GitHub do DoctorSaaS
              └─ GitHub Actions (Claude Code Action)
                  1. corrige numa branch       → callback "corrigindo"
                  2. roda testes/lint/build     → callback "testando"
                  3. se verde e auto_deploy:
                       merge + deploy            → callback "deploy"
                     senão: abre PR (para review)
                  4. Claude redige a devolutiva (origem + como corrigiu)
                  5. callback "concluida" (pr_url, deploy_url, texto)
                     └─ Edge Function `agente-callback`
                         ├─ atualiza `agente_execucoes`
                         └─ grava Retorno na demanda ← devolutiva
      └─ UI reflete status em tempo real (badge, links, devolutiva)
```

## Componentes

### 1. Modelo de dados (Supabase)

**Nova tabela `agente_execucoes`** (uma linha por acionamento; guarda histórico):

| Coluna | Tipo | Notas |
|---|---|---|
| `id` | uuid pk | |
| `demanda_id` | uuid fk → demandas | |
| `status` | enum | `enfileirada` → `corrigindo` → `testando` → `deploy` → `concluida` / `falhou` / `cancelada` |
| `github_run_id` | bigint null | id do run no GitHub Actions |
| `github_run_url` | text null | link pro run |
| `pr_url` | text null | link do PR aberto |
| `deploy_url` | text null | link/id do deploy (quando auto_deploy) |
| `resumo` | text null | texto da devolutiva gerado pelo agente |
| `erro_mensagem` | text null | em caso de falha |
| `retorno_id` | uuid fk null → demanda_retornos | Retorno criado na conclusão |
| `disparado_por` | uuid fk → auth.users | |
| `created_at` / `updated_at` / `finished_at` | timestamptz | |

**Extensão de `produtos`** (config de repo — só DoctorSaaS por ora):

| Coluna | Tipo | Notas |
|---|---|---|
| `github_owner` | text null | org/owner do repo |
| `github_repo` | text null | nome do repo |
| `branch_base` | text null default 'main' | branch alvo |
| `workflow_file` | text null | ex.: `agente-correcao.yml` |
| `auto_deploy` | boolean not null default false | trava de segurança: false = só abre PR |

**RLS:** só Desenvolvedor/admin insere em `agente_execucoes` e atualiza a config de repo
em `produtos`; leitura das execuções segue a mesma visibilidade da demanda. O callback
escreve via service role (Edge Function), fora do RLS do usuário.

### 2. Backend — 2 Edge Functions novas

**`disparar-agente`**
- Valida no servidor que o usuário é Desenvolvedor (mesmo critério do `gerar-prompt-demanda`).
- Carrega a demanda + produto; erro claro se o produto não tem repo configurado.
- Monta o contexto da demanda reaproveitando a lógica do `gerar-prompt-demanda`
  (descrição, comentários, anexos). Reusa o `prompt_ia` salvo se existir.
- **Entrada multimodal**: coleta os anexos de imagem da demanda (prints do erro) e gera
  **URLs assinadas** do Supabase Storage para cada um. Essas URLs vão junto no payload —
  o agente precisa ver os screenshots, que muitas vezes mostram o local e a mensagem de
  erro que não estão descritos no texto.
- Cria a linha em `agente_execucoes` (status=`enfileirada`).
- Chama a GitHub API `POST /repos/{owner}/{repo}/actions/workflows/{file}/dispatches`
  com inputs: `execucao_id`, `demanda_codigo`, `contexto/prompt`, `imagens` (lista de
  URLs assinadas), `callback_url`, `callback_secret`, `auto_deploy`.
- Retorna `execucao_id` pro front.

**`agente-callback`**
- Endpoint público, autenticado por **HMAC/secret** no header (evita spoofing).
- Recebe POSTs do workflow por etapa: `{execucao_id, status, github_run_url?, pr_url?,
  deploy_url?, resumo?, erro_mensagem?}`.
- Atualiza `agente_execucoes` (status + campos).
- Em `concluida`: cria um **Retorno** (`demanda_retornos`) com o `resumo` e grava
  `retorno_id`. **Nesta fase o status da demanda NÃO muda automaticamente** — um
  Desenvolvedor decide o próximo status ao ler a devolutiva. (Registrar no histórico é
  opcional e pode entrar depois.)
- Em `falhou`: marca falha e mensagem para exibição na UI.

### 3. Workflow no repo do DoctorSaaS

Arquivo `.github/workflows/agente-correcao.yml` **versionado no repo do DoctorSaaS**
(repositório separado deste). `on: workflow_dispatch` com os inputs acima. Passos:

1. Callback `corrigindo` → `actions/checkout`.
2. **Baixa as imagens** das URLs assinadas para uma pasta no runner (ex.:
   `.agente/prints/`). O prompt lista os caminhos locais desses arquivos para o Claude
   Code abrir e analisar (input multimodal — o agente vê os prints do erro).
3. **Claude Code Action** com o prompt + os caminhos das imagens + guardrails (escopo de
   arquivos permitido, instruções de correção). Aplica a correção numa branch nova.
4. Callback `testando` → roda testes/lint/build (**gate obrigatório**).
   - Falhou → callback `falhou` com log e encerra.
5. Verde:
   - `auto_deploy=false` → abre **PR** para revisão humana; devolutiva referencia o PR.
   - `auto_deploy=true` → merge na `branch_base` + dispara o **deploy** existente do
     DoctorSaaS; callback `deploy`.
6. Claude gera o **texto da devolutiva** (origem do problema + como corrigiu) a partir do
   diff.
7. Callback `concluida` com `pr_url`, `deploy_url`, `resumo`.

Qualquer erro em qualquer passo → callback `falhou` com o log relevante.

### 4. UI (DoctorDev)

- Botão **"Acionar Agente"** na toolbar da demanda
  (`demandas.$codigo.tsx`, ao lado de "Gerar prompt IA"), visível só a Desenvolvedores e
  só quando o produto da demanda tem repo configurado.
- **Dialog de confirmação**: mostra o contexto/prompt que será enviado + aviso explícito
  ("vai corrigir e — se auto_deploy — publicar automaticamente").
- **Card de status quase em tempo real**: **react-query com polling** na
  `agente_execucoes` enquanto houver execução ativa (segue o padrão de hooks já usado no
  projeto; Supabase realtime fica como melhoria opcional). Badge da etapa atual, links
  pro run/PR/deploy, e o texto da devolutiva quando pronto. Histórico das execuções da
  demanda.
- Novo hook `useAcionarAgente` / `useAgenteExecucoes` seguindo o padrão dos hooks atuais.

### 5. Guardrails (por causa do "automático até deploy")

- **Merge/deploy só com CI verde** — gate obrigatório no workflow.
- **Escopo de arquivos permitido** (ex.: só `src/`; nunca migrations, infra, secrets) —
  instruído no prompt e validado no workflow.
- **Flag `auto_deploy` por produto**, iniciando em `false` (abre PR, humano faz o merge).
  Liga-se a automação total quando o time confiar no agente — sem reescrever nada.
- **Timeout + limite de custo** por execução.
- **Log completo** (run URL, diff, PR) registrado em `agente_execucoes`.

### 6. Autenticação do Claude Code (como o agente atua)

O workflow roda **headless** no GitHub Actions — sem login interativo — então a
credencial vem de um **secret** no repo do DoctorSaaS. Opções e escolha:

- **✅ Escolhido: `ANTHROPIC_API_KEY` (chave de API Anthropic)** na `anthropics/claude-code-action`
  (input `anthropic_api_key`, secret `ANTHROPIC_API_KEY`). É a via feita para uso
  **programático/não supervisionado**: sem risco de violar Termos, cobrança na conta de
  **API** (quota própria), escalável. **Reusa a mesma conta Anthropic** que já roda o
  `gerar-prompt-demanda` hoje.
- **❌ Descartado: token de assinatura Pro/Max (`CLAUDE_CODE_OAUTH_TOKEN`, via
  `claude setup-token`)** — os Termos de consumidor restringem esse token a Claude
  Code/claude.ai; usá-lo em CI automatizado sob demanda do usuário é **risco de violação
  de Termos** e consome a **mesma quota** da assinatura pessoal (sem pool de CI separado).
- **🔒 Evolução futura: Workload Identity Federation (WIF)** — troca a OIDC do GitHub por
  token curto, **sem secret estático** (inputs `anthropic_federation_rule_id`,
  `anthropic_organization_id`, `anthropic_service_account_id`; requer `id-token: write`).
  Migração possível depois, sem reescrever o fluxo. (Bedrock/Vertex ficam como opção caso
  o time centralize em AWS/GCP.)

### 7. Segurança

- `ANTHROPIC_API_KEY` e token do GitHub (App/PAT) ficam no Supabase (Edge Functions
  secrets) e no GitHub Actions secrets do DoctorSaaS — **nunca no front**.
- Callback assinado por HMAC com `callback_secret` único por execução.
- Permissão de Desenvolvedor validada **no servidor**, não só na UI.

## Testes

- **Edge Functions**: permissão, payload, disparo (mock da GitHub API), callback
  (validação de assinatura, transições de status, criação do Retorno).
- **UI**: estados do botão/dialog/card de status.
- **Workflow**: validar num **repo sandbox** antes de apontar pro DoctorSaaS real;
  primeiro com `auto_deploy=false`.

## Fora de escopo (fases futuras)

- Envio automático da devolutiva via **WhatsApp**.
- Acionamento automático por categorização (sem botão).
- Suporte a **múltiplos repositórios** além do DoctorSaaS.
- Analisar anexos de **vídeo/áudio** como input do agente — nesta fase só **imagens**
  (prints) são enviadas ao agente.

## Pré-requisitos / dependências externas

- DoctorSaaS hospedado no **GitHub**, com CI (testes/lint/build) e pipeline de deploy.
- GitHub App ou PAT com permissão de `workflow_dispatch` e escrita no repo do DoctorSaaS.
- `ANTHROPIC_API_KEY` (conta de API Anthropic, a mesma do `gerar-prompt-demanda`)
  cadastrada como **secret no repo do DoctorSaaS** para a `claude-code-action`.
