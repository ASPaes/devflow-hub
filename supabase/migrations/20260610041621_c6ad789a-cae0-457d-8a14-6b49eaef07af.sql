CREATE OR REPLACE FUNCTION public.detalhe_horas_desenvolvedor(p_profile_id uuid, p_data_inicio date, p_data_fim date, p_status text[] DEFAULT NULL::text[])
 RETURNS TABLE(demanda_id uuid, demanda_codigo text, demanda_titulo text, demanda_status text, total_segundos bigint, total_horas numeric, dias json)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.tem_permissao('ver_dashboard_metricas') THEN
    RAISE EXCEPTION 'Sem permissão';
  END IF;

  RETURN QUERY
  SELECT 
    d.id,
    d.codigo::TEXT,
    d.titulo::TEXT,
    d.status::TEXT,
    SUM(tl.segundos)::BIGINT AS total_seg,
    ROUND(SUM(tl.segundos) / 3600.0, 2)::NUMERIC(10,2),
    json_agg(
      json_build_object(
        'data', tl.data,
        'segundos', tl.segundos,
        'horas', ROUND(tl.segundos / 3600.0, 2),
        'origem', tl.origem
      ) ORDER BY tl.data
    )
  FROM public.demanda_timer_log tl
  JOIN public.demandas d ON d.id = tl.demanda_id
  WHERE tl.profile_id = p_profile_id
    AND tl.data BETWEEN p_data_inicio AND p_data_fim
    AND tl.segundos > 0
    AND d.deleted_at IS NULL
    AND (p_status IS NULL OR d.status::TEXT = ANY(p_status))
  GROUP BY d.id, d.codigo, d.titulo, d.status
  ORDER BY SUM(tl.segundos) DESC, d.codigo;
END;
$function$