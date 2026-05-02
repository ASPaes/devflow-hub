ALTER TABLE public.rascunhos
  ADD COLUMN IF NOT EXISTS deleted_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS deleted_by uuid;

CREATE INDEX IF NOT EXISTS idx_rascunhos_deleted_at ON public.rascunhos(deleted_at);

CREATE OR REPLACE FUNCTION public.rascunho_acessivel(p_rascunho_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.rascunhos r
    WHERE r.id = p_rascunho_id
      AND (
        r.autor_id = auth.uid()
        OR (
          r.deleted_at IS NULL
          AND (
            r.compartilhada = true
            OR EXISTS (
              SELECT 1 FROM public.rascunho_compartilhamentos rc
              WHERE rc.rascunho_id = r.id
                AND (
                  rc.usuario_id = auth.uid()
                  OR rc.tenant_id = (SELECT p.tenant_id FROM public.profiles p WHERE p.id = auth.uid())
                )
            )
          )
        )
      )
  );
$$;

DROP POLICY IF EXISTS rascunhos_select ON public.rascunhos;
CREATE POLICY rascunhos_select ON public.rascunhos
FOR SELECT
USING (
  autor_id = auth.uid()
  OR (
    deleted_at IS NULL
    AND (
      compartilhada = true
      OR EXISTS (
        SELECT 1 FROM public.rascunho_compartilhamentos rc
        WHERE rc.rascunho_id = rascunhos.id
          AND (
            rc.usuario_id = auth.uid()
            OR rc.tenant_id = (SELECT p.tenant_id FROM public.profiles p WHERE p.id = auth.uid())
          )
      )
    )
  )
);

DROP POLICY IF EXISTS rascunhos_update ON public.rascunhos;
CREATE POLICY rascunhos_update ON public.rascunhos
FOR UPDATE
USING (
  autor_id = auth.uid()
  OR (
    deleted_at IS NULL
    AND (
      compartilhada = true
      OR EXISTS (
        SELECT 1 FROM public.rascunho_compartilhamentos rc
        WHERE rc.rascunho_id = rascunhos.id
          AND (
            rc.usuario_id = auth.uid()
            OR rc.tenant_id = (SELECT p.tenant_id FROM public.profiles p WHERE p.id = auth.uid())
          )
      )
    )
  )
)
WITH CHECK (
  autor_id = auth.uid()
  OR (
    deleted_at IS NULL
    AND (
      compartilhada = true
      OR EXISTS (
        SELECT 1 FROM public.rascunho_compartilhamentos rc
        WHERE rc.rascunho_id = rascunhos.id
          AND (
            rc.usuario_id = auth.uid()
            OR rc.tenant_id = (SELECT p.tenant_id FROM public.profiles p WHERE p.id = auth.uid())
          )
      )
    )
  )
);