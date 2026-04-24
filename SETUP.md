# Setup do devflow-hub

## Configuração obrigatória no Supabase

### 1. Authentication → URL Configuration

- **Site URL**: URL pública do app (ex: `https://devflow-hub.lovable.app`)
- **Redirect URLs**: adicione todas as variações que o app usa:
  - `https://devflow-hub.lovable.app/**`
  - `https://devflow-hub.lovable.app/auth/confirm`
  - Para preview: `https://id-preview--<project-id>.lovable.app/**`

### 2. Authentication → Sign In / Up

- Desabilitar "Confirm email" durante desenvolvimento (reativar em produção)
- Habilitar "Enable leaked password protection" (recomendado)

### 3. SMTP (produção)

O SMTP gratuito do Supabase tem limite de 3 emails/hora. Pra produção configure
um provider (Resend, Amazon SES) em **Settings → Auth → SMTP Settings**.

## Primeiro admin

Se nenhum usuário é administrador, execute via SQL Editor:

```sql
update public.profiles p
set perfil_acesso_id = (select id from public.perfis_acesso where nome = 'Administrador')
where p.id = (select id from auth.users where email = 'seu-email@exemplo.com');
```
