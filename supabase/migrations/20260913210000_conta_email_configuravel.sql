-- Conta de e-mail do DoctorDev configurável pela tela (Configurações › E-mail).
--
-- Até aqui o envio (notificar-cliente-demanda) e o leitor de respostas
-- (ler-respostas-email) liam SMTP_USER/SMTP_PASS dos Secrets do Supabase.
-- Em 13/09/2026 o Google revogou a senha de app e trocar a conta exigia entrar
-- no painel. Agora a conta mora aqui e o admin troca pela tela.
--
-- Uma conta só (linha única, igual a email_ingestao_estado): é a caixa que
-- fala com o cliente. Enquanto esta tabela estiver vazia, as functions
-- continuam usando os Secrets, então aplicar esta migration não muda nada.
--
-- Senha: nunca em coluna. Fica no Vault; a tabela guarda só o id do segredo.
--
-- Acesso: nenhum direto na tabela. A tela lê e grava por RPC que exige admin
-- (mesma regra do isAdminPerfil do frontend: gerenciar_usuarios E
-- gerenciar_perfis_acesso). A senha só sai por RPC exclusiva do service_role.

create table if not exists public.email_conta (
  id smallint primary key default 1,

  provedor        text not null default 'custom',
  email           text not null,
  nome_remetente  text,
  -- mesmo usuário na saída e na entrada; vazio = o próprio e-mail
  usuario         text not null,

  smtp_host       text    not null,
  smtp_porta      integer not null,
  smtp_seguranca  text    not null,

  -- nulo = conta só de envio (Outlook não aceita senha para ler a caixa)
  imap_host       text,
  imap_porta      integer,
  imap_seguranca  text,

  vault_secret_id uuid not null,

  -- carimbado pela edge function testar-conta-email
  ultimo_teste_em   timestamptz,
  ultimo_teste_ok   boolean,
  ultimo_teste_erro text,

  atualizado_em  timestamptz not null default now(),
  atualizado_por uuid,

  constraint email_conta_linha_unica check (id = 1),
  constraint email_conta_provedor_chk check (
    provedor in ('gmail','outlook','yahoo','zoho','locaweb','hostinger','uolhost','custom')
  ),
  constraint email_conta_email_chk check (position('@' in email) > 1),
  constraint email_conta_smtp_seg_chk check (smtp_seguranca in ('ssl','starttls','none')),
  constraint email_conta_smtp_porta_chk check (smtp_porta between 1 and 65535),
  constraint email_conta_imap_chk check (
    imap_host is null
    or (imap_porta between 1 and 65535 and imap_seguranca in ('ssl','starttls','none'))
  )
);

comment on table public.email_conta is
  'Conta de e-mail que o DoctorDev usa para falar com o cliente (envio e leitura de respostas). Linha única. Senha no Vault.';

alter table public.email_conta enable row level security;
-- O default privilege do banco dá tudo (inclusive TRUNCATE, que ignora RLS) a
-- anon e authenticated em tabela nova. Tira: acesso só pelas RPCs abaixo.
revoke all on public.email_conta from anon, authenticated;


-- ── Leitura para a tela ─────────────────────────────────────────────────
-- Sem senha. Traz junto a situação do leitor de respostas, que até hoje só
-- dava para ver consultando o banco: foi assim que a falha de 13/09 ficou
-- invisível.
create or replace function public.obter_conta_email()
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
as $$
declare
  v_conta jsonb;
  v_leitor jsonb;
begin
  if not (public.tem_permissao('gerenciar_usuarios') and public.tem_permissao('gerenciar_perfis_acesso')) then
    raise exception 'Apenas administradores podem ver a conta de e-mail.' using errcode = '42501';
  end if;

  select to_jsonb(c) - 'vault_secret_id'
    into v_conta
    from public.email_conta c
   where c.id = 1;

  select jsonb_build_object(
           'ultima_execucao', e.ultima_execucao,
           'ultimo_erro', e.ultimo_erro
         )
    into v_leitor
    from public.email_ingestao_estado e
   where e.id = 1;

  return jsonb_build_object('conta', v_conta, 'leitor', v_leitor);
end;
$$;

revoke all on function public.obter_conta_email() from public, anon;
grant execute on function public.obter_conta_email() to authenticated, service_role;


-- ── Gravação pela tela ──────────────────────────────────────────────────
-- Senha vazia = mantém a que está no Vault (obrigatória só na primeira vez).
create or replace function public.salvar_conta_email(
  p_provedor       text,
  p_email          text,
  p_smtp_host      text,
  p_smtp_porta     integer,
  p_smtp_seguranca text,
  p_senha          text    default null,
  p_usuario        text    default null,
  p_nome_remetente text    default null,
  p_imap_host      text    default null,
  p_imap_porta     integer default null,
  p_imap_seguranca text    default null
)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_email     text := lower(btrim(coalesce(p_email, '')));
  v_usuario   text;
  v_imap_host text := nullif(btrim(coalesce(p_imap_host, '')), '');
  v_atual     public.email_conta;
  v_secret_id uuid;
begin
  if not (public.tem_permissao('gerenciar_usuarios') and public.tem_permissao('gerenciar_perfis_acesso')) then
    raise exception 'Apenas administradores podem alterar a conta de e-mail.' using errcode = '42501';
  end if;

  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'Informe um e-mail válido.';
  end if;
  if nullif(btrim(coalesce(p_smtp_host, '')), '') is null then
    raise exception 'Informe o servidor de saída.';
  end if;

  v_usuario := coalesce(nullif(btrim(coalesce(p_usuario, '')), ''), v_email);

  select * into v_atual from public.email_conta where id = 1 for update;

  -- senha: cria no Vault na primeira vez, atualiza depois
  if coalesce(p_senha, '') <> '' then
    if v_atual.vault_secret_id is null then
      v_secret_id := vault.create_secret(
        p_senha,
        'email_conta_senha',
        'Senha da conta de e-mail do DoctorDev (public.email_conta)'
      );
    else
      v_secret_id := v_atual.vault_secret_id;
      perform vault.update_secret(v_secret_id, p_senha);
    end if;
  elsif v_atual.vault_secret_id is null then
    raise exception 'Informe a senha da conta.';
  else
    v_secret_id := v_atual.vault_secret_id;
  end if;

  insert into public.email_conta as c (
    id, provedor, email, nome_remetente, usuario,
    smtp_host, smtp_porta, smtp_seguranca,
    imap_host, imap_porta, imap_seguranca,
    vault_secret_id,
    ultimo_teste_em, ultimo_teste_ok, ultimo_teste_erro,
    atualizado_em, atualizado_por
  ) values (
    1, p_provedor, v_email, nullif(btrim(coalesce(p_nome_remetente, '')), ''), v_usuario,
    btrim(p_smtp_host), p_smtp_porta, p_smtp_seguranca,
    v_imap_host,
    case when v_imap_host is null then null else p_imap_porta end,
    case when v_imap_host is null then null else p_imap_seguranca end,
    v_secret_id,
    -- o teste anterior valia para a configuração anterior
    null, null, null,
    now(), auth.uid()
  )
  on conflict (id) do update
    set provedor          = excluded.provedor,
        email             = excluded.email,
        nome_remetente    = excluded.nome_remetente,
        usuario           = excluded.usuario,
        smtp_host         = excluded.smtp_host,
        smtp_porta        = excluded.smtp_porta,
        smtp_seguranca    = excluded.smtp_seguranca,
        imap_host         = excluded.imap_host,
        imap_porta        = excluded.imap_porta,
        imap_seguranca    = excluded.imap_seguranca,
        vault_secret_id   = excluded.vault_secret_id,
        ultimo_teste_em   = null,
        ultimo_teste_ok   = null,
        ultimo_teste_erro = null,
        atualizado_em     = now(),
        atualizado_por    = auth.uid();

  -- Caixa de leitura diferente = a marca d'água do leitor não vale mais.
  -- UID é por caixa: o 247965 da caixa antiga faria o leitor pular todas as
  -- mensagens da nova até ela passar desse número. Zerando, a primeira leitura
  -- planta a marca no presente (ler-respostas-email) e segue dali.
  -- Na primeira gravação também zera: a caixa que valia era a dos Secrets.
  if v_atual.id is null
     or lower(coalesce(v_atual.imap_host, '')) is distinct from lower(coalesce(v_imap_host, ''))
     or lower(v_atual.usuario) is distinct from lower(v_usuario) then
    update public.email_ingestao_estado
       set uidvalidity = null,
           ultimo_uid  = 0,
           ultimo_erro = null
     where id = 1;
  end if;
end;
$$;

revoke all on function public.salvar_conta_email(
  text, text, text, integer, text, text, text, text, text, integer, text
) from public, anon;
grant execute on function public.salvar_conta_email(
  text, text, text, integer, text, text, text, text, text, integer, text
) to authenticated, service_role;


-- ── Leitura para as edge functions ──────────────────────────────────────
-- Única saída da senha. REVOKE de authenticated explícito: o default privilege
-- dá EXECUTE a todo mundo, e revogar só de PUBLIC não tira nada.
create or replace function public.obter_conta_email_servico()
returns jsonb
language sql
stable
security definer
set search_path to 'public'
as $$
  select (to_jsonb(c) - 'vault_secret_id') || jsonb_build_object('senha', s.decrypted_secret)
    from public.email_conta c
    join vault.decrypted_secrets s on s.id = c.vault_secret_id
   where c.id = 1;
$$;

revoke all on function public.obter_conta_email_servico() from public, anon, authenticated;
grant execute on function public.obter_conta_email_servico() to service_role;
