-- Comunicar o cliente (e-mail / WhatsApp) ao registrar parecer e ao entregar a demanda.
-- Passo 1/4 — schema + RPCs. Nada aqui dispara envio.
--
-- Contexto: a migration de 09/05/2026 criou demanda_emails_enviados +
-- registrar_email_demanda + obter_dados_email_demanda e a feature nunca foi
-- concluída (não existe frontend nem edge function de envio). Esta migration
-- reaproveita a tabela, generaliza para os dois canais e substitui as duas
-- RPCs órfãs.

-- ──────────────────────────────────────────────────────────────────────
-- 1) Telefone do usuário — destinatário do WhatsApp
-- ──────────────────────────────────────────────────────────────────────

alter table public.profiles
  add column if not exists telefone text;

comment on column public.profiles.telefone is
  'WhatsApp do usuário: só dígitos, com DDI (ex: 5511999998888). Preenchido no /perfil, no admin de usuários ou no próprio envio da comunicação.';

-- ──────────────────────────────────────────────────────────────────────
-- 2) demanda_emails_enviados → demanda_comunicacoes (e-mail + WhatsApp)
-- ──────────────────────────────────────────────────────────────────────

alter table public.demanda_emails_enviados rename to demanda_comunicacoes;
alter index if exists idx_emails_enviados_demanda
  rename to idx_demanda_comunicacoes_demanda;

alter table public.demanda_comunicacoes
  add column if not exists canal text not null default 'email',
  add column if not exists telefone_destinatario text,
  add column if not exists provider_message_id text;

-- WhatsApp não tem assunto nem e-mail de destino
alter table public.demanda_comunicacoes
  alter column email_destinatario drop not null,
  alter column assunto drop not null;

alter table public.demanda_comunicacoes
  drop constraint if exists demanda_comunicacoes_canal_chk;
alter table public.demanda_comunicacoes
  add constraint demanda_comunicacoes_canal_chk
  check (canal in ('email', 'whatsapp'));

-- Cada canal exige o seu destinatário
alter table public.demanda_comunicacoes
  drop constraint if exists demanda_comunicacoes_destinatario_chk;
alter table public.demanda_comunicacoes
  add constraint demanda_comunicacoes_destinatario_chk
  check (
    (canal = 'email' and email_destinatario is not null)
    or (canal = 'whatsapp' and telefone_destinatario is not null)
  );

comment on table public.demanda_comunicacoes is
  'Histórico de comunicações enviadas ao solicitante (e-mail e WhatsApp) com parecer/conclusão da demanda.';
comment on column public.demanda_comunicacoes.provider_message_id is
  'ID da mensagem no provedor (Evolution, no caso do WhatsApp). Nulo para e-mail.';

-- RLS: mesma regra de antes, renomeando as policies
alter table public.demanda_comunicacoes enable row level security;

drop policy if exists emails_enviados_select on public.demanda_comunicacoes;
drop policy if exists demanda_comunicacoes_select on public.demanda_comunicacoes;
create policy demanda_comunicacoes_select on public.demanda_comunicacoes
for select using (
  exists (
    select 1 from public.demandas d
    where d.id = demanda_comunicacoes.demanda_id
      and d.deleted_at is null
      and (
        public.tem_permissao('ver_demandas')
        or public.tem_permissao('ver_todas_demandas')
        or d.solicitante_id = (select auth.uid())
      )
  )
);

-- Escrita só pela RPC (security definer)
drop policy if exists emails_enviados_insert on public.demanda_comunicacoes;
drop policy if exists demanda_comunicacoes_insert on public.demanda_comunicacoes;
create policy demanda_comunicacoes_insert on public.demanda_comunicacoes
for insert with check (false);

-- ──────────────────────────────────────────────────────────────────────
-- 3) RPCs órfãs de 09/05 saem de cena
-- ──────────────────────────────────────────────────────────────────────

drop function if exists public.registrar_email_demanda(uuid, text, text, text, text, text, text);
drop function if exists public.obter_dados_email_demanda(uuid);

-- ──────────────────────────────────────────────────────────────────────
-- 4) Contexto para a IA montar a mensagem
-- ──────────────────────────────────────────────────────────────────────
-- Diferente da antiga obter_dados_email_demanda, que devolvia só o ÚLTIMO
-- retorno: a IA precisa do parecer inteiro para redigir a conclusão.

create or replace function public.obter_dados_comunicacao_demanda(p_demanda_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_user_id uuid := auth.uid();
  v_resultado jsonb;
begin
  if v_user_id is null then
    raise exception 'Não autenticado';
  end if;

  if not public.tem_permissao('editar_qualquer_demanda') then
    raise exception 'Sem permissão';
  end if;

  select jsonb_build_object(
    'demanda', jsonb_build_object(
      'id', d.id,
      'codigo', d.codigo,
      'titulo', d.titulo,
      'descricao', d.descricao,
      'status', d.status::text,
      'tipo', d.tipo::text,
      'delivered_at', d.delivered_at
    ),
    'empresa', t.nome,
    'solicitante', jsonb_build_object(
      'id', sol.id,
      'nome', sol.nome,
      'email', u.email,
      'telefone', sol.telefone
    ),
    'retornos', coalesce((
      select jsonb_agg(
               jsonb_build_object(
                 'texto', r.texto,
                 'autor_nome', rp.nome,
                 'created_at', r.created_at
               )
               order by r.created_at
             )
      from public.demanda_retornos r
      left join public.profiles rp on rp.id = r.autor_id
      where r.demanda_id = p_demanda_id
        and r.texto is not null
        and length(trim(r.texto)) > 0
    ), '[]'::jsonb),
    'envios', coalesce((
      select jsonb_agg(
               jsonb_build_object(
                 'id', c.id,
                 'canal', c.canal,
                 'status', c.status,
                 'enviado_em', c.enviado_em,
                 'destinatario', coalesce(c.email_destinatario, c.telefone_destinatario)
               )
               order by c.enviado_em desc
             )
      from public.demanda_comunicacoes c
      where c.demanda_id = p_demanda_id
    ), '[]'::jsonb)
  )
  into v_resultado
  from public.demandas d
  left join public.tenants t on t.id = d.tenant_id
  left join public.profiles sol on sol.id = d.solicitante_id
  left join auth.users u on u.id = sol.id
  where d.id = p_demanda_id
    and d.deleted_at is null;

  if v_resultado is null then
    raise exception 'Demanda não encontrada';
  end if;

  return v_resultado;
end;
$$;

comment on function public.obter_dados_comunicacao_demanda is
  'Contexto da demanda (dados, solicitante, retornos, envios anteriores) para gerar e enviar a comunicação ao cliente.';

-- ──────────────────────────────────────────────────────────────────────
-- 5) Registro do envio + comentário automático na demanda
-- ──────────────────────────────────────────────────────────────────────

create or replace function public.registrar_comunicacao_demanda(
  p_demanda_id uuid,
  p_canal text,
  p_corpo_texto text,
  p_email_destinatario text default null,
  p_telefone_destinatario text default null,
  p_nome_destinatario text default null,
  p_assunto text default null,
  p_status text default 'enviado',
  p_erro_detalhe text default null,
  p_provider_message_id text default null
)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_user_id uuid := auth.uid();
  v_id uuid;
  v_comentario text;
  v_data_br text;
  v_destino text;
begin
  if v_user_id is null then
    raise exception 'Não autenticado';
  end if;

  if not public.tem_permissao('editar_qualquer_demanda') then
    raise exception 'Sem permissão para comunicar o cliente';
  end if;

  if p_canal not in ('email', 'whatsapp') then
    raise exception 'Canal inválido: %', p_canal;
  end if;

  insert into public.demanda_comunicacoes (
    demanda_id, canal, email_destinatario, telefone_destinatario,
    nome_destinatario, assunto, corpo_texto, enviado_por,
    status, erro_detalhe, provider_message_id
  ) values (
    p_demanda_id, p_canal, p_email_destinatario, p_telefone_destinatario,
    p_nome_destinatario, p_assunto, p_corpo_texto, v_user_id,
    p_status, p_erro_detalhe, p_provider_message_id
  ) returning id into v_id;

  if p_status = 'enviado' then
    v_data_br := to_char(now() at time zone 'America/Sao_Paulo', 'DD/MM/YYYY HH24:MI');
    v_destino := coalesce(p_email_destinatario, p_telefone_destinatario);

    v_comentario := format(
      '%s %s enviado pra %s (%s) em %s',
      case when p_canal = 'email' then '📧' else '💬' end,
      case when p_canal = 'email' then 'E-mail' else 'WhatsApp' end,
      coalesce(p_nome_destinatario, 'destinatário'),
      v_destino,
      v_data_br
    );

    insert into public.demanda_comentarios (demanda_id, autor_id, conteudo)
    values (p_demanda_id, v_user_id, v_comentario);
  end if;

  return v_id;
end;
$$;

comment on function public.registrar_comunicacao_demanda is
  'Registra a comunicação enviada ao solicitante (e-mail ou WhatsApp) e cria o comentário automático na demanda.';

-- ──────────────────────────────────────────────────────────────────────
-- 6) Grants
-- ──────────────────────────────────────────────────────────────────────

revoke all on function public.obter_dados_comunicacao_demanda(uuid) from public;
grant execute on function public.obter_dados_comunicacao_demanda(uuid)
  to authenticated, service_role;

revoke all on function public.registrar_comunicacao_demanda(
  uuid, text, text, text, text, text, text, text, text, text
) from public;
grant execute on function public.registrar_comunicacao_demanda(
  uuid, text, text, text, text, text, text, text, text, text
) to authenticated, service_role;
