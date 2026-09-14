/**
 * Presets e guias de provedor da tela Configurações › E-mail.
 *
 * Copiado do DoctorSaaS (src/components/configuracoes/email/emailProviders.ts,
 * 10/09/2026), onde os servidores foram conferidos na documentação oficial e
 * abrindo conexão com cada host. `value` precisa bater com o CHECK de
 * `email_conta.provedor` (migration 20260913210000_conta_email_configuravel.sql).
 *
 * Diferença do DoctorSaaS: aqui a leitura das respostas só funciona com
 * SSL/TLS (o ClienteImap do ler-respostas-email abre TLS direto). Todos os
 * presets já usam 993 com SSL/TLS.
 *
 * Microsoft: contas pessoais (@outlook, @hotmail, @live) não aceitam mais senha
 * em programa externo, só OAuth. Microsoft 365 aceita senha apenas no envio
 * (SMTP AUTH), liberado pelo admin, e desliga por padrão no fim de dez/2026.
 * Por isso o preset não preenche a leitura.
 */

export type EmailSecurity = "ssl" | "starttls" | "none";

export interface PassoGuia {
  texto: string;
  link?: { rotulo: string; url: string };
}

export interface GuiaProvedor {
  /** frase curta que explica a regra do provedor */
  resumo: string;
  passos: PassoGuia[];
  /** caminho alternativo, quando a opção do passo principal não aparece */
  seNaoAparecer?: { titulo: string; passos: PassoGuia[] };
  observacoes?: string[];
  /** limitação que impede o uso, dita antes de qualquer passo */
  bloqueio?: string;
  ajuda?: { rotulo: string; url: string };
}

export interface EmailProviderPreset {
  value: string;
  label: string;
  smtpHost?: string;
  smtpPort?: number;
  smtpSecurity?: EmailSecurity;
  imapHost?: string;
  imapPort?: number;
  /** o provedor não aceita senha para ler a caixa: o preset limpa a leitura */
  semRecebimento?: boolean;
  /** exige senha de aplicativo: o guia abre sozinho */
  exigeSenhaApp?: boolean;
  guia: GuiaProvedor;
}

const SALVAR_E_TESTAR: PassoGuia = {
  texto: "Volte aqui, cole no campo Senha e clique em Salvar e testar.",
};

export const EMAIL_PROVIDERS: EmailProviderPreset[] = [
  {
    value: "gmail",
    label: "Gmail",
    smtpHost: "smtp.gmail.com",
    smtpPort: 465,
    smtpSecurity: "ssl",
    imapHost: "imap.gmail.com",
    imapPort: 993,
    exigeSenhaApp: true,
    guia: {
      resumo:
        "O Google não aceita a senha normal da conta em programas externos. É preciso gerar uma senha de aplicativo, e ela só existe com a verificação em duas etapas ligada.",
      passos: [
        {
          texto:
            "Entre na conta Google deste e-mail e ligue a verificação em duas etapas, se ainda estiver desligada.",
          link: {
            rotulo: "Abrir verificação em duas etapas",
            url: "https://myaccount.google.com/signinoptions/two-step-verification",
          },
        },
        {
          texto: "Abra a página de senhas de app, digite DoctorDev como nome e clique em Criar.",
          link: { rotulo: "Abrir senhas de app", url: "https://myaccount.google.com/apppasswords" },
        },
        { texto: "Copie as 16 letras que o Google mostrar. Ele mostra uma vez só." },
        SALVAR_E_TESTAR,
      ],
      seNaoAparecer: {
        titulo: "A página diz que a senha de app não está disponível?",
        passos: [
          {
            texto:
              "Em e-mail de empresa (Google Workspace), quem libera é o administrador: no Admin Console, Segurança › Autenticação › Verificação em duas etapas.",
            link: {
              rotulo: "Abrir no Admin Console",
              url: "https://admin.google.com/ac/security/2sv",
            },
          },
          {
            texto:
              "Marcar Permitir que os usuários ativem a verificação em duas etapas e salvar. Depois, repetir os passos acima.",
          },
          {
            texto:
              "Se a empresa obriga chave de segurança física, a senha de app fica bloqueada. A política precisa permitir outro método de verificação.",
          },
        ],
      },
      observacoes: [
        "Trocar a senha da conta Google cancela todas as senhas de app. Se isso acontecer, gere uma nova e salve aqui.",
      ],
      ajuda: {
        rotulo: "Ajuda do Google sobre senhas de app",
        url: "https://support.google.com/accounts/answer/185833",
      },
    },
  },
  {
    value: "outlook",
    label: "Outlook",
    smtpHost: "smtp.office365.com",
    smtpPort: 587,
    smtpSecurity: "starttls",
    semRecebimento: true,
    guia: {
      bloqueio:
        "Contas pessoais @outlook.com, @hotmail.com e @live.com não funcionam: a Microsoft desligou o acesso por senha para programas externos e só aceita o login pela própria Microsoft, que o DoctorDev ainda não tem. Para esses endereços, use outra conta.",
      resumo:
        "E-mail de empresa no Microsoft 365 funciona só para envio, e o administrador do Microsoft 365 precisa liberar o envio autenticado para esta caixa. As respostas dos clientes não serão lidas.",
      passos: [
        {
          texto:
            "O administrador abre o Centro de administração do Microsoft 365 em Usuários › Usuários ativos.",
          link: { rotulo: "Abrir Usuários ativos", url: "https://admin.microsoft.com/#/users" },
        },
        {
          texto:
            "Clica no usuário deste e-mail, abre a aba Email e depois Gerenciar aplicativos de email.",
        },
        { texto: "Marca SMTP autenticado e salva. Pode levar alguns minutos para valer." },
        { texto: "Volte aqui e clique em Salvar e testar." },
      ],
      observacoes: [
        "Se a empresa usa os Padrões de segurança da Microsoft, o SMTP autenticado continua bloqueado mesmo marcado.",
        "A Microsoft vai desligar esse acesso por padrão no fim de dezembro de 2026. Depois disso o administrador ainda consegue religar, até a Microsoft anunciar o fim definitivo.",
      ],
      ajuda: {
        rotulo: "Documentação da Microsoft sobre SMTP autenticado",
        url: "https://learn.microsoft.com/pt-br/exchange/clients-and-mobile-in-exchange-online/authenticated-client-smtp-submission",
      },
    },
  },
  {
    value: "yahoo",
    label: "Yahoo",
    smtpHost: "smtp.mail.yahoo.com",
    smtpPort: 465,
    smtpSecurity: "ssl",
    imapHost: "imap.mail.yahoo.com",
    imapPort: 993,
    exigeSenhaApp: true,
    guia: {
      resumo:
        "O Yahoo só aceita senha de aplicativo em programas externos. A senha normal da conta é recusada.",
      passos: [
        {
          texto: "Entre na conta Yahoo deste e-mail e abra Segurança da conta.",
          link: {
            rotulo: "Abrir segurança da conta",
            url: "https://login.yahoo.com/account/security",
          },
        },
        { texto: "Em Conexões externas, clique em Gerar senha de app, digite DoctorDev e gere." },
        { texto: "Copie a senha gerada." },
        SALVAR_E_TESTAR,
      ],
      ajuda: {
        rotulo: "Ajuda do Yahoo sobre senhas de app",
        url: "https://help.yahoo.com/kb/SLN15241.html",
      },
    },
  },
  {
    value: "zoho",
    label: "Zoho",
    smtpHost: "smtppro.zoho.com",
    smtpPort: 465,
    smtpSecurity: "ssl",
    imapHost: "imappro.zoho.com",
    imapPort: 993,
    guia: {
      resumo:
        "E-mail com domínio próprio no Zoho usa servidores diferentes da conta pessoal, e o acesso por programa externo precisa estar ligado.",
      passos: [
        {
          texto:
            "No Zoho Mail, abra Configurações › Contas de e-mail, clique no seu e-mail e marque Acesso IMAP.",
          link: {
            rotulo: "Ver como ligar o IMAP",
            url: "https://www.zoho.com/mail/help/imap-access.html",
          },
        },
        {
          texto:
            "Se a conta tem verificação em dois fatores, gere uma senha de app em Contas Zoho › Segurança › Senhas de aplicativos › Gerar nova senha.",
          link: { rotulo: "Abrir Contas Zoho", url: "https://accounts.zoho.com/home" },
        },
        SALVAR_E_TESTAR,
      ],
      observacoes: [
        "Conta pessoal @zoho.com ou @zohomail.com usa smtp.zoho.com e imap.zoho.com. Troque em Servidores.",
        "O plano gratuito do Zoho não libera acesso por programa externo.",
      ],
    },
  },
  {
    value: "locaweb",
    label: "Locaweb",
    smtpHost: "email-ssl.com.br",
    smtpPort: 465,
    smtpSecurity: "ssl",
    imapHost: "email-ssl.com.br",
    imapPort: 993,
    guia: {
      resumo: "Na Locaweb a senha é a mesma da caixa de e-mail. Não existe senha de aplicativo.",
      passos: [
        { texto: "Use no campo Senha a mesma senha com que você entra no webmail da Locaweb." },
        {
          texto:
            "Se não lembrar, troque a senha da caixa na Central do Cliente da Locaweb, em E-mail.",
        },
        { texto: "Volte aqui e clique em Salvar e testar." },
      ],
      ajuda: {
        rotulo: "Configuração oficial da Locaweb",
        url: "https://www.locaweb.com.br/ajuda/wiki/configuracao-de-outlook-email-locaweb/",
      },
    },
  },
  {
    value: "hostinger",
    label: "Hostinger",
    smtpHost: "smtp.hostinger.com",
    smtpPort: 465,
    smtpSecurity: "ssl",
    imapHost: "imap.hostinger.com",
    imapPort: 993,
    guia: {
      resumo: "Na Hostinger a senha é a da caixa de e-mail criada no hPanel.",
      passos: [
        {
          texto: "No hPanel, abra E-mails › Contas de e-mail.",
          link: { rotulo: "Abrir o hPanel", url: "https://hpanel.hostinger.com" },
        },
        { texto: "Se não souber a senha atual, use Alterar senha no menu da conta." },
        { texto: "Volte aqui e clique em Salvar e testar." },
      ],
    },
  },
  {
    value: "uolhost",
    label: "UOL Host",
    smtpHost: "smtps.uhserver.com",
    smtpPort: 465,
    smtpSecurity: "ssl",
    imapHost: "imap.uhserver.com",
    imapPort: 993,
    guia: {
      resumo:
        "No UOL Host a senha é a da caixa de e-mail, e a leitura só funciona com o IMAP ativado no painel.",
      passos: [
        {
          texto:
            "No painel do UOL Host, abra o e-mail profissional, procure Configurar IMAP/POP e deixe Ativado.",
        },
        { texto: "A senha é a da caixa de e-mail." },
        { texto: "Volte aqui e clique em Salvar e testar." },
      ],
    },
  },
  {
    value: "custom",
    label: "Próprio",
    guia: {
      resumo: "Em servidor próprio, quem sabe os dados é a empresa que hospeda o seu e-mail.",
      passos: [
        {
          texto:
            "Peça ao provedor de hospedagem o servidor de saída (SMTP) e o de entrada (IMAP), com a porta e o tipo de segurança de cada um.",
        },
        { texto: "O usuário quase sempre é o e-mail completo." },
        {
          texto:
            "Combinações que funcionam na maioria dos servidores: saída 465 com SSL/TLS ou 587 com STARTTLS, entrada 993 com SSL/TLS.",
        },
        { texto: "Preencha os Servidores e clique em Salvar e testar." },
      ],
    },
  },
];

export const providerByValue = (value?: string | null): EmailProviderPreset =>
  EMAIL_PROVIDERS.find((p) => p.value === value) ?? EMAIL_PROVIDERS[EMAIL_PROVIDERS.length - 1];

export const SECURITY_LABELS: Record<EmailSecurity, string> = {
  ssl: "SSL/TLS",
  starttls: "STARTTLS",
  none: "Sem criptografia",
};
