import * as React from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  AlertTriangle,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  CircleDashed,
  Eye,
  EyeOff,
  Inbox,
  Loader2,
  Lock,
  Plug,
  Send,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/common/PageHeader";
import { EmptyState } from "@/components/common/EmptyState";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { GuiaProvedor } from "@/components/configuracoes/email/GuiaProvedor";
import { ProviderLogo } from "@/components/configuracoes/email/ProviderLogo";
import {
  EMAIL_PROVIDERS,
  SECURITY_LABELS,
  providerByValue,
  type EmailSecurity,
} from "@/components/configuracoes/email/emailProviders";
import { useProfile } from "@/hooks/useProfile";
import {
  useContaEmail,
  useSalvarContaEmail,
  useTestarContaEmail,
  type ConfiguracaoEmail,
  type ContaEmail,
  type ResultadoTeste,
} from "@/hooks/useContaEmail";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/configuracoes/email")({
  component: ContaEmailPage,
});

// ─── formulário ──────────────────────────────────────────────────────────

interface Formulario {
  provedor: string;
  email: string;
  nome_remetente: string;
  usuario: string;
  senha: string;
  smtp_host: string;
  smtp_porta: string;
  smtp_seguranca: EmailSecurity;
  imap_host: string;
  imap_porta: string;
}

/** Troca de provedor preenche os servidores. "Próprio" mantém o que estiver digitado. */
function aplicarProvedor(f: Formulario, value: string): Formulario {
  const p = providerByValue(value);
  const novo: Formulario = { ...f, provedor: value };
  if (p.smtpHost) {
    novo.smtp_host = p.smtpHost;
    novo.smtp_porta = String(p.smtpPort ?? 465);
    novo.smtp_seguranca = p.smtpSecurity ?? "ssl";
  }
  if (p.semRecebimento) {
    // Microsoft não aceita senha para ler a caixa: deixar a entrada seria falha garantida
    novo.imap_host = "";
    novo.imap_porta = "";
  } else if (p.imapHost) {
    novo.imap_host = p.imapHost;
    novo.imap_porta = String(p.imapPort ?? 993);
  }
  return novo;
}

function formularioDaConta(conta: ContaEmail | null): Formulario {
  if (!conta) {
    return aplicarProvedor(
      {
        provedor: "gmail",
        email: "",
        nome_remetente: "DoctorDev",
        usuario: "",
        senha: "",
        smtp_host: "",
        smtp_porta: "465",
        smtp_seguranca: "ssl",
        imap_host: "",
        imap_porta: "993",
      },
      "gmail",
    );
  }
  return {
    provedor: conta.provedor,
    email: conta.email,
    nome_remetente: conta.nome_remetente ?? "",
    // usuário igual ao e-mail fica vazio: é o padrão, não precisa aparecer
    usuario: conta.usuario === conta.email ? "" : conta.usuario,
    senha: "",
    smtp_host: conta.smtp_host,
    smtp_porta: String(conta.smtp_porta),
    smtp_seguranca: conta.smtp_seguranca,
    imap_host: conta.imap_host ?? "",
    imap_porta: conta.imap_porta ? String(conta.imap_porta) : "",
  };
}

const portaValida = (v: string) => /^\d+$/.test(v) && Number(v) >= 1 && Number(v) <= 65535;

// ─── textos de situação ──────────────────────────────────────────────────

const dataHora = (iso: string) =>
  new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Sao_Paulo",
  }).format(new Date(iso));

/** ultimo_teste_erro = "frase [detalhe técnico]": a tela mostra só a frase. */
function fraseDoTeste(erro: string | null): string {
  if (!erro) return "Falha no teste.";
  const corte = erro.indexOf(" [");
  return corte > 0 ? erro.slice(0, corte) : erro;
}

/** O leitor grava o erro cru do servidor; aqui ele vira instrução. */
function fraseDoLeitor(erro: string): string {
  if (/authenticationfailed|invalid credentials|^login/i.test(erro)) {
    return "A caixa de e-mail recusou a senha. Gere uma senha nova (no Gmail, senha de aplicativo), salve aqui e teste.";
  }
  if (/^A conta de e-mail|^O DoctorDev só lê/.test(erro)) return erro;
  if (/IMAP não configurado/.test(erro)) return "Nenhuma conta cadastrada para ler as respostas.";
  if (/tempo limite|não respondeu|timeout/i.test(erro)) {
    return "O servidor de entrada não respondeu a tempo. Se continuar, confira o servidor e a porta de entrada.";
  }
  return `A leitura falhou: ${erro.replace(/\s+—\s+/g, ": ").slice(0, 180)}`;
}

type Tom = "ok" | "falha" | "aviso" | "neutro";

const TONS: Record<Tom, { icone: LucideIcon; classe: string }> = {
  ok: { icone: CheckCircle2, classe: "text-emerald-600 dark:text-emerald-400" },
  falha: { icone: XCircle, classe: "text-destructive" },
  aviso: { icone: AlertTriangle, classe: "text-amber-600 dark:text-amber-400" },
  neutro: { icone: CircleDashed, classe: "text-muted-foreground" },
};

function LinhaSituacao({
  icone: IconeArea,
  area,
  tom,
  titulo,
  detalhe,
}: {
  icone: LucideIcon;
  area: string;
  tom: Tom;
  titulo: string;
  detalhe: string;
}) {
  const { icone: IconeTom, classe } = TONS[tom];
  return (
    <div className="flex gap-3 py-3 first:pt-0 last:pb-0">
      <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-md bg-muted text-muted-foreground">
        <IconeArea className="h-4 w-4" />
      </span>
      <div className="min-w-0 flex-1 space-y-0.5">
        <p className="text-xs uppercase tracking-wider text-muted-foreground">{area}</p>
        <p className={cn("flex items-center gap-1.5 text-sm font-medium", classe)}>
          <IconeTom className="h-4 w-4 shrink-0" />
          <span className="min-w-0 break-words">{titulo}</span>
        </p>
        <p className="text-sm text-muted-foreground">{detalhe}</p>
      </div>
    </div>
  );
}

function Situacao({ config }: { config: ConfiguracaoEmail }) {
  const { conta, leitor } = config;

  const envio: { tom: Tom; titulo: string; detalhe: string } = !conta
    ? {
        tom: "aviso",
        titulo: "Nenhuma conta cadastrada",
        detalhe:
          "Os e-mails ainda saem pela configuração antiga do sistema. Cadastre a conta abaixo.",
      }
    : conta.ultimo_teste_ok === true
      ? {
          tom: "ok",
          titulo: `Enviando por ${conta.email}`,
          detalhe: `Testada em ${dataHora(conta.ultimo_teste_em!)}.`,
        }
      : conta.ultimo_teste_ok === false
        ? {
            tom: "falha",
            titulo: "O último teste falhou",
            detalhe: fraseDoTeste(conta.ultimo_teste_erro),
          }
        : {
            tom: "neutro",
            titulo: `Enviando por ${conta.email}`,
            detalhe: "Ainda não testada. Clique em Salvar e testar.",
          };

  const leitura: { tom: Tom; titulo: string; detalhe: string } =
    conta && !conta.imap_host
      ? {
          tom: "neutro",
          titulo: "Desligada",
          detalhe:
            "A conta não tem servidor de entrada. As respostas dos clientes não entram nas demandas.",
        }
      : leitor?.ultimo_erro
        ? {
            tom: "falha",
            titulo: "A leitura das respostas está falhando",
            detalhe:
              fraseDoLeitor(leitor.ultimo_erro) +
              (leitor.ultima_execucao
                ? ` Última tentativa em ${dataHora(leitor.ultima_execucao)}.`
                : ""),
          }
        : leitor?.ultima_execucao
          ? {
              tom: "ok",
              titulo: "Lendo as respostas dos clientes",
              detalhe: `Última leitura em ${dataHora(leitor.ultima_execucao)}. A caixa é conferida a cada 5 minutos.`,
            }
          : {
              tom: "neutro",
              titulo: "A leitura ainda não rodou",
              detalhe: "A primeira leitura acontece em até 5 minutos depois de salvar.",
            };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Situação</CardTitle>
      </CardHeader>
      <CardContent className="divide-y divide-border">
        <LinhaSituacao icone={Send} area="Envio" {...envio} />
        <LinhaSituacao icone={Inbox} area="Leitura das respostas" {...leitura} />
      </CardContent>
    </Card>
  );
}

function ResultadoDoTeste({ resultado }: { resultado: ResultadoTeste }) {
  const linhas: { rotulo: string; ok: boolean; erro?: string }[] = [
    { rotulo: "Envio", ok: resultado.smtp.ok, erro: resultado.smtp.erro },
  ];
  if (resultado.imap)
    linhas.push({ rotulo: "Leitura", ok: resultado.imap.ok, erro: resultado.imap.erro });

  return (
    <div
      className={cn(
        "space-y-2 rounded-md border px-3 py-3",
        resultado.ok
          ? "border-emerald-500/40 bg-emerald-500/5"
          : "border-destructive/40 bg-destructive/5",
      )}
    >
      {linhas.map((l) => (
        <div key={l.rotulo} className="flex gap-2 text-sm">
          {l.ok ? (
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
          ) : (
            <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
          )}
          <p>
            <span className="font-medium">{l.rotulo}:</span>{" "}
            {l.ok ? "funcionando." : (l.erro ?? "falhou.")}
          </p>
        </div>
      ))}
      {!resultado.imap && resultado.ok && (
        <p className="text-xs text-muted-foreground">
          Sem servidor de entrada: as respostas dos clientes não serão lidas.
        </p>
      )}
    </div>
  );
}

// ─── página ──────────────────────────────────────────────────────────────

function ContaEmailPage() {
  const { temPermissao, isLoading: carregandoPerfil } = useProfile();
  const ehAdmin = temPermissao("gerenciar_usuarios") && temPermissao("gerenciar_perfis_acesso");

  const consulta = useContaEmail(ehAdmin);
  const salvar = useSalvarContaEmail();
  const testar = useTestarContaEmail();

  const [form, setForm] = React.useState<Formulario>(() => formularioDaConta(null));
  const [mostrarSenha, setMostrarSenha] = React.useState(false);
  const [guiaAberto, setGuiaAberto] = React.useState(false);
  const [servidoresAbertos, setServidoresAbertos] = React.useState(false);
  const [resultado, setResultado] = React.useState<ResultadoTeste | null>(null);

  const conta = consulta.data?.conta ?? null;
  const preset = providerByValue(form.provedor);
  const ocupado = salvar.isPending || testar.isPending;

  // Recarrega o formulário quando a conta gravada muda (primeira carga ou
  // depois de salvar). A consulta repete a cada minuto por causa do leitor, e
  // isso não pode apagar o que a pessoa está digitando.
  const versaoCarregada = React.useRef<string | null>(null);
  React.useEffect(() => {
    if (!consulta.data) return;
    const versao = conta?.atualizado_em ?? "sem-conta";
    if (versaoCarregada.current === versao) return;
    versaoCarregada.current = versao;

    const novo = formularioDaConta(conta);
    setForm(novo);
    const p = providerByValue(novo.provedor);
    setGuiaAberto(conta?.ultimo_teste_ok === false || !!p.exigeSenhaApp || !!p.guia.bloqueio);
    setServidoresAbertos(novo.provedor === "custom");
  }, [consulta.data, conta]);

  const campo =
    <K extends keyof Formulario>(k: K) =>
    (valor: Formulario[K]) =>
      setForm((f) => ({ ...f, [k]: valor }));

  const escolherProvedor = (value: string) => {
    setForm((f) => aplicarProvedor(f, value));
    const p = providerByValue(value);
    setGuiaAberto(!!p.exigeSenhaApp || !!p.guia.bloqueio);
    if (value === "custom") setServidoresAbertos(true);
  };

  const submeter = async (testarDepois: boolean) => {
    const email = form.email.trim().toLowerCase();
    const imapHost = form.imap_host.trim();

    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return toast.error("Informe um e-mail válido.");
    if (!conta && !form.senha) return toast.error("Informe a senha da conta.");
    if (!form.smtp_host.trim()) {
      setServidoresAbertos(true);
      return toast.error("Informe o servidor de saída em Servidores.");
    }
    if (!portaValida(form.smtp_porta)) {
      setServidoresAbertos(true);
      return toast.error("Porta de saída inválida.");
    }
    if (imapHost && !portaValida(form.imap_porta)) {
      setServidoresAbertos(true);
      return toast.error("Porta de entrada inválida.");
    }

    setResultado(null);
    try {
      await salvar.mutateAsync({
        provedor: form.provedor,
        email,
        nome_remetente: form.nome_remetente.trim(),
        usuario: form.usuario.trim(),
        // senha de aplicativo do Google e do Yahoo é mostrada em blocos com espaço
        senha: preset.exigeSenhaApp ? form.senha.replace(/\s+/g, "") : form.senha,
        smtp_host: form.smtp_host.trim(),
        smtp_porta: Number(form.smtp_porta),
        smtp_seguranca: form.smtp_seguranca,
        imap_host: imapHost,
        imap_porta: imapHost ? Number(form.imap_porta) : null,
      });
      setMostrarSenha(false);
    } catch (err) {
      return toast.error((err as Error).message || "Não foi possível salvar a conta.");
    }

    if (!testarDepois) {
      toast.success("Conta salva.");
      return;
    }

    try {
      const r = await testar.mutateAsync();
      setResultado(r);
      if (r.ok) toast.success(r.mensagem);
      else toast.error(r.mensagem);
    } catch (err) {
      toast.error((err as Error).message || "Não foi possível testar a conta.");
    }
  };

  if (carregandoPerfil) {
    return (
      <div className="max-w-3xl space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (!ehAdmin) {
    return (
      <EmptyState
        icon={Lock}
        title="Acesso restrito"
        description="Só administradores configuram a conta de e-mail."
      />
    );
  }

  return (
    <div className="max-w-3xl">
      <PageHeader
        title="E-mail"
        description="Conta que o DoctorDev usa para mandar mensagens aos clientes e ler as respostas deles."
      />

      {consulta.isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-36 w-full" />
          <Skeleton className="h-96 w-full" />
        </div>
      ) : consulta.isError ? (
        <Card>
          <CardContent className="py-6 text-sm text-destructive">
            Não foi possível carregar a conta de e-mail: {consulta.error.message}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {consulta.data && <Situacao config={consulta.data} />}

          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                {conta ? "Conta de e-mail" : "Cadastrar conta de e-mail"}
              </CardTitle>
              <CardDescription>
                Escolha o provedor e o DoctorDev preenche os servidores. Basta informar o e-mail e a
                senha.
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-6">
              {/* Provedor */}
              <section className="space-y-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Provedor
                </p>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {EMAIL_PROVIDERS.map((p) => {
                    const selecionado = p.value === form.provedor;
                    return (
                      <button
                        key={p.value}
                        type="button"
                        onClick={() => escolherProvedor(p.value)}
                        aria-pressed={selecionado}
                        disabled={ocupado}
                        className={cn(
                          "flex flex-col items-center gap-1.5 rounded-md border px-2 py-2.5 text-xs font-medium transition-colors disabled:opacity-60",
                          selecionado
                            ? "border-primary bg-primary/10 text-primary ring-1 ring-primary"
                            : "border-border hover:bg-muted/60",
                        )}
                      >
                        <ProviderLogo value={p.value} size="sm" />
                        {p.label}
                      </button>
                    );
                  })}
                </div>
              </section>

              {/* Acesso */}
              <section className="space-y-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Acesso
                </p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="email-endereco">E-mail</Label>
                    <Input
                      id="email-endereco"
                      type="email"
                      autoComplete="off"
                      value={form.email}
                      onChange={(e) => campo("email")(e.target.value)}
                      placeholder="suporte@suaempresa.com.br"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="email-senha">
                      {preset.exigeSenhaApp ? "Senha de aplicativo" : "Senha"}
                    </Label>
                    <div className="relative">
                      <Input
                        id="email-senha"
                        type={mostrarSenha ? "text" : "password"}
                        autoComplete="new-password"
                        className="pr-10"
                        value={form.senha}
                        onChange={(e) => campo("senha")(e.target.value)}
                        placeholder={
                          conta
                            ? "Deixe em branco para manter a atual"
                            : preset.exigeSenhaApp
                              ? "Cole aqui a senha de aplicativo"
                              : "Senha da caixa de e-mail"
                        }
                      />
                      <button
                        type="button"
                        onClick={() => setMostrarSenha((v) => !v)}
                        className="absolute inset-y-0 right-0 grid w-10 place-items-center text-muted-foreground hover:text-foreground"
                        aria-label={mostrarSenha ? "Esconder senha" : "Mostrar senha"}
                      >
                        {mostrarSenha ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  </div>
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label htmlFor="email-nome">Nome do remetente</Label>
                    <Input
                      id="email-nome"
                      value={form.nome_remetente}
                      onChange={(e) => campo("nome_remetente")(e.target.value)}
                      placeholder="DoctorDev"
                    />
                    <p className="text-xs text-muted-foreground">
                      Nome que o cliente vê ao receber o e-mail.
                    </p>
                  </div>
                </div>

                <Collapsible
                  open={guiaAberto}
                  onOpenChange={setGuiaAberto}
                  className={cn(
                    "rounded-md border",
                    preset.guia.bloqueio
                      ? "border-destructive/40"
                      : preset.exigeSenhaApp
                        ? "border-amber-500/50"
                        : "border-border",
                  )}
                >
                  <CollapsibleTrigger className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm font-medium">
                    <BookOpen className="h-4 w-4 shrink-0 text-primary" />
                    <span className="flex-1">Como liberar o acesso no {preset.label}</span>
                    <ChevronDown
                      className={cn(
                        "h-4 w-4 text-muted-foreground transition-transform",
                        !guiaAberto && "-rotate-90",
                      )}
                    />
                  </CollapsibleTrigger>
                  <CollapsibleContent className="px-3 pb-4">
                    <GuiaProvedor preset={preset} />
                  </CollapsibleContent>
                </Collapsible>
              </section>

              {/* Servidores */}
              <Collapsible
                open={servidoresAbertos}
                onOpenChange={setServidoresAbertos}
                className="rounded-md border border-border"
              >
                <CollapsibleTrigger className="flex w-full items-center gap-2 px-3 py-2.5 text-sm font-medium">
                  <ChevronDown
                    className={cn(
                      "h-4 w-4 text-muted-foreground transition-transform",
                      !servidoresAbertos && "-rotate-90",
                    )}
                  />
                  Servidores
                  {form.provedor !== "custom" && (
                    <Badge variant="secondary" className="ml-auto font-normal">
                      Preenchido pelo provedor
                    </Badge>
                  )}
                </CollapsibleTrigger>
                <CollapsibleContent className="space-y-4 px-3 pb-4">
                  <div className="space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Saída (SMTP)
                    </p>
                    <div className="grid gap-3 sm:grid-cols-[2fr_1fr_1.2fr]">
                      <div className="space-y-1.5">
                        <Label htmlFor="smtp-host">Servidor</Label>
                        <Input
                          id="smtp-host"
                          value={form.smtp_host}
                          onChange={(e) => campo("smtp_host")(e.target.value)}
                          placeholder="smtp.suaempresa.com.br"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="smtp-porta">Porta</Label>
                        <Input
                          id="smtp-porta"
                          inputMode="numeric"
                          value={form.smtp_porta}
                          onChange={(e) => campo("smtp_porta")(e.target.value.replace(/\D/g, ""))}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="smtp-seg">Segurança</Label>
                        <Select
                          value={form.smtp_seguranca}
                          onValueChange={(v) => campo("smtp_seguranca")(v as EmailSecurity)}
                        >
                          <SelectTrigger id="smtp-seg">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {Object.entries(SECURITY_LABELS).map(([v, rotulo]) => (
                              <SelectItem key={v} value={v}>
                                {rotulo}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Entrada (IMAP)
                    </p>
                    <div className="grid gap-3 sm:grid-cols-[2fr_1fr_1.2fr]">
                      <div className="space-y-1.5">
                        <Label htmlFor="imap-host">Servidor</Label>
                        <Input
                          id="imap-host"
                          value={form.imap_host}
                          onChange={(e) => campo("imap_host")(e.target.value)}
                          placeholder="imap.suaempresa.com.br"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="imap-porta">Porta</Label>
                        <Input
                          id="imap-porta"
                          inputMode="numeric"
                          value={form.imap_porta}
                          onChange={(e) => campo("imap_porta")(e.target.value.replace(/\D/g, ""))}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="imap-seg">Segurança</Label>
                        <Input id="imap-seg" value={SECURITY_LABELS.ssl} disabled />
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {preset.semRecebimento
                        ? `O ${preset.label} não aceita senha para ler a caixa. Deixe em branco: as respostas dos clientes não serão lidas.`
                        : "Deixe em branco se as respostas dos clientes não devem ser lidas. O DoctorDev só lê a caixa com SSL/TLS."}
                    </p>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="email-usuario">Usuário</Label>
                    <Input
                      id="email-usuario"
                      value={form.usuario}
                      onChange={(e) => campo("usuario")(e.target.value)}
                      placeholder={form.email || "igual ao e-mail"}
                    />
                    <p className="text-xs text-muted-foreground">
                      Só preencha se o login for diferente do e-mail. Vale para a saída e para a
                      entrada.
                    </p>
                  </div>
                </CollapsibleContent>
              </Collapsible>

              {conta && (
                <p className="text-xs text-muted-foreground">
                  Trocar o e-mail ou o servidor de entrada faz a leitura recomeçar do momento em que
                  você salvar. Respostas que chegaram antes na caixa anterior não entram.
                </p>
              )}

              {resultado && <ResultadoDoTeste resultado={resultado} />}

              <div className="flex flex-wrap justify-end gap-2 border-t border-border pt-4">
                <Button variant="outline" onClick={() => submeter(false)} disabled={ocupado}>
                  {salvar.isPending && !testar.isPending && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  Salvar
                </Button>
                <Button onClick={() => submeter(true)} disabled={ocupado}>
                  {testar.isPending ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Plug className="mr-2 h-4 w-4" />
                  )}
                  {testar.isPending ? "Testando..." : "Salvar e testar"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
