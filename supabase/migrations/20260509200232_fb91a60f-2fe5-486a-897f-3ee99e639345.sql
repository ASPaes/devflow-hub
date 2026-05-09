create table if not exists public.demanda_emails_enviados (
  id uuid primary key default gen_random_uuid(),
  demanda_id uuid not null references public.demandas(id) on delete cascade,
  email_destinatario text not null,
  nome_destinatario text,
  assunto text not null,
  corpo_texto text not null,
  enviado_por uuid references public.profiles(id) on delete set null,
  enviado_em timestamptz not null default now(),
  status text not null default 'enviado',
  erro_detalhe text
);

create index if not exists idx_emails_enviados_demanda
  on public.demanda_emails_enviados(demanda_id, enviado_em desc);

comment on table public.demanda_emails_enviados is
  'Histórico de emails enviados aos solicitantes ao finalizar demandas.';

alter table public.demanda_emails_enviados enable row level security;

drop policy if exists emails_enviados_select on public.demanda_emails_enviados;
create policy emails_enviados_select on public.demanda_emails_enviados
for select using (
  exists (
    select 1 from public.demandas d
    where d.id = demanda_emails_enviados.demanda_id
      and d.deleted_at is null
      and (
        public.tem_permissao('ver_demandas')
        or public.tem_permissao('ver_todas_demandas')
        or d.solicitante_id = (select auth.uid())
      )
  )
);

drop policy if exists emails_enviados_insert on public.demanda_emails_enviados;
create policy emails_enviados_insert on public.demanda_emails_enviados
for insert with check (false);

create or replace function public.registrar_email_demanda(
  p_demanda_id uuid,
  p_email_destinatario text,
  p_nome_destinatario text,
  p_assunto text,
  p_corpo_texto text,
  p_status text default 'enviado',
  p_erro_detalhe text default null
)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_user_id uuid := auth.uid();
  v_email_id uuid;
  v_comentario_texto text;
  v_data_br text;
begin
  if v_user_id is null then
    raise exception 'Não autenticado';
  end if;

  if not public.tem_permissao('editar_qualquer_demanda') then
    raise exception 'Sem permissão para enviar emails';
  end if;

  insert into public.demanda_emails_enviados (
    demanda_id, email_destinatario, nome_destinatario,
    assunto, corpo_texto, enviado_por, status, erro_detalhe
  ) values (
    p_demanda_id, p_email_destinatario, p_nome_destinatario,
    p_assunto, p_corpo_texto, v_user_id, p_status, p_erro_detalhe
  ) returning id into v_email_id;

  if p_status = 'enviado' then
    v_data_br := to_char(now() at time zone 'America/Sao_Paulo', 'DD/MM/YYYY HH24:MI');
    v_comentario_texto := format(
      '📧 Email enviado pra %s (%s) em %s',
      coalesce(p_nome_destinatario, 'destinatário'),
      p_email_destinatario,
      v_data_br
    );

    insert into public.demanda_comentarios (
      demanda_id, autor_id, conteudo
    ) values (
      p_demanda_id, v_user_id, v_comentario_texto
    );
  end if;

  return v_email_id;
end;
$$;

comment on function public.registrar_email_demanda is
  'Registra envio de email pro solicitante + cria comentário automático na demanda.';

create or replace function public.obter_dados_email_demanda(p_demanda_id uuid)
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
      'status', d.status::text
    ),
    'empresa', t.nome,
    'solicitante', jsonb_build_object(
      'id', sol.id,
      'nome', sol.nome,
      'email', u.email
    ),
    'ultimo_retorno', (
      select jsonb_build_object(
        'texto', r.texto,
        'autor_nome', rp.nome,
        'created_at', r.created_at
      )
      from public.demanda_retornos r
      left join public.profiles rp on rp.id = r.autor_id
      where r.demanda_id = p_demanda_id
        and r.texto is not null
        and length(trim(r.texto)) > 0
      order by r.created_at desc
      limit 1
    )
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