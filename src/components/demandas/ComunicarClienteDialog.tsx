import * as React from "react";
import { AlertTriangle, Check, Loader2, Mail, MessageCircle, Send, Sparkles } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";

import {
  useDadosComunicacao,
  useEnviarComunicacao,
  useGerarMensagemCliente,
} from "@/hooks/useComunicacaoDemanda";
import { formatarTelefoneBR } from "@/types/comunicacao";
import type { CanalComunicacao, MomentoComunicacao } from "@/types/comunicacao";

interface ComunicarClienteDialogProps {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  demandaId: string;
  demandaCodigo: string;
  /** Se não vier, o servidor deriva pelo status da demanda. */
  momento?: MomentoComunicacao;
}

export function ComunicarClienteDialog({
  open,
  onOpenChange,
  demandaId,
  demandaCodigo,
  momento,
}: ComunicarClienteDialogProps) {
  const { data: dados, isLoading } = useDadosComunicacao(demandaId, open);
  const gerar = useGerarMensagemCliente();
  const enviar = useEnviarComunicacao();

  const [canal, setCanal] = React.useState<CanalComunicacao>("email");
  const [assunto, setAssunto] = React.useState("");
  const [corpoEmail, setCorpoEmail] = React.useState("");
  const [corpoWhats, setCorpoWhats] = React.useState("");
  const [telefone, setTelefone] = React.useState("");

  // Reabrir o dialog começa do zero — não reaproveita rascunho de outra demanda
  React.useEffect(() => {
    if (!open) return;
    setCanal("email");
    setAssunto("");
    setCorpoEmail("");
    setCorpoWhats("");
  }, [open, demandaId]);

  React.useEffect(() => {
    if (dados?.solicitante?.telefone) {
      setTelefone(formatarTelefoneBR(dados.solicitante.telefone));
    }
  }, [dados?.solicitante?.telefone]);

  const corpo = canal === "email" ? corpoEmail : corpoWhats;
  const setCorpo = canal === "email" ? setCorpoEmail : setCorpoWhats;

  const email = dados?.solicitante?.email ?? "";
  const semRetorno = (dados?.retornos?.length ?? 0) === 0;
  const telefoneDigitos = telefone.replace(/\D/g, "");
  const telefoneValido = telefoneDigitos.length >= 10;

  const handleGerar = async () => {
    try {
      const res = await gerar.mutateAsync({ demandaId, canal, momento });
      if (canal === "email") {
        setAssunto(res.assunto);
        setCorpoEmail(res.corpo);
      } else {
        setCorpoWhats(res.corpo);
      }
    } catch {
      // toast já mostrado no hook
    }
  };

  const handleEnviar = async () => {
    try {
      await enviar.mutateAsync({
        demandaId,
        canal,
        corpo,
        assunto: canal === "email" ? assunto : undefined,
        telefone: canal === "whatsapp" ? telefoneDigitos : undefined,
      });
      onOpenChange(false);
    } catch {
      // toast já mostrado no hook
    }
  };

  const podeEnviar =
    corpo.trim().length > 0 &&
    !enviar.isPending &&
    !gerar.isPending &&
    (canal === "email" ? !!email && assunto.trim().length > 0 : telefoneValido);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Send className="h-4 w-4 text-primary" />
            Comunicar cliente — {demandaCodigo}
          </DialogTitle>
          <DialogDescription>
            {dados?.solicitante?.nome
              ? `Para ${dados.solicitante.nome}${dados.empresa ? ` · ${dados.empresa}` : ""}`
              : "Envie o parecer ou a conclusão ao solicitante."}
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="space-y-3 py-2">
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-40 w-full" />
          </div>
        ) : (
          <>
            {semRetorno && (
              <div className="flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-700 dark:text-amber-400">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>
                  Esta demanda não tem nenhum parecer registrado. Publique um retorno na aba
                  Retornos — a IA escreve a partir dele.
                </span>
              </div>
            )}

            <Tabs value={canal} onValueChange={(v) => setCanal(v as CanalComunicacao)}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="email" className="gap-1.5">
                  <Mail className="h-3.5 w-3.5" />
                  E-mail
                </TabsTrigger>
                <TabsTrigger value="whatsapp" className="gap-1.5">
                  <MessageCircle className="h-3.5 w-3.5" />
                  WhatsApp
                </TabsTrigger>
              </TabsList>

              <TabsContent value="email" className="mt-4 space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="com-email-para">Para</Label>
                  <Input id="com-email-para" value={email} readOnly disabled />
                  {!email && (
                    <p className="text-xs text-destructive">
                      O solicitante não tem e-mail cadastrado.
                    </p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="com-email-assunto">Assunto</Label>
                  <Input
                    id="com-email-assunto"
                    value={assunto}
                    onChange={(e) => setAssunto(e.target.value)}
                    placeholder="Assunto do e-mail"
                    maxLength={120}
                  />
                </div>
              </TabsContent>

              <TabsContent value="whatsapp" className="mt-4 space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="com-whats-tel">Número (com DDD)</Label>
                  <Input
                    id="com-whats-tel"
                    value={telefone}
                    onChange={(e) => setTelefone(e.target.value)}
                    placeholder="(11) 99999-8888"
                    inputMode="tel"
                  />
                  <p className="text-xs text-muted-foreground">
                    {dados?.solicitante?.telefone
                      ? "Salvo no cadastro. Se corrigir aqui, o novo número fica salvo."
                      : "Sem número no cadastro. O que você digitar aqui fica salvo no perfil."}
                  </p>
                </div>
              </TabsContent>
            </Tabs>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="com-corpo">Mensagem</Label>
                <span className="text-xs text-muted-foreground">
                  {corpo.trim() ? `${corpo.trim().split(/\s+/).length} palavras` : ""}
                </span>
              </div>
              <Textarea
                id="com-corpo"
                value={corpo}
                onChange={(e) => setCorpo(e.target.value)}
                rows={canal === "email" ? 10 : 6}
                className="resize-none"
                placeholder={
                  canal === "email"
                    ? "Escreva ou gere com IA a mensagem que o cliente vai receber por e-mail..."
                    : "Mensagem curta para o WhatsApp do cliente..."
                }
              />
              <p className="text-xs text-muted-foreground">
                A IA sugere a partir dos pareceres registrados. Revise antes de enviar — o texto vai
                exatamente como está aqui.
              </p>
            </div>

            {dados && dados.envios.length > 0 && (
              <div className="rounded-md border border-border bg-muted/30 p-3">
                <p className="mb-1.5 text-xs font-medium text-muted-foreground">
                  Já enviado nesta demanda
                </p>
                <ul className="space-y-1">
                  {dados.envios.slice(0, 3).map((e) => (
                    <li
                      key={e.id}
                      className="flex items-center gap-1.5 text-xs text-muted-foreground"
                    >
                      {e.canal === "email" ? (
                        <Mail className="h-3 w-3" />
                      ) : (
                        <MessageCircle className="h-3 w-3" />
                      )}
                      <span>{e.destinatario}</span>
                      <span>·</span>
                      <span>
                        {new Date(e.enviado_em).toLocaleString("pt-BR", {
                          day: "2-digit",
                          month: "2-digit",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                      {e.status !== "enviado" && <span className="text-destructive">· falhou</span>}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={handleGerar}
            disabled={gerar.isPending || enviar.isPending || semRetorno || isLoading}
          >
            {gerar.isPending ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : (
              <Sparkles className="mr-1.5 h-3.5 w-3.5 text-purple-500" />
            )}
            {corpo.trim() ? "Gerar novamente" : "Gerar com IA"}
          </Button>
          <Button onClick={handleEnviar} disabled={!podeEnviar}>
            {enviar.isPending ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : (
              <Check className="mr-1.5 h-3.5 w-3.5" />
            )}
            {canal === "email" ? "Enviar e-mail" : "Enviar WhatsApp"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
