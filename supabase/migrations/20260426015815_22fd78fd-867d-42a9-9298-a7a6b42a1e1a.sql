CREATE OR REPLACE FUNCTION public.list_usuarios_admin()
 RETURNS TABLE(id uuid, nome text, email text, avatar_url text, perfil_acesso_id uuid, perfil_acesso_nome text, permissoes app_permissao[], tenant_id uuid, tenant_nome text, ativo boolean, created_at timestamp with time zone, updated_at timestamp with time zone, last_sign_in_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not public.tem_permissao('gerenciar_usuarios') then
    raise exception 'Sem permissão para listar usuários';
  end if;

  return query
  select
    p.id, p.nome, u.email::text, p.avatar_url,
    p.perfil_acesso_id, pa.nome as perfil_acesso_nome, pa.permissoes,
    p.tenant_id,
    t.nome as tenant_nome,
    p.ativo, p.created_at, p.updated_at, u.last_sign_in_at
  from public.profiles p
  inner join auth.users u on u.id = p.id
  inner join public.perfis_acesso pa on pa.id = p.perfil_acesso_id
  left join public.tenants t on t.id = p.tenant_id
  order by p.created_at desc;
end;
$function$;