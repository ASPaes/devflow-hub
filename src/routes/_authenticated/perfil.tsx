import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import * as React from "react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { supabase } from "@/lib/supabase";
import { initials } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/perfil")({
  component: PerfilPage,
});

const perfilSchema = z.object({
  nome: z.string().trim().min(2, "Nome muito curto").max(100, "Nome muito longo"),
});

type PerfilInput = z.infer<typeof perfilSchema>;

function PerfilPage() {
  const { user } = useAuth();
  const { profile, isLoading } = useProfile();
  const queryClient = useQueryClient();

  const form = useForm<PerfilInput>({
    resolver: zodResolver(perfilSchema),
    values: { nome: profile?.nome ?? "" },
  });

  const mutation = useMutation({
    mutationFn: async (input: PerfilInput) => {
      if (!user?.id) throw new Error("Sessão inválida");
      const { error } = await supabase
        .from("profiles")
        .update({ nome: input.nome })
        .eq("id", user.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Perfil atualizado");
      queryClient.invalidateQueries({ queryKey: ["profile", user?.id] });
    },
    onError: (err: Error) => {
      toast.error(err.message ?? "Erro ao atualizar perfil");
    },
  });

  const onSubmit = React.useCallback(
    (data: PerfilInput) => mutation.mutate(data),
    [mutation],
  );

  if (isLoading || !profile) {
    return (
      <Card className="mx-auto max-w-xl">
        <CardHeader>
          <Skeleton className="h-16 w-16 rounded-full" />
          <Skeleton className="mt-3 h-5 w-40" />
          <Skeleton className="mt-2 h-4 w-56" />
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-32" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="mx-auto max-w-xl">
      <CardHeader className="flex flex-row items-center gap-4 space-y-0">
        <Avatar className="h-16 w-16">
          <AvatarFallback className="bg-primary/20 text-lg font-semibold text-primary">
            {initials(profile.nome || "?")}
          </AvatarFallback>
        </Avatar>
        <div className="flex flex-col gap-1">
          <h2 className="text-lg font-semibold text-foreground">{profile.nome}</h2>
          <p className="text-sm text-muted-foreground">{user?.email}</p>
          <div>
            <Badge variant="secondary" className="font-mono text-xs">
              {profile.role}
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="nome"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome</FormLabel>
                  <FormControl>
                    <Input placeholder="Seu nome" autoComplete="name" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormItem>
              <FormLabel>E-mail</FormLabel>
              <FormControl>
                <Input value={user?.email ?? ""} readOnly disabled />
              </FormControl>
            </FormItem>

            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Salvar alterações
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
