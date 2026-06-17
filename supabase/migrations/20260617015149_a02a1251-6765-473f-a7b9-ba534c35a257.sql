ALTER TABLE public.demandas ADD COLUMN IF NOT EXISTS posicao DOUBLE PRECISION;

WITH ranked AS (
  SELECT id,
    row_number() OVER (PARTITION BY status ORDER BY prioridade DESC NULLS LAST, created_at DESC) * 1000.0 AS rn
  FROM public.demandas
  WHERE deleted_at IS NULL
)
UPDATE public.demandas d
SET posicao = ranked.rn
FROM ranked
WHERE d.id = ranked.id AND d.posicao IS NULL;

CREATE INDEX IF NOT EXISTS demandas_status_posicao_idx ON public.demandas (status, posicao);

CREATE OR REPLACE VIEW public.vw_demandas_lista AS
SELECT d.id, d.codigo, d.titulo, d.descricao, d.tipo, d.tipo_id,
    td.codigo AS tipo_codigo, td.label AS tipo_label, td.icone AS tipo_icone, td.cor AS tipo_cor,
    d.prioridade, d.status, d.versao,
    d.modulo_id, m.nome AS modulo_nome, m.cor AS modulo_cor,
    d.submodulo_id, sm.nome AS submodulo_nome,
    d.area_id, a.nome AS area_nome,
    d.tenant_id, t.nome AS tenant_nome,
    d.solicitante_id, ps.nome AS solicitante_nome, ps.avatar_url AS solicitante_avatar,
    d.responsavel_id, pr.nome AS responsavel_nome, pr.avatar_url AS responsavel_avatar,
    d.deadline, d.estimativa_horas, d.created_at, d.updated_at,
    d.delivered_at, d.reopen_deadline, d.closed_at,
    (SELECT count(*) FROM demanda_comentarios c WHERE c.demanda_id = d.id) AS total_comentarios,
    (SELECT count(*) FROM demanda_anexos an WHERE an.demanda_id = d.id) AS total_anexos,
    (SELECT count(*) FROM demanda_vinculos v WHERE v.demanda_origem_id = d.id) AS total_vinculos,
    d.dev_deadline, d.produto_id, prod.nome AS produto_nome,
    d.foi_reaberta, d.total_reaberturas,
    d.posicao
FROM demandas d
  LEFT JOIN modulos m ON m.id = d.modulo_id
  LEFT JOIN submodulos sm ON sm.id = d.submodulo_id
  LEFT JOIN areas a ON a.id = d.area_id
  LEFT JOIN tenants t ON t.id = d.tenant_id
  LEFT JOIN profiles ps ON ps.id = d.solicitante_id
  LEFT JOIN profiles pr ON pr.id = d.responsavel_id
  LEFT JOIN produtos prod ON prod.id = d.produto_id
  LEFT JOIN tipos_demanda td ON td.id = d.tipo_id
WHERE d.deleted_at IS NULL;