import * as React from "react";
import { Sparkles, Loader2, CheckCircle2, AlertTriangle, FileText, Rocket } from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "@tanstack/react-router";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useProfile } from "@/hooks/useProfile";
import {
  useReleaseDaDemanda,
  useMarcarIncluirRelease,
  useSalvarRascunhoRelease,
  usePublicarRelease,
  useDespublicarRelease,
  useGerarResumoReleaseIA,
} from "@/hooks/useReleases";
import { TIPO_RELEASE_LABEL, type TipoRelease } from "@/types/release";

interface ReleaseTabProps {
  demandaId: string;
  demandaTipo: string;
  incluirRelease: boolean;
  tituloInicial?: string;
  resumoInicial?: string;
  onConsumeInicial?: () => void;
}

export function ReleaseTab({
  demandaId,
  demandaTipo,
  incluirRelease,
  tituloInicial,
  resumoInicial,
  onConsumeInicial,
}: ReleaseTabProps) {
  const navigate = useNavigate();
  const { temPermissao } = useProfile();
  const podeGerenciar = temPermissao("gerenciar_releases");
  const { data: release } = useReleaseDaDemanda(demandaId);
  const marcar = useMarcarIncluirRelease();
  const salvar = useSalvarRascunhoRelease();
  const publicar = usePublicarRelease();
  const despublicar = useDespublicarRelease();
  const gerarIA = useGerarResumoReleaseIA();

  const [tipoRelease, setTipoRelease] = React.useState<TipoRelease>(
    (release?.tipo_release ?? demandaTipo) as TipoRelease,
  );
  const [titulo, setTitulo] = React.useState(release?.titulo ?? tituloInicial ?? "");
  const [resumo, setResumo] = React.useState(release?.resumo ?? resumoInicial ?? "");

  React.useEffect(() => {
    if (release) {
      setTipoRelease(release.tipo_release);
      setTitulo(release.titulo);
      setResumo(release.resumo);
    } else {
      setTitulo(tituloInicial ?? "");
      setResumo(resumoInicial ?? "");
      setTipoRelease(demandaTipo as TipoRelease);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [release, demandaTipo]);

  // Aplica valores iniciais (vindos do dialog) quando ainda não há release
  React.useEffect(() => {
    console.log("[ReleaseFlow] 6. ReleaseTab mount/update", {
      demandaId,
      incluirRelease,
      tituloInicial,
      resumoInicial,
      hasRelease: !!release,
    });
    if (!release && (tituloInicial || resumoInicial)) {
      if (tituloInicial) setTitulo(tituloInicial);
      if (resumoInicial) setResumo(resumoInicial);
      onConsumeInicial?.();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tituloInicial, resumoInicial, release]);

  const incluido = incluirRelease;
  const publicada = !!release?.published_at;
  const podeEditar = podeGerenciar && !publicada;

  if (!podeGerenciar) {
    return (
      <div className="rounded-lg border border-border bg-card p-6 text-sm text-muted-foreground">
        {publicada
          ? "Esta demanda está publicada nas Releases."
          : "Esta demanda não está incluída nas Releases."}
      </div>
    );
  }

  const handleToggle = (checked: boolean) => {
    if (publicada && !checked) {
      if (
        !confirm(
          "Esta release já está publicada. Ao desmarcar, ela será removida do feed. Continuar?",
        )
      )
        return;
      despublicar.mutate(release!.id, {
        onSuccess: () => marcar.mutate({ demandaId, incluir: false }),
      });
      return;
    }
    marcar.mutate({ demandaId, incluir: checked });
  };

  const handleGerarIA = async () => {
    try {
      const res = await gerarIA.mutateAsync({ demandaId });
      setTitulo(res.titulo);
      setResumo(res.resumo);
    } catch {
      /* erro tratado no hook */
    }
  };

  const handleSalvarEPublicar = async () => {
    if (!titulo.trim() || !resumo.trim()) {
      toast.error("Preencha título e resumo");
      return;
    }
    try {
      const releaseSalva = await salvar.mutateAsync({
        demandaId,
        tipoRelease,
        titulo,
        resumo,
      });
      await publicar.mutateAsync(releaseSalva.id);
      void navigate({ to: "/releases" });
    } catch {
      /* erro tratado no hook */
    }
  };

  return (
    <div className="space-y-4 rounded-lg border border-border bg-card p-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h3 className="text-base font-semibold text-foreground">
            Incluir nas Releases
          </h3>
          <p className="text-xs text-muted-foreground">
            Esta demanda aparecerá no feed público de releases
          </p>
        </div>
        <Switch
          checked={incluido}
          onCheckedChange={handleToggle}
          disabled={marcar.isPending || despublicar.isPending}
        />
      </div>

      {incluido && (
        <div className="space-y-4 border-t border-border pt-4">
          <div>
            {publicada ? (
              <span className="inline-flex items-center gap-1.5 rounded-md border border-emerald-500/20 bg-emerald-500/10 px-2 py-1 text-xs text-emerald-300">
                <CheckCircle2 className="h-3.5 w-3.5" />
                Publicada em{" "}
                {new Date(release!.published_at!).toLocaleString("pt-BR")}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 rounded-md border border-border bg-muted px-2 py-1 text-xs text-muted-foreground">
                <FileText className="h-3.5 w-3.5" />
                Pronto para publicar
              </span>
            )}
          </div>

          <div>
            <Label htmlFor="release-tipo">Tipo</Label>
            <Select
              value={tipoRelease}
              onValueChange={(v) => setTipoRelease(v as TipoRelease)}
              disabled={!podeEditar}
            >
              <SelectTrigger id="release-tipo" className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(TIPO_RELEASE_LABEL).map(([v, label]) => (
                  <SelectItem key={v} value={v}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="release-titulo">Título</Label>
            <Input
              id="release-titulo"
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              placeholder="Ex: Login com Google agora disponível"
              maxLength={120}
              disabled={!podeEditar}
              className="mt-1"
            />
          </div>

          <div>
            <div className="flex items-center justify-between">
              <Label htmlFor="release-resumo">
                Resumo (linguagem cliente final)
              </Label>
              {podeEditar && (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={handleGerarIA}
                  disabled={gerarIA.isPending}
                  className="gap-1.5"
                >
                  {gerarIA.isPending ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Sparkles className="h-3.5 w-3.5 text-purple-500" />
                  )}
                  Gerar com IA
                </Button>
              )}
            </div>
            <Textarea
              id="release-resumo"
              value={resumo}
              onChange={(e) => setResumo(e.target.value)}
              placeholder="Descreva o que mudou pro cliente final, em poucas frases..."
              rows={4}
              maxLength={500}
              disabled={!podeEditar}
              className="mt-1 resize-none"
            />
            <div className="mt-1 text-right text-xs text-muted-foreground">
              {resumo.length}/500
            </div>
          </div>

          {podeEditar && (
            <div className="flex justify-end gap-2 border-t border-border pt-3">
              <Button
                onClick={handleSalvarEPublicar}
                disabled={salvar.isPending || publicar.isPending}
                className="gap-1.5"
              >
                {(salvar.isPending || publicar.isPending) ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Rocket className="h-3.5 w-3.5" />
                )}
                Salvar e Publicar
              </Button>
            </div>
          )}

          {publicada && (
            <div className="flex justify-end gap-2 border-t border-border pt-3">
              <Button
                variant="outline"
                onClick={() => {
                  if (
                    confirm(
                      "Despublicar release? Sairá do feed e voltará pra rascunho.",
                    )
                  ) {
                    despublicar.mutate(release!.id);
                  }
                }}
                disabled={despublicar.isPending}
              >
                Despublicar
              </Button>
            </div>
          )}
        </div>
      )}

      {!incluido && (
        <div className="flex items-start gap-2 rounded-md border border-blue-500/20 bg-blue-500/10 p-3 text-xs text-blue-200">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>
            Quando uma demanda muda para &quot;Entregue&quot;, o sistema pergunta se
            você quer adicionar nas Releases. Você também pode marcar/desmarcar
            manualmente aqui.
          </span>
        </div>
      )}
    </div>
  );
}
