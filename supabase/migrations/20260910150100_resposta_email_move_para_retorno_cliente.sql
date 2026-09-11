-- Resposta do cliente por e-mail move a demanda para "Retorno do Cliente".
-- Depende de 20260910150000 (valor do enum já commitado).
--
-- Antes: a resposta virava comentário e a demanda ficava onde estava. Em
-- Entregue, o close_expired_demands encerrava 14 dias depois com a resposta
-- sem ninguém ler (DEM-0271, DEM-0297 em ago/2026).

-- ──────────────────────────────────────────────────────────────────────
-- 1) Carimbos de status
-- ──────────────────────────────────────────────────────────────────────

create or replace function public.set_status_timestamps()
 returns trigger
 language plpgsql
 set search_path to 'public'
as $function$
begin
  if new.status = 'entregue' and (old.status is distinct from 'entregue') then
    -- Voltou do Retorno do Cliente sem passar por trabalho novo: a entrega
    -- continua sendo a original. Horas Dev conta pelo mês de delivered_at, e
    -- regravar aqui mudaria a hora de mês só porque o cliente respondeu.
    if old.status = 'retorno_cliente' and old.delivered_at is not null then
      new.delivered_at := old.delivered_at;
    else
      new.delivered_at := now();
    end if;
    new.reopen_deadline := now() + interval '14 days';
  end if;

  if new.status = 'encerrada' and (old.status is distinct from 'encerrada') then
    new.closed_at := now();
  end if;

  -- Cliente respondeu uma demanda encerrada: ela deixa de estar fechada.
  if new.status = 'retorno_cliente' and (old.status is distinct from 'retorno_cliente') then
    new.closed_at := null;
  end if;

  return new;
end;
$function$;

-- ──────────────────────────────────────────────────────────────────────
-- 2) Ingestão da resposta: além do comentário, move a demanda
-- ──────────────────────────────────────────────────────────────────────

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
  v_status_demanda public.status_demanda;
  v_movida_de text;
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

    -- Demanda parada (esperando o cliente, ou já entregue/encerrada) volta
    -- para a vista do time, no topo da coluna Retorno do Cliente. Demanda em
    -- andamento fica onde está: o comentário acima já basta.
    select d.status into v_status_demanda
    from public.demandas d
    where d.id = p_demanda_id
    for update;

    if v_status_demanda in ('aguardando_cliente', 'entregue', 'encerrada') then
      update public.demandas
         set status = 'retorno_cliente',
             posicao = coalesce(
               (select min(d2.posicao) from public.demandas d2
                 where d2.status = 'retorno_cliente' and d2.deleted_at is null),
               2000
             ) - 1000
       where id = p_demanda_id;

      -- log_demanda_changes não grava sem auth.uid() (aqui é service_role);
      -- o histórico sai daqui, em nome de quem respondeu.
      insert into public.demanda_historico (demanda_id, autor_id, campo, valor_anterior, valor_novo)
      values (p_demanda_id, v_perfil_id, 'status', v_status_demanda::text, 'retorno_cliente');

      v_movida_de := v_status_demanda::text;
    end if;
  end if;

  return jsonb_build_object(
    'id', v_id,
    'duplicada', false,
    'confiavel', v_confiavel,
    'movida_de', v_movida_de
  );
end;
$$;

-- Só o leitor de IMAP (service_role) chama. A migration de 06/08 revogou de
-- PUBLIC, mas os default privileges já tinham dado EXECUTE a anon e
-- authenticated: com a chave pública dava para forjar resposta de cliente
-- (e, a partir daqui, mover a demanda).
revoke execute on function public.registrar_resposta_cliente_demanda(
  uuid, text, text, text, text, text, text, text, timestamptz
) from public, anon, authenticated;
grant execute on function public.registrar_resposta_cliente_demanda(
  uuid, text, text, text, text, text, text, text, timestamptz
) to service_role;

-- ──────────────────────────────────────────────────────────────────────
-- 3) A resposta que já está esperando
-- ──────────────────────────────────────────────────────────────────────
-- Demanda em Entregue com resposta confiável posterior à entrega (em
-- 10/09/2026: só a DEM-0379). As encerradas de agosto ficam como estão:
-- reabrir conversa de um mês atrás é decisão de quem atende.

with alvo as (
  select d.id,
         (select p.id
            from public.profiles p
            join auth.users u on u.id = p.id
           where lower(u.email) = r.remetente_email
           limit 1) as autor_id
  from public.demandas d
  join lateral (
    select c.remetente_email, c.enviado_em
    from public.demanda_comunicacoes c
    where c.demanda_id = d.id
      and c.direcao = 'entrada'
      and c.status = 'recebido'
    order by c.enviado_em desc
    limit 1
  ) r on true
  where d.status = 'entregue'
    and d.deleted_at is null
    and d.delivered_at is not null
    and r.enviado_em > d.delivered_at
),
movidas as (
  update public.demandas d
     set status = 'retorno_cliente',
         posicao = coalesce(
           (select min(d2.posicao) from public.demandas d2
             where d2.status = 'retorno_cliente' and d2.deleted_at is null),
           2000
         ) - 1000
    from alvo
   where d.id = alvo.id
  returning d.id
)
insert into public.demanda_historico (demanda_id, autor_id, campo, valor_anterior, valor_novo)
select alvo.id, alvo.autor_id, 'status', 'entregue', 'retorno_cliente'
from alvo
join movidas on movidas.id = alvo.id;
