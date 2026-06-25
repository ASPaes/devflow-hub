-- Permite que o tipo da release acompanhe alterações na demanda, mesmo após publicação
CREATE OR REPLACE FUNCTION public.prevent_release_edit_after_publish()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
begin
  if old.published_at is not null and new.published_at is not null then
    if old.titulo is distinct from new.titulo
       or old.resumo is distinct from new.resumo then
      raise exception 'Release publicada é imutável. Despublique primeiro.';
    end if;
  end if;
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.sync_release_tipo_from_demanda()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tipo_codigo text;
BEGIN
  IF NEW.tipo_id IS DISTINCT FROM OLD.tipo_id OR NEW.tipo IS DISTINCT FROM OLD.tipo THEN
    SELECT codigo INTO v_tipo_codigo FROM public.tipos_demanda WHERE id = NEW.tipo_id;
    UPDATE public.releases
      SET tipo_id = NEW.tipo_id,
          tipo_release = COALESCE(v_tipo_codigo, NEW.tipo::text)::tipo_release,
          updated_at = now()
      WHERE demanda_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_release_tipo ON public.demandas;
CREATE TRIGGER trg_sync_release_tipo
AFTER UPDATE OF tipo, tipo_id ON public.demandas
FOR EACH ROW
EXECUTE FUNCTION public.sync_release_tipo_from_demanda();

UPDATE public.releases r
SET tipo_id = d.tipo_id,
    tipo_release = COALESCE(td.codigo, d.tipo::text)::tipo_release,
    updated_at = now()
FROM public.demandas d
LEFT JOIN public.tipos_demanda td ON td.id = d.tipo_id
WHERE r.demanda_id = d.id
  AND (r.tipo_id IS DISTINCT FROM d.tipo_id);