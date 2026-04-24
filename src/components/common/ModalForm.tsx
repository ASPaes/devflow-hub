import * as React from "react";
import {
  useForm,
  type DefaultValues,
  type Resolver,
  type UseFormReturn,
} from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { ZodType } from "zod";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Form } from "@/components/ui/form";
import { translateSupabaseError } from "@/lib/supabase-errors";

interface ModalFormProps<T extends Record<string, unknown>> {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  schema: ZodType<T>;
  defaultValues: T;
  onSubmit: (values: T) => Promise<void>;
  submitLabel?: string;
  cancelLabel?: string;
  children: (form: UseFormReturn<T>) => React.ReactNode;
}

export function ModalForm<T extends Record<string, unknown>>({
  open,
  onOpenChange,
  title,
  description,
  schema,
  defaultValues,
  onSubmit,
  submitLabel = "Salvar",
  cancelLabel = "Cancelar",
  children,
}: ModalFormProps<T>) {
  const form = useForm<T>({
    // Cast to bypass cross-version zod/resolvers generic clash
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(schema as any) as unknown as Resolver<T>,
    defaultValues: defaultValues as DefaultValues<T>,
  }) as UseFormReturn<T>;

  const [submitting, setSubmitting] = React.useState(false);

  // Reset values whenever the dialog opens with new defaults
  React.useEffect(() => {
    if (open) {
      form.reset(defaultValues as DefaultValues<T>);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const handleSubmit = form.handleSubmit(async (values) => {
    setSubmitting(true);
    try {
      await onSubmit(values);
      onOpenChange(false);
    } catch (err) {
      toast.error(translateSupabaseError(err));
    } finally {
      setSubmitting(false);
    }
  });

  return (
    <Dialog open={open} onOpenChange={(o) => !submitting && onOpenChange(o)}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={handleSubmit} className="space-y-4">
            {children(form)}
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={submitting}
              >
                {cancelLabel}
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {submitLabel}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
