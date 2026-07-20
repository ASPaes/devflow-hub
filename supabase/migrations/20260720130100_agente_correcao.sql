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

-- 5. Nunca expor o callback_secret para o cliente
revoke select (callback_secret) on public.agente_execucoes from anon, authenticated;

-- 6. Grant da permissão ao perfil Desenvolvedor
update public.perfis_acesso
  set permissoes = array_append(permissoes, 'acionar_agente_correcao'::public.app_permissao)
  where nome = 'Desenvolvedor'
    and not ('acionar_agente_correcao' = any(permissoes));
