-- Resposta do cliente por e-mail entra na demanda.
-- Passo 1/4 — schema + RPC de ingestão. Nada aqui lê caixa de e-mail.
--
-- Hoje demanda_comunicacoes só guarda o que SAI (notificar-cliente-demanda).
-- Aqui ela passa a guardar os dois sentidos e ganha a RPC que o leitor de IMAP
-- (passo 3) chama com service_role.

-- ──────────────────────────────────────────────────────────────────────
-- 1) demanda_comunicacoes: os dois sentidos
-- ──────────────────────────────────────────────────────────────────────

alter table public.demanda_comunicacoes
  add column if not exists direcao text not null default 'saida',
  add column if not exists message_id text,
  add column if not exists in_reply_to text,
  add column if not exists remetente_email text,
  add column if not exists remetente_nome text,
  add column if not exists recebido_em timestamptz;

comment on column public.demanda_comunicacoes.direcao is
  'saida = enviado ao cliente; entrada = resposta do cliente.';
comment on column public.demanda_comunicacoes.enviado_em is
  'Quando a mensagem foi mandada — pelo agente (saida) ou pelo cliente (entrada: o Date do e-mail). É por ela que a timeline ordena.';
comment on column public.demanda_comunicacoes.recebido_em is
  'Quando o leitor de IMAP ingeriu a resposta. Nulo na saída.';
comment on column public.demanda_comunicacoes.message_id is
  'Message-ID RFC 5322. Na entrada é o do e-mail do cliente e é a chave de deduplicação.';
comment on column public.demanda_comunicacoes.in_reply_to is
  'Message-ID que a resposta cita. Guardado para diagnóstico — a correlação real vem do token no endereço.';

alter table public.demanda_comunicacoes
  drop constraint if exists demanda_comunicacoes_direcao_chk;
alter table public.demanda_comunicacoes
  add constraint demanda_comunicacoes_direcao_chk
  check (direcao in ('saida', 'entrada'));

-- Na entrada o destinatário somos nós; o que não pode faltar é o remetente.
alter table public.demanda_comunicacoes
  drop constraint if exists demanda_comunicacoes_destinatario_chk;
alter table public.demanda_comunicacoes
  add constraint demanda_comunicacoes_destinatario_chk
  check (
    (direcao = 'entrada' and remetente_email is not null)
    or (direcao = 'saida' and canal = 'email' and email_destinatario is not null)
    or (direcao = 'saida' and canal = 'whatsapp' and telefone_destinatario is not null)
  );

-- A mesma mensagem não entra duas vezes, mesmo se o leitor rodar sobreposto.
create unique index if not exists ux_demanda_comunicacoes_message_id
  on public.demanda_comunicacoes (message_id)
  where message_id is not null;

-- ──────────────────────────────────────────────────────────────────────
-- 2) Estado do leitor de IMAP
-- ──────────────────────────────────────────────────────────────────────
-- Uma linha só. O leitor avança por UID em vez de mexer na flag \Seen: a caixa
-- é de gente, robô não pode marcar e-mail como lido. uidvalidity diferente do
-- guardado = a caixa foi recriada e os UIDs antigos não valem mais.

create table if not exists public.email_ingestao_estado (
  id smallint primary key default 1,
  uidvalidity bigint,
  ultimo_uid bigint not null default 0,
  ultima_execucao timestamptz,
  ultimo_erro text,
  constraint email_ingestao_estado_linha_unica check (id = 1)
);

comment on table public.email_ingestao_estado is
  'Marca d''água do leitor de respostas por e-mail (edge function ler-respostas-email).';

insert into public.email_ingestao_estado (id) values (1)
on conflict (id) do nothing;

-- Sem policy: só service_role, que ignora RLS, enxerga.
alter table public.email_ingestao_estado enable row level security;

-- ──────────────────────────────────────────────────────────────────────
-- 3) Ingestão da resposta
-- ──────────────────────────────────────────────────────────────────────
-- Chamada só pelo leitor, com service_role — não existe auth.uid() aqui.
--
-- Anti-spoof: o token que amarra a resposta viaja num endereço de e-mail, ou
-- seja, é público para quem já recebeu uma mensagem nossa. Então o remetente é
-- conferido contra a demanda: e-mail desconhecido fica gravado como
-- 'recebido_suspeito' e NÃO vira comentário na demanda. Nada é descartado.

create or replace function public.registrar_resposta_cliente_demanda(
  p_demanda_id uuid,
  p_corpo_texto text,
  p_remetente_email text,
  p_remetente_nome text default null,
  p_assunto text default null,
  p_message_id text default null,
  p_in_reply_to text default null,
  p_email_destinatario text default null,
  p_enviado_em timestamptz default now()
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_id uuid;
  v_email text := lower(trim(coalesce(p_remetente_email, '')));
  v_quando timestamptz := coalesce(p_enviado_em, now());
  v_perfil_id uuid;
  v_solicitante_id uuid;
  v_tenant_id uuid;
  v_confiavel boolean := false;
  v_status text;
  v_trecho text;
begin
  if p_demanda_id is null then
    raise exception 'demanda_id obrigatório';
  end if;
  if coalesce(trim(p_corpo_texto), '') = '' then
    raise exception 'Corpo da resposta vazio';
  end if;
  if v_email = '' then
    raise exception 'Remetente obrigatório';
  end if;

  select d.solicitante_id, d.tenant_id
    into v_solicitante_id, v_tenant_id
  from public.demandas d
  where d.id = p_demanda_id
    and d.deleted_at is null;

  if not found then
    raise exception 'Demanda não encontrada ou excluída: %', p_demanda_id;
  end if;

  -- Idempotente: o leitor pode reprocessar a mesma mensagem.
  if p_message_id is not null then
    select c.id into v_id
    from public.demanda_comunicacoes c
    where c.message_id = p_message_id;

    if v_id is not null then
      return jsonb_build_object('id', v_id, 'duplicada', true);
    end if;
  end if;

  -- Quem respondeu, se for usuário conhecido do DoctorDev
  select p.id into v_perfil_id
  from public.profiles p
  join auth.users u on u.id = p.id
  where lower(u.email) = v_email
  limit 1;

  v_confiavel := v_perfil_id is not null
    and (
      v_perfil_id = v_solicitante_id
      or exists (
        select 1 from public.profiles p2
        where p2.id = v_perfil_id
          and p2.tenant_id = v_tenant_id
      )
    );

  v_status := case when v_confiavel then 'recebido' else 'recebido_suspeito' end;

  insert into public.demanda_comunicacoes (
    demanda_id, canal, direcao, corpo_texto, assunto,
    remetente_email, remetente_nome, email_destinatario,
    message_id, in_reply_to, enviado_em, recebido_em, status
  ) values (
    p_demanda_id, 'email', 'entrada', p_corpo_texto, p_assunto,
    v_email, nullif(trim(coalesce(p_remetente_nome, '')), ''), p_email_destinatario,
    p_message_id, p_in_reply_to, v_quando, now(), v_status
  )
  returning id into v_id;

  if v_confiavel then
    v_trecho := left(p_corpo_texto, 1500);
    if length(p_corpo_texto) > 1500 then
      v_trecho := v_trecho || '…';
    end if;

    insert into public.demanda_comentarios (demanda_id, autor_id, conteudo)
    values (
      p_demanda_id,
      v_perfil_id,
      format(
        '📩 Resposta por e-mail em %s:%s%s',
        to_char(v_quando at time zone 'America/Sao_Paulo', 'DD/MM/YYYY HH24:MI'),
        chr(10) || chr(10),
        v_trecho
      )
    );
  end if;

  return jsonb_build_object('id', v_id, 'duplicada', false, 'confiavel', v_confiavel);
end;
$$;

comment on function public.registrar_resposta_cliente_demanda is
  'Grava a resposta do cliente na demanda (demanda_comunicacoes direcao=entrada) e cria o comentário automático quando o remetente confere. Só service_role.';

-- ──────────────────────────────────────────────────────────────────────
-- 4) Grants
-- ──────────────────────────────────────────────────────────────────────
-- Ninguém autenticado chama isso direto: só o leitor, com service_role.

revoke all on function public.registrar_resposta_cliente_demanda(
  uuid, text, text, text, text, text, text, text, timestamptz
) from public;
grant execute on function public.registrar_resposta_cliente_demanda(
  uuid, text, text, text, text, text, text, text, timestamptz
) to service_role;
