-- Resposta do cliente por e-mail entra na demanda.
-- Passo 2/4 — o token que amarra a resposta ao envio.
--
-- O envio passa a mandar Reply-To: <caixa>+r<token>@<dominio>. O token é
-- aleatório (64 bits), fica guardado na linha do envio, e é por ele que o
-- leitor (passo 3) descobre a qual demanda a resposta pertence — sem depender
-- do código da demanda, que é adivinhável.

alter table public.demanda_comunicacoes
  add column if not exists reply_token text;

comment on column public.demanda_comunicacoes.reply_token is
  'Token aleatório embutido no Reply-To do e-mail enviado. É a chave que liga a resposta do cliente a esta demanda. Nulo no WhatsApp e nas entradas.';

create unique index if not exists ux_demanda_comunicacoes_reply_token
  on public.demanda_comunicacoes (reply_token)
  where reply_token is not null;

-- ──────────────────────────────────────────────────────────────────────
-- registrar_comunicacao_demanda ganha p_reply_token
-- ──────────────────────────────────────────────────────────────────────
-- A assinatura antiga (10 args) sai de cena para não virar overload ambíguo
-- no PostgREST. O resto do corpo é idêntico ao de 05/08.

drop function if exists public.registrar_comunicacao_demanda(
  uuid, text, text, text, text, text, text, text, text, text
);

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
  p_provider_message_id text default null,
  p_reply_token text default null
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
    status, erro_detalhe, provider_message_id, reply_token
  ) values (
    p_demanda_id, p_canal, p_email_destinatario, p_telefone_destinatario,
    p_nome_destinatario, p_assunto, p_corpo_texto, v_user_id,
    p_status, p_erro_detalhe, p_provider_message_id,
    -- Envio que falhou não deixa token vivo: ninguém vai responder.
    case when p_status = 'enviado' then p_reply_token else null end
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
  'Registra a comunicação enviada ao solicitante (e-mail ou WhatsApp), guarda o reply_token do e-mail e cria o comentário automático na demanda.';

revoke all on function public.registrar_comunicacao_demanda(
  uuid, text, text, text, text, text, text, text, text, text, text
) from public;
grant execute on function public.registrar_comunicacao_demanda(
  uuid, text, text, text, text, text, text, text, text, text, text
) to authenticated, service_role;

-- ──────────────────────────────────────────────────────────────────────
-- Resolver o token → demanda (usado pelo leitor, com service_role)
-- ──────────────────────────────────────────────────────────────────────

create or replace function public.resolver_reply_token(p_token text)
returns jsonb
language sql
security definer
set search_path to 'public'
stable
as $$
  select jsonb_build_object(
    'comunicacao_id', c.id,
    'demanda_id', c.demanda_id,
    'demanda_codigo', d.codigo,
    'email_destinatario', c.email_destinatario
  )
  from public.demanda_comunicacoes c
  join public.demandas d on d.id = c.demanda_id and d.deleted_at is null
  where c.reply_token = p_token
  limit 1;
$$;

comment on function public.resolver_reply_token is
  'Traduz o token do Reply-To na demanda de origem. Só service_role (leitor de e-mail).';

revoke all on function public.resolver_reply_token(text) from public;
grant execute on function public.resolver_reply_token(text) to service_role;
