-- dashboard_metrics: "concluídas no período" passa a ser data de entrega real.
--
-- A CTE `conclusao` contava dois ramos: entregue por delivered_at OU encerrada por
-- closed_at. Como `encerrada` não é transição manual (não existe em PROXIMOS_STATUS) e
-- sim o fechamento automático depois do prazo de reabertura, o segundo ramo:
--   1. inflava o mês corrente com demandas entregues meses antes, e
--   2. removia essas demandas do mês em que foram realmente entregues — quando o status
--      vira 'encerrada', ela deixa de bater no ramo do delivered_at.
-- Medido em 09/08/2026 para agosto: 46 entregues no mês + 32 encerradas no mês, sendo
-- que as 32 tinham delivered_at ANTERIOR a agosto. O painel dizia 78.
--
-- Agora a CTE é `entregues`: delivered_at dentro do período, qualquer status exceto
-- cancelada. Nenhuma demanda é perdida — as 221 concluídas têm delivered_at preenchido
-- (trigger trg_demandas_status_timestamps), zero nulos.

CREATE OR REPLACE FUNCTION public.dashboard_metrics(
  p_data_inicio date DEFAULT NULL::date,
  p_data_fim date DEFAULT NULL::date,
  p_status text[] DEFAULT NULL::text[],
  p_prioridade integer[] DEFAULT NULL::integer[],
  p_tipo text[] DEFAULT NULL::text[],
  p_modulo_id uuid[] DEFAULT NULL::uuid[],
  p_area_id uuid[] DEFAULT NULL::uuid[],
  p_tenant_id uuid[] DEFAULT NULL::uuid[],
  p_responsavel_id uuid[] DEFAULT NULL::uuid[],
  p_tipo_data text DEFAULT 'criacao'::text,
  p_apenas_sem_data boolean DEFAULT false,
  p_solicitante_id uuid[] DEFAULT NULL::uuid[]
)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_result jsonb;
  v_inicio date := coalesce(p_data_inicio, '1900-01-01'::date);
  v_fim date := coalesce(p_data_fim, '9999-12-31'::date);
begin
  if not public.tem_permissao('ver_dashboard_metricas') then
    raise exception 'Sem permissão para ver o dashboard de métricas';
  end if;

  if p_tipo_data not in ('criacao', 'desenvolvimento', 'entrega') then
    raise exception 'p_tipo_data inválido: %', p_tipo_data;
  end if;

  with base as (
    select d.*
    from public.demandas d
    where d.deleted_at is null
      and (p_status is null or array_length(p_status, 1) is null or d.status::text = ANY(p_status))
      and (p_prioridade is null or array_length(p_prioridade, 1) is null or d.prioridade = ANY(p_prioridade))
      and (p_tipo is null or array_length(p_tipo, 1) is null or d.tipo::text = ANY(p_tipo))
      and (p_modulo_id is null or array_length(p_modulo_id, 1) is null or d.modulo_id = ANY(p_modulo_id))
      and (p_area_id is null or array_length(p_area_id, 1) is null or d.area_id = ANY(p_area_id))
      and (p_tenant_id is null or array_length(p_tenant_id, 1) is null or d.tenant_id = ANY(p_tenant_id))
      and (p_responsavel_id is null or array_length(p_responsavel_id, 1) is null or d.responsavel_id = ANY(p_responsavel_id))
      and (p_solicitante_id is null or array_length(p_solicitante_id, 1) is null or d.solicitante_id = ANY(p_solicitante_id))
  ),
  filtro_principal as (
    select * from base
    where
      case
        when p_apenas_sem_data and p_tipo_data = 'desenvolvimento' then dev_deadline is null
        when p_apenas_sem_data and p_tipo_data = 'entrega' then deadline is null
        when p_apenas_sem_data and p_tipo_data = 'criacao' then false
        when p_tipo_data = 'criacao' then (created_at at time zone 'America/Sao_Paulo')::date between v_inicio and v_fim
        when p_tipo_data = 'desenvolvimento' then dev_deadline is not null and dev_deadline between v_inicio and v_fim
        when p_tipo_data = 'entrega' then deadline is not null and deadline between v_inicio and v_fim
      end
  ),
  -- Entrega real: quando a demanda foi de fato entregue, independente de já ter sido
  -- encerrada depois. Substitui a antiga CTE `conclusao`.
  entregues as (
    select * from base
    where status <> 'cancelada'
      and delivered_at is not null
      and (delivered_at at time zone 'America/Sao_Paulo')::date between v_inicio and v_fim
  ),
  -- Agrega timer log por responsável, dentro do período.
  -- Importante: usa "base" (não filtro_principal) — assim o tempo conta
  -- mesmo se a demanda foi criada fora do período mas tem log dentro dele.
  tempo_por_resp as (
    select
      b.responsavel_id,
      coalesce(sum(tl.segundos), 0)::bigint as total_segundos
    from base b
    left join public.demanda_timer_log tl on tl.demanda_id = b.id
      and (
        (p_data_inicio is null and p_data_fim is null)
        or tl.data between v_inicio and v_fim
      )
    group by b.responsavel_id
  ),
  entregues_por_resp as (
    select responsavel_id, count(*)::bigint as total
    from entregues
    group by responsavel_id
  ),
  -- Quem aparece no card = entregou no período OU lançou hora no período.
  resp_ids as (
    select responsavel_id from entregues_por_resp
    union
    select responsavel_id from tempo_por_resp where total_segundos > 0
  )
  select jsonb_build_object(
    'total', (select count(*) from filtro_principal),
    'abertas', (
      select count(*) from filtro_principal
      where status not in ('entregue', 'encerrada', 'cancelada')
    ),
    'prioritarias_abertas', (
      select count(*) from filtro_principal
      where prioridade >= 4 and status not in ('entregue', 'encerrada', 'cancelada')
    ),
    'concluidas_periodo', (select count(*) from entregues),
    'sem_dev_deadline', (select count(*) from base where dev_deadline is null),
    'sem_deadline', (select count(*) from base where deadline is null),
    'por_status', (
      select coalesce(jsonb_object_agg(status, total), '{}'::jsonb)
      from (select status, count(*) as total from filtro_principal group by status) t
    ),
    'por_prioridade', (
      select coalesce(jsonb_object_agg(prioridade, total), '{}'::jsonb)
      from (select prioridade, count(*) as total from filtro_principal group by prioridade) t
    ),
    'por_responsavel', (
      select coalesce(
        jsonb_agg(
          jsonb_build_object(
            'id', id,
            'nome', nome,
            'avatar_url', avatar_url,
            'total', total,
            'total_segundos', total_segundos
          )
          order by sem_resp asc, total desc, total_segundos desc, nome asc
        ),
        '[]'::jsonb
      )
      from (
        select
          p.id,
          coalesce(p.nome, 'Sem desenvolvedor') as nome,
          p.avatar_url,
          coalesce(e.total, 0) as total,
          coalesce(t.total_segundos, 0) as total_segundos,
          case when r.responsavel_id is null then 1 else 0 end as sem_resp
        from resp_ids r
        left join public.profiles p on p.id = r.responsavel_id
        left join entregues_por_resp e on e.responsavel_id is not distinct from r.responsavel_id
        left join tempo_por_resp t on t.responsavel_id is not distinct from r.responsavel_id
      ) t
    ),
    'periodo', jsonb_build_object(
      'data_inicio', p_data_inicio,
      'data_fim', p_data_fim,
      'tipo_data', p_tipo_data,
      'apenas_sem_data', p_apenas_sem_data
    ),
    'filtros', jsonb_build_object(
      'status', p_status,
      'prioridade', p_prioridade,
      'tipo', p_tipo,
      'modulo_id', p_modulo_id,
      'area_id', p_area_id,
      'tenant_id', p_tenant_id,
      'responsavel_id', p_responsavel_id,
      'solicitante_id', p_solicitante_id
    )
  ) into v_result;

  return v_result;
end;
$function$;
