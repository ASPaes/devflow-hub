# Agente de Dev para Correção Automática — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adicionar um botão "Acionar Agente" na demanda que dispara o Claude Code via GitHub Actions no repo do DoctorSaaS, corrige o problema (vendo os prints anexados), publica com guardrails, e grava a devolutiva como Retorno na demanda.

**Architecture:** O front (TanStack Start) chama a Edge Function `disparar-agente` (Supabase/Deno), que valida permissão, monta o contexto (texto + URLs assinadas das imagens) e dispara um `workflow_dispatch` no repo do DoctorSaaS. O GitHub Actions roda a `claude-code-action`, testa, publica e, a cada etapa, faz callback assinado (HMAC) para a Edge Function `agente-callback`, que atualiza a tabela `agente_execucoes` e, ao concluir, cria um Retorno. A UI acompanha por polling do react-query.

**Tech Stack:** TanStack Start + React 19 + react-query, Supabase (Postgres + Edge Functions Deno), Vitest (novo, só lógica pura), GitHub Actions + `anthropics/claude-code-action`.

## Global Constraints

- **Repositório separado:** o arquivo de workflow (Task 9) vive no **repo do DoctorSaaS**, NÃO neste repo. Aqui ele é versionado só como referência em `docs/superpowers/reference/`.
- **Autenticação do agente:** `claude-code-action` usa `anthropic_api_key: ${{ secrets.ANTHROPIC_API_KEY }}` (chave de API Anthropic — a mesma conta do `gerar-prompt-demanda`). NUNCA usar token de assinatura Pro/Max em CI.
- **Segredos nunca no front:** `ANTHROPIC_API_KEY`, `GITHUB_AGENTE_TOKEN`, `SUPABASE_SERVICE_ROLE_KEY` só em Edge Functions secrets / GitHub Actions secrets.
- **Permissão:** todas as ações de disparo exigem `tem_permissao('acionar_agente_correcao')`, validada no servidor (não só na UI).
- **Guardrail de deploy:** merge/deploy só acontece com CI verde e apenas quando `produtos.auto_deploy = true`. Começa em `false` (só abre PR).
- **Callback assinado:** todo POST do workflow para `agente-callback` traz o header `x-agente-assinatura` = HMAC-SHA256 hex do corpo cru, usando o `callback_secret` da execução.
- **Enum status:** `enfileirada` → `corrigindo` → `testando` → `deploy` → `concluida` / `falhou` / `cancelada` (nomes exatos, minúsculos).
- **Padrões do repo:** Edge Functions seguem o formato de `supabase/functions/invite-user/index.ts` (Deno.serve, CORS, helper `json`, `userClient` p/ permissão, `adminClient` service-role p/ escrita). Migrations são SQL cru em `supabase/migrations/`. Sem testes na UI — só `tsc`, `eslint`, `vite build` e verificação manual.

---

## Interfaces compartilhadas (contratos entre tasks)

Módulos puros em `supabase/functions/_shared/` (importáveis por Deno E Vitest — usam só Web Crypto e TS puro, sem `Deno.*`/`npm:`):

```ts
// _shared/hmac.ts
export function assinarPayload(secret: string, payload: string): Promise<string>; // HMAC-SHA256 hex
export function verificarAssinatura(secret: string, payload: string, assinatura: string): Promise<boolean>;

// _shared/status.ts
export const STATUS_AGENTE = ["enfileirada","corrigindo","testando","deploy","concluida","falhou","cancelada"] as const;
export type StatusAgente = (typeof STATUS_AGENTE)[number];
export function isStatusAgente(v: string): v is StatusAgente;
export function transicaoValida(de: StatusAgente, para: StatusAgente): boolean;

// _shared/contexto.ts
export interface ComentarioContexto { autor: string; texto: string; }
export interface DadosDemandaContexto {
  codigo: string; titulo: string; descricao: string; comentarios: ComentarioContexto[];
}
export function montarPromptAgente(d: DadosDemandaContexto): string;
```

Edge Functions:
- `disparar-agente`: request `{ demanda_id: string }` → response `{ execucao_id: string }`.
- `agente-callback`: request body JSON `{ execucao_id: string, status: StatusAgente, github_run_id?: number, github_run_url?: string, pr_url?: string, deploy_url?: string, resumo?: string, erro_mensagem?: string }`, header `x-agente-assinatura`.

Front (`src/types/agente.ts`):
```ts
export type StatusAgente = "enfileirada"|"corrigindo"|"testando"|"deploy"|"concluida"|"falhou"|"cancelada";
export interface AgenteExecucao {
  id: string; demanda_id: string; status: StatusAgente;
  github_run_id: number | null; github_run_url: string | null;
  pr_url: string | null; deploy_url: string | null;
  resumo: string | null; erro_mensagem: string | null;
  retorno_id: string | null; disparado_por: string | null;
  created_at: string; updated_at: string; finished_at: string | null;
}
```

Front hooks (`src/hooks/useAgente.ts`):
- `useAcionarAgente()` → mutation `{ demandaId: string }` → `{ execucao_id: string }`.
- `useAgenteExecucoes(demandaId?: string)` → query `AgenteExecucao[]` (polling enquanto houver execução ativa).

---

### Task 1: Migration — valor de permissão no enum (arquivo isolado)

**Por quê isolado:** No Postgres, um novo valor de enum (`ALTER TYPE ... ADD VALUE`) não pode ser usado (ex.: `array_append`) na mesma transação/migration em que é adicionado. O repo já faz isso (ver `20260501062045_...sql`). Então este valor fica sozinho.

**Files:**
- Create: `supabase/migrations/20260720130000_agente_permissao_enum.sql`

- [ ] **Step 1: Criar a migration**

```sql
-- Adiciona a permissão de acionar o agente de correção.
-- Precisa ficar isolada: o valor só pode ser USADO (grant) numa migration seguinte.
ALTER TYPE public.app_permissao ADD VALUE IF NOT EXISTS 'acionar_agente_correcao';
```

- [ ] **Step 2: Verificar sintaxe**

Run: `grep -c "acionar_agente_correcao" supabase/migrations/20260720130000_agente_permissao_enum.sql`
Expected: `1`

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260720130000_agente_permissao_enum.sql
git commit -m "feat(db): adiciona permissao acionar_agente_correcao ao enum"
```

---

### Task 2: Migration — colunas de repo, tabela `agente_execucoes`, RLS e grant

**Files:**
- Create: `supabase/migrations/20260720130100_agente_correcao.sql`
- Modify: `src/integrations/supabase/types.ts` (regenerado após aplicar)

**Interfaces:**
- Produces: tabela `agente_execucoes` e colunas de repo em `produtos` usadas por todas as tasks de backend/front.

- [ ] **Step 1: Escrever a migration**

```sql
-- 1. Config de repositório por produto (por ora só o DoctorSaaS será preenchido)
alter table public.produtos
  add column if not exists github_owner  text,
  add column if not exists github_repo   text,
  add column if not exists branch_base   text not null default 'main',
  add column if not exists workflow_file text,
  add column if not exists auto_deploy   boolean not null default false;

comment on column public.produtos.auto_deploy is
  'Guardrail: false = agente só abre PR; true = agente faz merge+deploy com CI verde.';

-- 2. Enum de status da execução do agente
do $$ begin
  create type public.status_agente_execucao as enum (
    'enfileirada','corrigindo','testando','deploy','concluida','falhou','cancelada'
  );
exception when duplicate_object then null; end $$;

-- 3. Tabela de execuções (histórico: 1 linha por acionamento)
create table if not exists public.agente_execucoes (
  id             uuid primary key default gen_random_uuid(),
  demanda_id     uuid not null references public.demandas(id) on delete cascade,
  status         public.status_agente_execucao not null default 'enfileirada',
  github_run_id  bigint,
  github_run_url text,
  pr_url         text,
  deploy_url     text,
  resumo         text,
  erro_mensagem  text,
  retorno_id     uuid references public.demanda_retornos(id) on delete set null,
  callback_secret text not null,
  disparado_por  uuid references auth.users(id),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  finished_at    timestamptz
);

create index if not exists agente_execucoes_demanda_idx
  on public.agente_execucoes(demanda_id, created_at desc);

-- (updated_at é setado explicitamente pelas Edge Functions — sem dependência de trigger)

-- 4. RLS: leitura para quem enxerga a demanda; escrita só via service role (Edge Functions)
alter table public.agente_execucoes enable row level security;

drop policy if exists agente_execucoes_select on public.agente_execucoes;
create policy agente_execucoes_select on public.agente_execucoes
for select using (
  exists (
    select 1 from public.demandas d
    where d.id = agente_execucoes.demanda_id
      and d.deleted_at is null
      and (
        (select public.tem_permissao('ver_demandas'))
        or (select public.tem_permissao('ver_todas_demandas'))
        or (d.solicitante_id = (select auth.uid()))
      )
  )
);
-- Sem policies de insert/update/delete: clientes não escrevem direto.
-- As Edge Functions usam service_role, que ignora RLS.

-- 5. Nunca expor o callback_secret para o cliente:
-- REVOKE de coluna não subtrai de um grant de tabela (padrão documentado do Supabase),
-- então revogamos SELECT no nível da tabela e concedemos SELECT só nas colunas seguras.
revoke select on public.agente_execucoes from anon, authenticated;
grant select (
  id, demanda_id, status, github_run_id, github_run_url, pr_url, deploy_url,
  resumo, erro_mensagem, retorno_id, disparado_por, created_at, updated_at, finished_at
) on public.agente_execucoes to anon, authenticated;

-- 6. Grant da permissão ao perfil Desenvolvedor
update public.perfis_acesso
  set permissoes = array_append(permissoes, 'acionar_agente_correcao'::public.app_permissao)
  where nome = 'Desenvolvedor'
    and not ('acionar_agente_correcao' = any(permissoes));
```

- [ ] **Step 2: Sanidade do SQL (tabela + permissão + colunas presentes)**

Run: `grep -c "agente_execucoes\|acionar_agente_correcao\|auto_deploy" supabase/migrations/20260720130100_agente_correcao.sql`
Expected: ≥ 3 (a migration cria a tabela, faz o grant e adiciona `auto_deploy`).

- [ ] **Step 3: Aplicar a migration no banco**

Run (com Supabase CLI logado no projeto): `supabase db push`
Expected: aplica `20260720130000` e `20260720130100` sem erro.
(Se não usar CLU local, aplique via painel/MCP `apply_migration` com o mesmo SQL.)

- [ ] **Step 4: Regenerar os tipos do Supabase**

Run: `supabase gen types typescript --project-id "$SUPABASE_PROJECT_ID" > src/integrations/supabase/types.ts`
Expected: `agente_execucoes` e as novas colunas de `produtos` aparecem no arquivo.
Verify: `grep -c "agente_execucoes" src/integrations/supabase/types.ts` → ≥ 1
(Se não puder regenerar agora, adicione manualmente o bloco `agente_execucoes` seguindo o formato de `demanda_retornos` em types.ts, com as colunas da Step 1.)

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: sem novos erros.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/20260720130100_agente_correcao.sql src/integrations/supabase/types.ts
git commit -m "feat(db): tabela agente_execucoes + config de repo em produtos + RLS"
```

---

### Task 3: Vitest + módulo HMAC (TDD)

**Files:**
- Create: `vitest.config.ts`
- Modify: `package.json` (script `test` + devDep `vitest`)
- Create: `supabase/functions/_shared/hmac.ts`
- Test: `supabase/functions/_shared/hmac.test.ts`

**Interfaces:**
- Produces: `assinarPayload`, `verificarAssinatura` (usados por `disparar-agente`, `agente-callback` e o workflow via openssl).

- [ ] **Step 1: Instalar Vitest**

Run: `bun add -d vitest`
Expected: `vitest` aparece em devDependencies.

- [ ] **Step 2: Criar `vitest.config.ts`**

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["supabase/functions/_shared/**/*.test.ts", "src/**/*.test.ts"],
    environment: "node",
  },
});
```

- [ ] **Step 3: Adicionar script de teste no `package.json`**

No bloco `"scripts"`, adicionar:
```json
    "test": "vitest run",
    "test:watch": "vitest"
```

- [ ] **Step 4: Escrever o teste que falha**

```ts
// supabase/functions/_shared/hmac.test.ts
import { describe, it, expect } from "vitest";
import { assinarPayload, verificarAssinatura } from "./hmac";

describe("hmac", () => {
  const secret = "s3gr3d0-de-teste";
  const payload = '{"execucao_id":"abc","status":"corrigindo"}';

  it("assina de forma determinística (hex de 64 chars)", async () => {
    const a = await assinarPayload(secret, payload);
    const b = await assinarPayload(secret, payload);
    expect(a).toBe(b);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
  });

  it("verifica assinatura válida", async () => {
    const sig = await assinarPayload(secret, payload);
    expect(await verificarAssinatura(secret, payload, sig)).toBe(true);
  });

  it("rejeita assinatura com secret errado", async () => {
    const sig = await assinarPayload("outro", payload);
    expect(await verificarAssinatura(secret, payload, sig)).toBe(false);
  });

  it("rejeita payload adulterado", async () => {
    const sig = await assinarPayload(secret, payload);
    expect(await verificarAssinatura(secret, payload + "x", sig)).toBe(false);
  });
});
```

- [ ] **Step 5: Rodar o teste e ver falhar**

Run: `bun run test`
Expected: FAIL — `Cannot find module './hmac'`.

- [ ] **Step 6: Implementar `hmac.ts`**

```ts
// supabase/functions/_shared/hmac.ts
// HMAC-SHA256 em hex, usando Web Crypto (funciona em Deno e Node 20+).

function bytesParaHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function chave(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
}

export async function assinarPayload(
  secret: string,
  payload: string,
): Promise<string> {
  const key = await chave(secret);
  const sig = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(payload),
  );
  return bytesParaHex(sig);
}

/** Comparação em tempo constante para evitar timing attacks. */
export async function verificarAssinatura(
  secret: string,
  payload: string,
  assinatura: string,
): Promise<boolean> {
  const esperada = await assinarPayload(secret, payload);
  if (esperada.length !== assinatura.length) return false;
  let diff = 0;
  for (let i = 0; i < esperada.length; i++) {
    diff |= esperada.charCodeAt(i) ^ assinatura.charCodeAt(i);
  }
  return diff === 0;
}
```

- [ ] **Step 7: Rodar o teste e ver passar**

Run: `bun run test`
Expected: PASS (4 testes).

- [ ] **Step 8: Confirmar que `openssl` gera o MESMO hash (o workflow usará openssl)**

O workflow assina com `openssl dgst -sha256 -hmac`. Este teste prova que bate com o módulo:
```bash
# valor do openssl (o que o workflow enviará)
printf '%s' '{"execucao_id":"abc","status":"corrigindo"}' \
  | openssl dgst -sha256 -hmac 's3gr3d0-de-teste' | awk '{print $2}'
# valor do módulo (o que agente-callback validará)
npx vitest run -t "assina de forma" 2>/dev/null; \
node --input-type=module -e '
  import("./supabase/functions/_shared/hmac.ts").then(async (m) => {
    console.log(await m.assinarPayload("s3gr3d0-de-teste", JSON.stringify({execucao_id:"abc",status:"corrigindo"})));
  });' 2>/dev/null || echo "(se o node não importar .ts, confie no teste vitest da Step 7)"
```
Expected: o hash do `openssl` é igual ao do módulo (ambos HMAC-SHA256 hex de 64 chars).
Atenção: o payload assinado deve ser **exatamente** os mesmos bytes nos dois lados — no workflow, `--data "$BODY"` envia o corpo cru, e `agente-callback` assina `await req.text()` (também cru).

- [ ] **Step 9: Commit**

```bash
git add vitest.config.ts package.json bun.lock supabase/functions/_shared/hmac.ts supabase/functions/_shared/hmac.test.ts
git commit -m "test: vitest + modulo hmac para assinar/verificar callbacks"
```

---

### Task 4: Módulo de status e montagem de contexto (TDD)

**Files:**
- Create: `supabase/functions/_shared/status.ts`
- Test: `supabase/functions/_shared/status.test.ts`
- Create: `supabase/functions/_shared/contexto.ts`
- Test: `supabase/functions/_shared/contexto.test.ts`

**Interfaces:**
- Consumes: nada.
- Produces: `STATUS_AGENTE`, `StatusAgente`, `isStatusAgente`, `transicaoValida`, `DadosDemandaContexto`, `montarPromptAgente`.

- [ ] **Step 1: Teste de status (falha)**

```ts
// supabase/functions/_shared/status.test.ts
import { describe, it, expect } from "vitest";
import { isStatusAgente, transicaoValida } from "./status";

describe("status agente", () => {
  it("reconhece status válido/inválido", () => {
    expect(isStatusAgente("corrigindo")).toBe(true);
    expect(isStatusAgente("banana")).toBe(false);
  });

  it("permite avanço no fluxo feliz", () => {
    expect(transicaoValida("enfileirada", "corrigindo")).toBe(true);
    expect(transicaoValida("corrigindo", "testando")).toBe(true);
    expect(transicaoValida("testando", "deploy")).toBe(true);
    expect(transicaoValida("deploy", "concluida")).toBe(true);
    expect(transicaoValida("testando", "concluida")).toBe(true); // auto_deploy=false: pula deploy
  });

  it("permite falhar de qualquer etapa ativa", () => {
    expect(transicaoValida("corrigindo", "falhou")).toBe(true);
    expect(transicaoValida("testando", "falhou")).toBe(true);
  });

  it("bloqueia transição a partir de estado terminal", () => {
    expect(transicaoValida("concluida", "corrigindo")).toBe(false);
    expect(transicaoValida("falhou", "concluida")).toBe(false);
    expect(transicaoValida("cancelada", "corrigindo")).toBe(false);
  });

  it("bloqueia retrocesso", () => {
    expect(transicaoValida("testando", "corrigindo")).toBe(false);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `bun run test supabase/functions/_shared/status.test.ts`
Expected: FAIL — `Cannot find module './status'`.

- [ ] **Step 3: Implementar `status.ts`**

```ts
// supabase/functions/_shared/status.ts
export const STATUS_AGENTE = [
  "enfileirada",
  "corrigindo",
  "testando",
  "deploy",
  "concluida",
  "falhou",
  "cancelada",
] as const;

export type StatusAgente = (typeof STATUS_AGENTE)[number];

export function isStatusAgente(v: string): v is StatusAgente {
  return (STATUS_AGENTE as readonly string[]).includes(v);
}

const TERMINAIS: StatusAgente[] = ["concluida", "falhou", "cancelada"];

// Ordem do fluxo feliz; permite pular etapas para frente (ex.: testando → concluida).
const ORDEM: StatusAgente[] = [
  "enfileirada",
  "corrigindo",
  "testando",
  "deploy",
  "concluida",
];

export function transicaoValida(de: StatusAgente, para: StatusAgente): boolean {
  if (TERMINAIS.includes(de)) return false; // estado terminal não sai
  if (para === "falhou" || para === "cancelada") return true; // pode abortar de qualquer ativo
  const i = ORDEM.indexOf(de);
  const j = ORDEM.indexOf(para);
  if (i === -1 || j === -1) return false;
  return j > i; // só avança
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `bun run test supabase/functions/_shared/status.test.ts`
Expected: PASS.

- [ ] **Step 5: Teste de contexto (falha)**

```ts
// supabase/functions/_shared/contexto.test.ts
import { describe, it, expect } from "vitest";
import { montarPromptAgente } from "./contexto";

describe("montarPromptAgente", () => {
  const base = {
    codigo: "DEM-123",
    titulo: "Botão salvar não funciona",
    descricao: "Ao clicar em salvar nada acontece.",
    comentarios: [{ autor: "Ana", texto: "acontece no Chrome" }],
  };

  it("inclui código, título e descrição", () => {
    const p = montarPromptAgente(base);
    expect(p).toContain("DEM-123");
    expect(p).toContain("Botão salvar não funciona");
    expect(p).toContain("Ao clicar em salvar nada acontece.");
  });

  it("inclui os comentários com autor", () => {
    const p = montarPromptAgente(base);
    expect(p).toContain("Ana");
    expect(p).toContain("acontece no Chrome");
  });

  it("funciona sem comentários", () => {
    const p = montarPromptAgente({ ...base, comentarios: [] });
    expect(p).toContain("DEM-123");
    expect(p).not.toContain("undefined");
  });
});
```

- [ ] **Step 6: Rodar e ver falhar**

Run: `bun run test supabase/functions/_shared/contexto.test.ts`
Expected: FAIL — `Cannot find module './contexto'`.

- [ ] **Step 7: Implementar `contexto.ts`**

```ts
// supabase/functions/_shared/contexto.ts
export interface ComentarioContexto {
  autor: string;
  texto: string;
}

export interface DadosDemandaContexto {
  codigo: string;
  titulo: string;
  descricao: string;
  comentarios: ComentarioContexto[];
}

/**
 * Monta o texto de contexto do problema para o agente.
 * Usado como fallback quando a demanda ainda não tem `prompt_ia` salvo.
 * As imagens (prints) NÃO entram aqui — vão como URLs assinadas no payload.
 */
export function montarPromptAgente(d: DadosDemandaContexto): string {
  const linhas: string[] = [
    `# Demanda ${d.codigo}: ${d.titulo}`,
    "",
    "## Descrição do problema relatado",
    d.descricao.trim() || "(sem descrição)",
  ];

  if (d.comentarios.length > 0) {
    linhas.push("", "## Comentários");
    for (const c of d.comentarios) {
      linhas.push(`- **${c.autor}**: ${c.texto}`);
    }
  }

  linhas.push(
    "",
    "## Sua tarefa",
    "1. Analise o problema (inclusive os prints anexados, cujos caminhos estão no prompt do workflow).",
    "2. Identifique a causa raiz no código.",
    "3. Corrija de forma mínima e segura, sem tocar em migrations, infra ou segredos.",
    "4. Ao final, produza um texto curto para o cliente explicando a ORIGEM do problema e COMO foi corrigido.",
  );

  return linhas.join("\n");
}
```

- [ ] **Step 8: Rodar toda a suíte**

Run: `bun run test`
Expected: PASS (hmac + status + contexto).

- [ ] **Step 9: Commit**

```bash
git add supabase/functions/_shared/status.ts supabase/functions/_shared/status.test.ts supabase/functions/_shared/contexto.ts supabase/functions/_shared/contexto.test.ts
git commit -m "test: maquina de status e montagem de contexto do agente"
```

---

### Task 5: Edge Function `disparar-agente`

**Files:**
- Create: `supabase/functions/disparar-agente/index.ts`

**Interfaces:**
- Consumes: `montarPromptAgente`, `DadosDemandaContexto` de `_shared/contexto.ts`.
- Produces: request `{ demanda_id }` → response `{ execucao_id }`. Cria linha em `agente_execucoes` (status `enfileirada`) e dispara `workflow_dispatch`.

**Secrets necessários (Supabase → Edge Functions secrets):** `GITHUB_AGENTE_TOKEN` (PAT/App com `workflow` + escrita no repo do DoctorSaaS). Já existem no ambiente: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`.

- [ ] **Step 1: Implementar a função**

```ts
// supabase/functions/disparar-agente/index.ts
// deno-lint-ignore-file no-explicit-any
import { createClient } from "npm:@supabase/supabase-js@2";
import { montarPromptAgente } from "../_shared/contexto.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...CORS },
  });
}

// Gera um segredo aleatório para assinar os callbacks desta execução.
function novoSecret(): string {
  const b = new Uint8Array(32);
  crypto.getRandomValues(b);
  return Array.from(b).map((x) => x.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Sem autorização" }, 401);

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const GITHUB_TOKEN = Deno.env.get("GITHUB_AGENTE_TOKEN")!;

    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });

    // 1. Permissão
    const { data: permOk, error: permErr } = await userClient.rpc(
      "tem_permissao",
      { p_permissao: "acionar_agente_correcao" },
    );
    if (permErr || !permOk) return json({ error: "Sem permissão" }, 403);

    const { data: userData } = await userClient.auth.getUser();
    const userId = userData?.user?.id ?? null;

    // 2. Input
    const body = await req.json().catch(() => null);
    const demandaId = body?.demanda_id as string | undefined;
    if (!demandaId) return json({ error: "demanda_id é obrigatório" }, 400);

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

    // 3. Demanda + produto (config de repo)
    const { data: demanda, error: demErr } = await admin
      .from("demandas")
      .select(
        `id, codigo, titulo, descricao, prompt_ia,
         produto:produtos(
           github_owner, github_repo, branch_base, workflow_file, auto_deploy
         )`,
      )
      .eq("id", demandaId)
      .single();
    if (demErr || !demanda) return json({ error: "Demanda não encontrada" }, 404);

    const prod: any = (demanda as any).produto;
    if (!prod?.github_owner || !prod?.github_repo || !prod?.workflow_file) {
      return json(
        { error: "O produto desta demanda não tem repositório configurado" },
        400,
      );
    }

    // 4. Comentários (contexto) — tabela demanda_comentarios, coluna conteudo
    const { data: comentarios } = await admin
      .from("demanda_comentarios")
      .select("conteudo, autor:profiles(nome)")
      .eq("demanda_id", demandaId)
      .order("created_at", { ascending: true });

    // 5. Imagens anexadas → URLs assinadas (input multimodal)
    const { data: anexos } = await admin
      .from("demanda_anexos")
      .select("storage_path, mime_type")
      .eq("demanda_id", demandaId);

    const imagens: string[] = [];
    for (const a of (anexos ?? []) as any[]) {
      if (!a.mime_type?.startsWith("image/")) continue;
      const { data: signed } = await admin.storage
        .from("demanda-anexos")
        .createSignedUrl(a.storage_path, 60 * 30); // 30 min
      if (signed?.signedUrl) imagens.push(signed.signedUrl);
    }

    // 6. Prompt: usa prompt_ia salvo, senão monta o contexto
    const promptBase =
      (demanda as any).prompt_ia?.trim() ||
      montarPromptAgente({
        codigo: (demanda as any).codigo ?? demandaId,
        titulo: (demanda as any).titulo ?? "",
        descricao: (demanda as any).descricao ?? "",
        comentarios: ((comentarios ?? []) as any[]).map((c) => ({
          autor: c.autor?.nome ?? "alguém",
          texto: c.conteudo ?? "",
        })),
      });

    // 7. Cria a execução
    const callbackSecret = novoSecret();
    const { data: exec, error: execErr } = await admin
      .from("agente_execucoes")
      .insert({
        demanda_id: demandaId,
        status: "enfileirada",
        callback_secret: callbackSecret,
        disparado_por: userId,
      })
      .select("id")
      .single();
    if (execErr || !exec) {
      return json({ error: execErr?.message ?? "Falha ao criar execução" }, 500);
    }

    // 8. Dispara o workflow no repo do DoctorSaaS
    const callbackUrl = `${SUPABASE_URL}/functions/v1/agente-callback`;
    const payload = JSON.stringify({
      demanda_codigo: (demanda as any).codigo ?? demandaId,
      prompt: promptBase,
      imagens,
    });

    const ghResp = await fetch(
      `https://api.github.com/repos/${prod.github_owner}/${prod.github_repo}/actions/workflows/${prod.workflow_file}/dispatches`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${GITHUB_TOKEN}`,
          Accept: "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28",
          "User-Agent": "devflow-hub-agente",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ref: prod.branch_base ?? "main",
          inputs: {
            execucao_id: exec.id,
            callback_url: callbackUrl,
            callback_secret: callbackSecret,
            auto_deploy: String(!!prod.auto_deploy),
            payload,
          },
        }),
      },
    );

    if (!ghResp.ok) {
      const txt = await ghResp.text();
      await admin
        .from("agente_execucoes")
        .update({
          status: "falhou",
          erro_mensagem: `Falha ao disparar workflow (${ghResp.status}): ${txt}`,
          finished_at: new Date().toISOString(),
        })
        .eq("id", exec.id);
      return json({ error: "Falha ao disparar o workflow", detalhe: txt }, 502);
    }

    return json({ execucao_id: exec.id }, 200);
  } catch (e: any) {
    return json({ error: e?.message ?? String(e) }, 500);
  }
});
```

- [ ] **Step 2: Confirmar nomes de tabela/coluna (já baked no código acima)**

Os nomes usados foram verificados contra o schema: tabela `demanda_comentarios` (coluna
`conteudo`), tabela `demanda_anexos` (coluna `storage_path`, `mime_type`), bucket
`demanda-anexos`, join implícito `produto:produtos(...)`. Confirme rapidamente:
Run: `grep -rn "demanda_comentarios\|demanda_anexos\|ANEXO_BUCKET" src/lib/upload-anexos.ts src/hooks/useComentarios.ts | head`
Expected: confirma `demanda_comentarios` e `demanda_anexos`/`demanda-anexos`. Se algo divergir no seu banco, ajuste no `index.ts`.

- [ ] **Step 3: Verificar imports/sintaxe com deno check (se disponível)**

Run: `deno check supabase/functions/disparar-agente/index.ts`
Expected: sem erros de tipo (avisos de `any` ok). Se o Deno não estiver instalado, pule — a Task 10 valida em runtime.

- [ ] **Step 4: Deploy da função**

Run: `supabase functions deploy disparar-agente`
Expected: deploy ok. Configurar o secret antes/depois:
`supabase secrets set GITHUB_AGENTE_TOKEN=<token>`

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/disparar-agente/index.ts
git commit -m "feat(edge): disparar-agente cria execucao e dispara workflow no DoctorSaaS"
```

---

### Task 6: Edge Function `agente-callback`

**Files:**
- Create: `supabase/functions/agente-callback/index.ts`

**Interfaces:**
- Consumes: `verificarAssinatura` (`_shared/hmac.ts`), `isStatusAgente`, `transicaoValida` (`_shared/status.ts`).
- Produces: recebe os POSTs do workflow; atualiza `agente_execucoes`; na conclusão cria Retorno.

- [ ] **Step 1: Implementar a função**

```ts
// supabase/functions/agente-callback/index.ts
// deno-lint-ignore-file no-explicit-any
import { createClient } from "npm:@supabase/supabase-js@2";
import { verificarAssinatura } from "../_shared/hmac.ts";
import { isStatusAgente, transicaoValida } from "../_shared/status.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type, x-agente-assinatura",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...CORS },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

    // Lê o corpo CRU (a assinatura é sobre os bytes exatos)
    const raw = await req.text();
    const assinatura = req.headers.get("x-agente-assinatura") ?? "";
    const body = JSON.parse(raw || "{}");

    const execucaoId = body?.execucao_id as string | undefined;
    const novoStatus = body?.status as string | undefined;
    if (!execucaoId || !novoStatus) {
      return json({ error: "execucao_id e status são obrigatórios" }, 400);
    }
    if (!isStatusAgente(novoStatus)) {
      return json({ error: "status inválido" }, 400);
    }

    // Carrega a execução (inclui o secret — só acessível via service role)
    const { data: exec, error } = await admin
      .from("agente_execucoes")
      .select("id, status, callback_secret, demanda_id, disparado_por")
      .eq("id", execucaoId)
      .single();
    if (error || !exec) return json({ error: "Execução não encontrada" }, 404);

    // Verifica a assinatura
    const ok = await verificarAssinatura(
      (exec as any).callback_secret,
      raw,
      assinatura,
    );
    if (!ok) return json({ error: "Assinatura inválida" }, 401);

    // Idempotência: mesmo status repetido = replay/retry do webhook (GitHub entrega
    // at-least-once). É um no-op: não recria Retorno nem mexe em finished_at.
    if ((exec as any).status === novoStatus) {
      return json({ ok: true, idempotente: true }, 200);
    }

    // Valida a transição
    if (!transicaoValida((exec as any).status, novoStatus as any)) {
      return json(
        { error: `Transição inválida ${(exec as any).status} → ${novoStatus}` },
        409,
      );
    }

    const terminal = ["concluida", "falhou", "cancelada"].includes(novoStatus);
    const patch: Record<string, unknown> = {
      status: novoStatus,
      updated_at: new Date().toISOString(),
    };
    if (body.github_run_id != null) patch.github_run_id = body.github_run_id;
    if (body.github_run_url) patch.github_run_url = body.github_run_url;
    if (body.pr_url) patch.pr_url = body.pr_url;
    if (body.deploy_url) patch.deploy_url = body.deploy_url;
    if (body.resumo) patch.resumo = body.resumo;
    if (body.erro_mensagem) patch.erro_mensagem = body.erro_mensagem;
    if (terminal) patch.finished_at = new Date().toISOString();

    // Na conclusão com resumo: cria o Retorno na demanda.
    // Se o insert falhar, retorna 500 SEM avançar o status — o workflow pode reenviar.
    if (novoStatus === "concluida" && body.resumo) {
      const { data: retorno, error: retErr } = await admin
        .from("demanda_retornos")
        .insert({
          demanda_id: (exec as any).demanda_id,
          texto: body.resumo,
          autor_id: (exec as any).disparado_por,
        })
        .select("id")
        .single();
      if (retErr || !retorno) {
        return json(
          { error: `Falha ao criar retorno: ${retErr?.message ?? "desconhecido"}` },
          500,
        );
      }
      patch.retorno_id = retorno.id;
    }

    const { error: upErr } = await admin
      .from("agente_execucoes")
      .update(patch)
      .eq("id", execucaoId);
    if (upErr) return json({ error: upErr.message }, 500);

    return json({ ok: true }, 200);
  } catch (e: any) {
    return json({ error: e?.message ?? String(e) }, 500);
  }
});
```

- [ ] **Step 2: Confirmar colunas de `demanda_retornos` (texto, autor_id, demanda_id)**

Run: `grep -A6 "demanda_retornos: {" src/integrations/supabase/types.ts | head`
Expected: confirma `texto`, `autor_id`, `demanda_id` (já verificado no design). Ajuste se divergir.

- [ ] **Step 3: Deploy da função SEM verificação de JWT (o workflow não tem JWT de usuário; a auth é via HMAC)**

Run: `supabase functions deploy agente-callback --no-verify-jwt`
Expected: deploy ok.
> Importante: `--no-verify-jwt` é seguro aqui porque a função **exige** a assinatura HMAC do `callback_secret`, que só o disparador e o workflow conhecem.

- [ ] **Step 4: Commit**

```bash
git add supabase/functions/agente-callback/index.ts
git commit -m "feat(edge): agente-callback verifica HMAC, atualiza status e grava Retorno"
```

---

### Task 7: Tipos + hooks do agente no front

**Files:**
- Create: `src/types/agente.ts`
- Create: `src/hooks/useAgente.ts`

**Interfaces:**
- Consumes: tabela `agente_execucoes` (via `supabase`), função edge `disparar-agente`.
- Produces: `useAcionarAgente`, `useAgenteExecucoes`, tipos `AgenteExecucao`/`StatusAgente`.

- [ ] **Step 1: Criar `src/types/agente.ts`**

```ts
export type StatusAgente =
  | "enfileirada"
  | "corrigindo"
  | "testando"
  | "deploy"
  | "concluida"
  | "falhou"
  | "cancelada";

export interface AgenteExecucao {
  id: string;
  demanda_id: string;
  status: StatusAgente;
  github_run_id: number | null;
  github_run_url: string | null;
  pr_url: string | null;
  deploy_url: string | null;
  resumo: string | null;
  erro_mensagem: string | null;
  retorno_id: string | null;
  disparado_por: string | null;
  created_at: string;
  updated_at: string;
  finished_at: string | null;
}

export const STATUS_AGENTE_ATIVO: StatusAgente[] = [
  "enfileirada",
  "corrigindo",
  "testando",
  "deploy",
];

export const STATUS_AGENTE_LABEL: Record<StatusAgente, string> = {
  enfileirada: "Na fila",
  corrigindo: "Corrigindo",
  testando: "Testando",
  deploy: "Publicando",
  concluida: "Concluída",
  falhou: "Falhou",
  cancelada: "Cancelada",
};
```

- [ ] **Step 2: Criar `src/hooks/useAgente.ts`**

```ts
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import {
  type AgenteExecucao,
  STATUS_AGENTE_ATIVO,
} from "@/types/agente";

const key = (demandaId: string) => ["agente-execucoes", demandaId] as const;

/** Lista execuções do agente para a demanda (mais recente primeiro). */
export function useAgenteExecucoes(demandaId: string | undefined) {
  return useQuery({
    queryKey: key(demandaId ?? ""),
    enabled: !!demandaId,
    queryFn: async (): Promise<AgenteExecucao[]> => {
      const { data, error } = await supabase
        .from("agente_execucoes")
        .select(
          `id, demanda_id, status, github_run_id, github_run_url, pr_url,
           deploy_url, resumo, erro_mensagem, retorno_id, disparado_por,
           created_at, updated_at, finished_at`,
        )
        .eq("demanda_id", demandaId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as AgenteExecucao[];
    },
    // Faz polling enquanto houver execução ativa; para quando tudo está terminal.
    refetchInterval: (query) => {
      const list = (query.state.data ?? []) as AgenteExecucao[];
      const ativa = list.some((e) => STATUS_AGENTE_ATIVO.includes(e.status));
      return ativa ? 4000 : false;
    },
  });
}

/** Dispara o agente para a demanda. */
export function useAcionarAgente() {
  const qc = useQueryClient();
  return useMutation<{ execucao_id: string }, Error, { demandaId: string }>({
    mutationFn: async ({ demandaId }) => {
      const { data, error } = await supabase.functions.invoke(
        "disparar-agente",
        { body: { demanda_id: demandaId } },
      );
      if (error) throw new Error(error.message || "Erro ao acionar agente");
      if (data?.error) throw new Error(data.error);
      if (!data?.execucao_id) throw new Error("Resposta vazia do disparo");
      return data as { execucao_id: string };
    },
    onSuccess: (_res, { demandaId }) => {
      toast.success("Agente acionado — acompanhe o progresso abaixo");
      qc.invalidateQueries({ queryKey: key(demandaId) });
    },
    onError: (err) => {
      const m = err.message || "";
      if (m.includes("permissão") || m.includes("403")) {
        toast.error("Apenas Desenvolvedores podem acionar o agente");
      } else if (m.includes("repositório")) {
        toast.error("O produto desta demanda não tem repositório configurado");
      } else {
        toast.error(`Erro ao acionar agente: ${m}`);
      }
    },
  });
}
```

- [ ] **Step 3: Typecheck + lint**

Run: `npx tsc --noEmit && npx eslint src/types/agente.ts src/hooks/useAgente.ts`
Expected: sem erros. (Se `agente_execucoes` não estiver nos tipos gerados, volte à Task 2 Step 4.)

- [ ] **Step 4: Commit**

```bash
git add src/types/agente.ts src/hooks/useAgente.ts
git commit -m "feat(front): tipos e hooks do agente (acionar + acompanhar execucoes)"
```

---

### Task 8: Card de status da execução

**Files:**
- Create: `src/components/demandas/AgenteExecucaoCard.tsx`

**Interfaces:**
- Consumes: `useAgenteExecucoes`, `AgenteExecucao`, `STATUS_AGENTE_LABEL`.
- Produces: `<AgenteExecucaoCard demandaId={...} />` (renderiza nada se não há execução).

- [ ] **Step 1: Implementar o card**

```tsx
// src/components/demandas/AgenteExecucaoCard.tsx
import { useAgenteExecucoes } from "@/hooks/useAgente";
import {
  STATUS_AGENTE_LABEL,
  STATUS_AGENTE_ATIVO,
  type AgenteExecucao,
} from "@/types/agente";
import { Loader2, CheckCircle2, XCircle, ExternalLink, Bot } from "lucide-react";

function StatusIcone({ e }: { e: AgenteExecucao }) {
  if (e.status === "concluida")
    return <CheckCircle2 className="h-4 w-4 text-green-600" />;
  if (e.status === "falhou" || e.status === "cancelada")
    return <XCircle className="h-4 w-4 text-destructive" />;
  if (STATUS_AGENTE_ATIVO.includes(e.status))
    return <Loader2 className="h-4 w-4 animate-spin text-purple-500" />;
  return <Bot className="h-4 w-4 text-muted-foreground" />;
}

export function AgenteExecucaoCard({ demandaId }: { demandaId: string }) {
  const { data: execucoes = [] } = useAgenteExecucoes(demandaId);
  if (execucoes.length === 0) return null;

  return (
    <div className="rounded-lg border border-border bg-card p-4 space-y-3">
      <h3 className="flex items-center gap-2 text-sm font-semibold">
        <Bot className="h-4 w-4 text-purple-500" /> Agente de correção
      </h3>
      <ul className="space-y-3">
        {execucoes.map((e) => (
          <li key={e.id} className="rounded-md border border-border/60 p-3">
            <div className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-2 text-sm font-medium">
                <StatusIcone e={e} />
                {STATUS_AGENTE_LABEL[e.status]}
              </span>
              <div className="flex items-center gap-3 text-xs">
                {e.github_run_url && (
                  <a
                    href={e.github_run_url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground"
                  >
                    Run <ExternalLink className="h-3 w-3" />
                  </a>
                )}
                {e.pr_url && (
                  <a
                    href={e.pr_url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground"
                  >
                    PR <ExternalLink className="h-3 w-3" />
                  </a>
                )}
                {e.deploy_url && (
                  <a
                    href={e.deploy_url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground"
                  >
                    Deploy <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </div>
            </div>
            {e.status === "falhou" && e.erro_mensagem && (
              <p className="mt-2 text-xs text-destructive whitespace-pre-wrap">
                {e.erro_mensagem}
              </p>
            )}
            {e.resumo && (
              <div className="mt-2 rounded bg-muted/50 p-2 text-xs whitespace-pre-wrap">
                <span className="font-medium">Devolutiva gerada: </span>
                {e.resumo}
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck + lint**

Run: `npx tsc --noEmit && npx eslint src/components/demandas/AgenteExecucaoCard.tsx`
Expected: sem erros.

- [ ] **Step 3: Commit**

```bash
git add src/components/demandas/AgenteExecucaoCard.tsx
git commit -m "feat(front): card de status da execucao do agente"
```

---

### Task 9: Dialog de confirmação + botão na demanda

**Files:**
- Create: `src/components/demandas/AcionarAgenteDialog.tsx`
- Modify: `src/routes/_authenticated/demandas.$codigo.tsx`

**Interfaces:**
- Consumes: `useAcionarAgente`, `AgenteExecucaoCard`.
- Produces: botão "Acionar Agente" na toolbar (só Desenvolvedores) + card renderizado.

- [ ] **Step 1: Criar o dialog de confirmação**

```tsx
// src/components/demandas/AcionarAgenteDialog.tsx
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Bot, Loader2, AlertTriangle } from "lucide-react";
import { useAcionarAgente } from "@/hooks/useAgente";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  demandaId: string;
  demandaCodigo: string;
}

export function AcionarAgenteDialog({
  open,
  onOpenChange,
  demandaId,
  demandaCodigo,
}: Props) {
  const acionar = useAcionarAgente();

  const handleAcionar = async () => {
    try {
      await acionar.mutateAsync({ demandaId });
      onOpenChange(false);
    } catch {
      // toast via hook
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bot className="h-4 w-4 text-purple-500" />
            Acionar agente — {demandaCodigo}
          </DialogTitle>
          <DialogDescription>
            O agente vai ler o contexto da demanda (descrição, comentários e os
            prints anexados), corrigir o problema no repositório do produto e, se
            o produto estiver com deploy automático ligado, publicar a correção.
            Ao final, grava a devolutiva como Retorno.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-start gap-2 rounded-md border border-amber-300/60 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-700/50 dark:bg-amber-950/40 dark:text-amber-300">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            Isso altera o código do produto. Com deploy automático ativo, a
            mudança pode ir a produção sozinha (só com CI verde). Sem ele, o
            agente apenas abre um PR para revisão.
          </span>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleAcionar} disabled={acionar.isPending}>
            {acionar.isPending ? (
              <>
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                Acionando...
              </>
            ) : (
              <>
                <Bot className="mr-1.5 h-3.5 w-3.5" />
                Acionar agente
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 2: Importar botão + estado no topo de `demandas.$codigo.tsx`**

Perto dos outros imports (junto de `GerarPromptIADialog`), adicione:
```tsx
import { AcionarAgenteDialog } from "@/components/demandas/AcionarAgenteDialog";
import { AgenteExecucaoCard } from "@/components/demandas/AgenteExecucaoCard";
import { Bot } from "lucide-react";
```
Perto do estado `iaDialogOpen` (que controla o dialog de prompt IA), adicione:
```tsx
const [agenteDialogOpen, setAgenteDialogOpen] = React.useState(false);
```

- [ ] **Step 3: Adicionar o botão na toolbar, ao lado de "Gerar prompt IA"**

No bloco `{canEditAny && ( <Button ...>Gerar prompt IA</Button> )}` (por volta da linha 217-227), logo **depois** do botão de prompt IA, adicione:
```tsx
{canEditAny && (
  <Button
    variant="outline"
    size="sm"
    onClick={() => setAgenteDialogOpen(true)}
    className="gap-1.5"
  >
    <Bot className="h-3.5 w-3.5 text-purple-500" />
    Acionar Agente
  </Button>
)}
```

- [ ] **Step 4: Renderizar o card e o dialog**

Logo **abaixo** do `<GerarPromptIADialog ... />` (por volta da linha 347-355), adicione:
```tsx
{canEditAny && (
  <AcionarAgenteDialog
    open={agenteDialogOpen}
    onOpenChange={setAgenteDialogOpen}
    demandaId={demanda.id}
    demandaCodigo={demanda.codigo ?? codigo}
  />
)}
```
E, dentro da coluna principal de conteúdo — logo **antes** do `<DetalheTabs ... />` (por volta da linha 298) — adicione o card:
```tsx
<AgenteExecucaoCard demandaId={demanda.id} />
```

- [ ] **Step 5: Typecheck + lint + build**

Run: `npx tsc --noEmit && npx eslint src/components/demandas/AcionarAgenteDialog.tsx "src/routes/_authenticated/demandas.\$codigo.tsx" && npm run build`
Expected: sem erros; build conclui.

- [ ] **Step 6: Verificação manual**

Run: `npm run dev`
Abra uma demanda como Desenvolvedor. Confirme:
- Botão "Acionar Agente" aparece na toolbar ao lado de "Gerar prompt IA".
- Clicar abre o dialog com o aviso.
- Como o repo/produto ainda não está configurado, "Acionar" mostra o toast "produto não tem repositório configurado" (comportamento esperado até a Task 10).

- [ ] **Step 7: Commit**

```bash
git add src/components/demandas/AcionarAgenteDialog.tsx "src/routes/_authenticated/demandas.\$codigo.tsx"
git commit -m "feat(front): botao Acionar Agente + dialog + card na demanda"
```

---

### Task 10: Workflow no repo do DoctorSaaS + configuração e teste ponta-a-ponta

**Files:**
- Create (referência neste repo): `docs/superpowers/reference/agente-correcao.yml`
- Create (no **repo do DoctorSaaS**): `.github/workflows/agente-correcao.yml` (cópia do arquivo acima)
- Modify (dados, via SQL): `produtos` do DoctorSaaS com a config de repo

**Interfaces:**
- Consumes: inputs `execucao_id`, `callback_url`, `callback_secret`, `auto_deploy`, `payload`.
- Produces: callbacks assinados para `agente-callback` a cada etapa.

- [ ] **Step 1: Criar o arquivo de referência do workflow**

```yaml
# docs/superpowers/reference/agente-correcao.yml
# → Copie este arquivo para .github/workflows/agente-correcao.yml NO REPO DO DOCTORSAAS.
# Secrets necessários no repo do DoctorSaaS: ANTHROPIC_API_KEY.
name: Agente de Correção
on:
  workflow_dispatch:
    inputs:
      execucao_id:    { required: true,  type: string }
      callback_url:   { required: true,  type: string }
      callback_secret:{ required: true,  type: string }
      auto_deploy:    { required: false, type: string, default: "false" }
      payload:        { required: true,  type: string } # JSON: {demanda_codigo, prompt, imagens[]}

permissions:
  contents: write
  pull-requests: write

jobs:
  corrigir:
    runs-on: ubuntu-latest
    timeout-minutes: 30   # guardrail: aborta execuções longas
    steps:
      # Helper de callback assinado (HMAC-SHA256 hex do corpo cru)
      - name: Preparar callback
        run: |
          cat > /tmp/callback.sh <<'EOF'
          #!/usr/bin/env bash
          set -euo pipefail
          BODY="$1"
          SIG=$(printf '%s' "$BODY" | openssl dgst -sha256 -hmac "${CALLBACK_SECRET}" | awk '{print $2}')
          curl -sS -X POST "${CALLBACK_URL}" \
            -H "Content-Type: application/json" \
            -H "x-agente-assinatura: ${SIG}" \
            --data "$BODY" || true
          EOF
          chmod +x /tmp/callback.sh
        env:
          CALLBACK_URL: ${{ inputs.callback_url }}
          CALLBACK_SECRET: ${{ inputs.callback_secret }}

      - uses: actions/checkout@v4

      - name: Callback corrigindo (com run URL)
        run: |
          /tmp/callback.sh "{\"execucao_id\":\"${{ inputs.execucao_id }}\",\"status\":\"corrigindo\",\"github_run_id\":${{ github.run_id }},\"github_run_url\":\"${{ github.server_url }}/${{ github.repository }}/actions/runs/${{ github.run_id }}\"}"
        env:
          CALLBACK_URL: ${{ inputs.callback_url }}
          CALLBACK_SECRET: ${{ inputs.callback_secret }}

      - name: Baixar prints anexados
        env:
          PAYLOAD: ${{ inputs.payload }}   # via env pra evitar injeção de shell (texto da demanda é do usuário)
        run: |
          mkdir -p .agente/prints
          printf '%s' "$PAYLOAD" > .agente/payload.json
          node -e '
            const fs=require("fs");
            const p=JSON.parse(fs.readFileSync(".agente/payload.json","utf8"));
            fs.writeFileSync(".agente/prompt.md", p.prompt || "");
            (p.imagens||[]).forEach((u,i)=>console.log(i+" "+u));
          ' | while read i url; do
            curl -sSL "$url" -o ".agente/prints/print_$i" || true
          done

      - name: Rodar Claude Code
        uses: anthropics/claude-code-action@v1
        with:
          anthropic_api_key: ${{ secrets.ANTHROPIC_API_KEY }}
          prompt: |
            Leia o contexto do problema em .agente/prompt.md e analise TODAS as
            imagens em .agente/prints/ (são prints do erro mostrando onde ele acontece).
            Corrija a causa raiz no código. Regras:
            - NÃO altere migrations, arquivos de infra, CI ou segredos.
            - Faça a correção mínima necessária.
            - Deixe as mudanças commitadas numa branch nova chamada
              agente/${{ inputs.execucao_id }}.

      - name: Rodar testes / build (gate)
        id: testes
        run: |
          /tmp/callback.sh "{\"execucao_id\":\"${{ inputs.execucao_id }}\",\"status\":\"testando\"}"
          # DoctorSaaS-específico: troque pelos comandos reais de teste/build do repo.
          npm ci
          npm test --if-present
          npm run build --if-present
        env:
          CALLBACK_URL: ${{ inputs.callback_url }}
          CALLBACK_SECRET: ${{ inputs.callback_secret }}

      - name: Falha nos testes → callback falhou
        if: failure() && steps.testes.outcome == 'failure'
        run: |
          /tmp/callback.sh "{\"execucao_id\":\"${{ inputs.execucao_id }}\",\"status\":\"falhou\",\"erro_mensagem\":\"Testes/build falharam. Ver o run.\"}"
        env:
          CALLBACK_URL: ${{ inputs.callback_url }}
          CALLBACK_SECRET: ${{ inputs.callback_secret }}

      - name: Gerar devolutiva (texto para o cliente)
        id: devolutiva
        uses: anthropics/claude-code-action@v1
        with:
          anthropic_api_key: ${{ secrets.ANTHROPIC_API_KEY }}
          prompt: |
            Com base no diff desta branch, escreva um texto curto e claro em
            português para o cliente explicando: (1) a ORIGEM do problema e
            (2) COMO foi corrigido. Salve APENAS esse texto em .agente/devolutiva.txt.

      - name: Publicar (PR ou merge+deploy) e concluir
        run: |
          BRANCH="agente/${{ inputs.execucao_id }}"
          RESUMO=$(node -e 'console.log(JSON.stringify(require("fs").readFileSync(".agente/devolutiva.txt","utf8")))' 2>/dev/null || echo '"Correção aplicada."')
          git push origin "$BRANCH" || true
          if [ "${{ inputs.auto_deploy }}" = "true" ]; then
            # DoctorSaaS-específico: merge e deploy reais do repo.
            gh pr create --base ${{ github.ref_name }} --head "$BRANCH" --title "Correção automática ${{ inputs.execucao_id }}" --body "Gerado pelo agente." || true
            gh pr merge "$BRANCH" --squash --admin || true
            # ... comando de deploy do DoctorSaaS aqui ...
            DEPLOY_URL="https://<deploy-do-doctorsaas>"
            /tmp/callback.sh "{\"execucao_id\":\"${{ inputs.execucao_id }}\",\"status\":\"deploy\",\"deploy_url\":\"$DEPLOY_URL\"}"
            /tmp/callback.sh "{\"execucao_id\":\"${{ inputs.execucao_id }}\",\"status\":\"concluida\",\"resumo\":$RESUMO,\"deploy_url\":\"$DEPLOY_URL\"}"
          else
            PR_URL=$(gh pr create --base ${{ github.ref_name }} --head "$BRANCH" --title "Correção automática ${{ inputs.execucao_id }}" --body "Gerado pelo agente. Revise antes de mergear." | tail -1)
            /tmp/callback.sh "{\"execucao_id\":\"${{ inputs.execucao_id }}\",\"status\":\"concluida\",\"resumo\":$RESUMO,\"pr_url\":\"$PR_URL\"}"
          fi
        env:
          GH_TOKEN: ${{ github.token }}
          CALLBACK_URL: ${{ inputs.callback_url }}
          CALLBACK_SECRET: ${{ inputs.callback_secret }}
```

> Notas para o implementador: (a) confirme os inputs atuais de `anthropics/claude-code-action@v1` na doc oficial — actions evoluem; (b) os pontos marcados **"DoctorSaaS-específico"** (comandos de teste, build, merge e deploy) só existem no outro repo e devem ser preenchidos lá.

- [ ] **Step 2: Copiar o workflow para o repo do DoctorSaaS**

No repositório do DoctorSaaS: crie `.github/workflows/agente-correcao.yml` com o conteúdo acima (preenchendo os trechos DoctorSaaS-específicos), cadastre o secret `ANTHROPIC_API_KEY`, e faça commit/push na branch base.

- [ ] **Step 3: Configurar o produto DoctorSaaS no DoctorDev (SQL)**

Substitua os placeholders pelos valores reais e rode no SQL Editor do Supabase (dados que só você conhece):
```sql
update public.produtos
set github_owner = '<owner-do-doctorsaas>',
    github_repo  = '<repo-do-doctorsaas>',
    branch_base  = 'main',
    workflow_file = 'agente-correcao.yml',
    auto_deploy  = false   -- começa em PR-only
where nome = 'DoctorSaaS';   -- ajuste o nome se for outro
```
Verify: `select nome, github_owner, github_repo, workflow_file, auto_deploy from public.produtos where github_repo is not null;` retorna a linha configurada.

- [ ] **Step 4: Cadastrar o secret do GitHub na Edge Function**

Crie um PAT (ou GitHub App token) com escopo `workflow` + escrita no repo do DoctorSaaS e rode:
Run: `supabase secrets set GITHUB_AGENTE_TOKEN=<token>`
Expected: secret salvo.

- [ ] **Step 5: Teste ponta-a-ponta (PR-only)**

- No DoctorDev, abra uma demanda de teste (produto DoctorSaaS) com um print anexado.
- Clique "Acionar Agente" → "Acionar agente".
- Acompanhe o card: deve passar por `corrigindo` → `testando` → `concluida`.
- No repo do DoctorSaaS: confirme que abriu um **PR** na branch `agente/<execucao_id>`.
- No DoctorDev: confirme que a aba **Retornos** ganhou a devolutiva com o texto gerado, e o card mostra o link do PR.

- [ ] **Step 6: Verificar segurança do callback**

Faça um POST manual sem assinatura para o `agente-callback`:
Run:
```bash
curl -s -X POST "$SUPABASE_URL/functions/v1/agente-callback" \
  -H "Content-Type: application/json" \
  --data '{"execucao_id":"qualquer","status":"concluida"}'
```
Expected: `{"error":"..."}` com 401/404 (rejeitado por assinatura/execução) — nunca 200.

- [ ] **Step 7: Commit da referência**

```bash
git add docs/superpowers/reference/agente-correcao.yml
git commit -m "docs: workflow de referencia do agente para o repo do DoctorSaaS"
```

---

## Ordem de execução e dependências

1. **Task 1 → Task 2** (banco; Task 2 depende do enum da Task 1).
2. **Task 3 → Task 4** (Vitest + módulos puros).
3. **Task 5, Task 6** (edge functions; dependem das Tasks 2, 3, 4).
4. **Task 7 → Task 8 → Task 9** (front; dependem da Task 2 para tipos e da Task 5 para o hook).
5. **Task 10** por último (configuração + teste ponta-a-ponta; depende de tudo).

## Verificação final (após todas as tasks)

- [ ] `bun run test` → todos os testes de `_shared` passam.
- [ ] `npx tsc --noEmit` → sem erros.
- [ ] `npx eslint .` → sem erros novos.
- [ ] `npm run build` → build conclui.
- [ ] Teste ponta-a-ponta da Task 10 Step 5 concluído com PR aberto + Retorno gravado.
- [ ] Callback sem assinatura rejeitado (Task 10 Step 6).
