-- Horas Dev: a hora passa a contar no mes da ENTREGA da demanda, nao no dia
-- em que foi apontada. Vale so para apontamento a partir de 01/09/2026 --
-- nada do passado muda de lugar.
--
-- Por que nao usar demandas.delivered_at direto: o trigger set_status_timestamps
-- reescreve delivered_at a cada nova entrega (a condicao e old.status is distinct
-- from 'entregue', nao delivered_at is null). Demanda entregue em agosto, reaberta
-- e reentregue em setembro voltaria inteira para setembro, repagando agosto.
-- Por isso a competencia sai da PRIMEIRA entrega posterior ao apontamento,
-- lida de demanda_historico (324 eventos / 303 demandas, bate com delivered_at).

create index if not exists idx_demanda_historico_entrega
  on public.demanda_historico (demanda_id, created_at)
  where campo = 'status' and valor_novo = 'entregue';

create or replace function public.fn_competencia_hora(p_demanda_id uuid, p_data date)
returns date
language sql
stable
security definer
set search_path to 'public'
as $function$
  select case
    -- Passado: regra antiga, a hora conta no dia em que foi apontada.
    when p_data < date '2026-09-01' then p_data
    -- Daqui pra frente: conta na entrega que fechou essa hora.
    else coalesce(
      (
        select (h.created_at at time zone 'America/Sao_Paulo')::date
        from public.demanda_historico h
        where h.demanda_id = p_demanda_id
          and h.campo = 'status'
          and h.valor_novo = 'entregue'
          and (h.created_at at time zone 'America/Sao_Paulo')::date >= p_data
        order by h.created_at
        limit 1
      ),
      -- Rede: entrega sem linha no historico.
      (
        select (d.delivered_at at time zone 'America/Sao_Paulo')::date
        from public.demandas d
        where d.id = p_demanda_id
          and d.delivered_at is not null
          and (d.delivered_at at time zone 'America/Sao_Paulo')::date >= p_data
      )
    )
  end;
$function$;

comment on function public.fn_competencia_hora(uuid, date) is
  'Data em que uma hora apontada deve ser paga: a entrega que a fechou. Antes de 01/09/2026, a propria data do apontamento. NULL = demanda ainda nao entregue, a hora fica de fora do relatorio ate a entrega.';

revoke execute on function public.fn_competencia_hora(uuid, date) from public, anon, authenticated;

create or replace function public.relatorio_horas_desenvolvedor(
  p_data_inicio date,
  p_data_fim date,
  p_profile_ids uuid[] default null::uuid[],
  p_status text[] default null::text[]
)
returns table(
  profile_id uuid, profile_nome text, total_segundos bigint, total_horas numeric,
  valor_hora numeric, valor_total numeric, dias_trabalhados bigint, qtd_demandas bigint
)
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if not public.tem_permissao('ver_dashboard_metricas') then
    raise exception 'Sem permissão para visualizar relatório de horas';
  end if;

  return query
  with devs as (
    select p.id, p.nome
    from public.profiles p
    join public.perfis_acesso pa on pa.id = p.perfil_acesso_id
    where pa.nome = 'Desenvolvedor'
      and p.ativo = true
  ),
  logs as (
    select
      tl.profile_id,
      tl.demanda_id,
      tl.data,
      tl.segundos,
      public.fn_competencia_hora(tl.demanda_id, tl.data) as competencia
    from public.demanda_timer_log tl
    join devs dv on dv.id = tl.profile_id
    join public.demandas d on d.id = tl.demanda_id
    where tl.segundos > 0
      and d.deleted_at is null          -- faltava aqui e existia no detalhe: demanda excluida entrava no total e sumia no drill-down
      and tl.data <= p_data_fim          -- a entrega nunca e anterior ao apontamento
      and (p_profile_ids is null or tl.profile_id = any(p_profile_ids))
      and (p_status is null or d.status::text = any(p_status))
  ),
  horas_por_dev as (
    select
      l.profile_id as dev_id,
      sum(l.segundos) as total_seg,
      count(distinct l.data) as dias_trab,
      count(distinct l.demanda_id) as qtd_dem
    from logs l
    where l.competencia between p_data_inicio and p_data_fim
    group by l.profile_id
  ),
  rate_vigente as (
    select distinct on (dr.profile_id)
      dr.profile_id,
      dr.valor_hora
    from public.developer_rates dr
    where dr.vigencia_inicio <= p_data_fim
      and (dr.vigencia_fim is null or dr.vigencia_fim >= p_data_inicio)
    order by dr.profile_id, dr.vigencia_inicio desc
  )
  select
    h.dev_id,
    dv.nome::text,
    h.total_seg,
    round(h.total_seg / 3600.0, 2)::numeric(10,2),
    coalesce(r.valor_hora, 0)::numeric(10,2),
    round((h.total_seg / 3600.0) * coalesce(r.valor_hora, 0), 2)::numeric(12,2),
    h.dias_trab,
    h.qtd_dem
  from horas_por_dev h
  join devs dv on dv.id = h.dev_id
  left join rate_vigente r on r.profile_id = h.dev_id
  order by dv.nome;
end;
$function$;

create or replace function public.detalhe_horas_desenvolvedor(
  p_profile_id uuid,
  p_data_inicio date,
  p_data_fim date,
  p_status text[] default null::text[]
)
returns table(
  demanda_id uuid, demanda_codigo text, demanda_titulo text, demanda_status text,
  total_segundos bigint, total_horas numeric, dias json
)
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if not public.tem_permissao('ver_dashboard_metricas') then
    raise exception 'Sem permissão';
  end if;

  return query
  with logs as (
    select
      d.id, d.codigo, d.titulo, d.status,
      tl.data, tl.segundos, tl.origem,
      public.fn_competencia_hora(tl.demanda_id, tl.data) as competencia
    from public.demanda_timer_log tl
    join public.demandas d on d.id = tl.demanda_id
    where tl.profile_id = p_profile_id
      and tl.segundos > 0
      and d.deleted_at is null
      and tl.data <= p_data_fim
      and (p_status is null or d.status::text = any(p_status))
  )
  select
    l.id,
    l.codigo::text,
    l.titulo::text,
    l.status::text,
    sum(l.segundos)::bigint,
    round(sum(l.segundos) / 3600.0, 2)::numeric(10,2),
    json_agg(
      json_build_object(
        'data', l.data,
        'segundos', l.segundos,
        'horas', round(l.segundos / 3600.0, 2),
        'origem', l.origem
      ) order by l.data
    )
  from logs l
  where l.competencia between p_data_inicio and p_data_fim
  group by l.id, l.codigo, l.titulo, l.status
  order by sum(l.segundos) desc, l.codigo;
end;
$function$;

-- Sobrecargas mortas: a tela sempre chama as de 4 argumentos. Deixa-las vivas
-- guardaria a regra antiga em paralelo -- foi assim que o filtro de deleted_at
-- divergiu entre resumo e detalhe.
drop function if exists public.relatorio_horas_desenvolvedor(date, date, uuid[]);
drop function if exists public.detalhe_horas_desenvolvedor(uuid, date, date);
