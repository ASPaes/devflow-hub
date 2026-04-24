import { createRouter, useRouter } from "@tanstack/react-router";
import * as React from "react";
import { routeTree } from "./routeTree.gen";
import { createQueryClient } from "@/lib/queryClient";
import type { QueryClient } from "@tanstack/react-query";
import type { AuthState } from "@/hooks/useAuth";
import { useAuth } from "@/hooks/useAuth";

export interface RouterAppContext {
  queryClient: QueryClient;
  auth: AuthState;
}

// Placeholder used only during SSR / before the AuthProvider mounts.
// `beforeLoad` guards always read from the live `auth` value injected by
// <RouterAuthSync /> below, so SSR never gates on this stub.
const ssrAuthStub: AuthState = {
  user: null,
  session: null,
  isLoading: true,
  signIn: async () => {},
  signUp: async () => ({ needsEmailConfirmation: false }),
  signOut: async () => {},
  resetPassword: async () => {},
};

function DefaultErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  const router = useRouter();
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-2xl font-semibold text-foreground">Algo deu errado</h1>
        {import.meta.env.DEV && error.message && (
          <pre className="mt-4 max-h-40 overflow-auto rounded-md bg-muted p-3 text-left font-mono text-xs text-destructive">
            {error.message}
          </pre>
        )}
        <div className="mt-6 flex items-center justify-center gap-3">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Tentar novamente
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
          >
            Início
          </a>
        </div>
      </div>
    </div>
  );
}

export const getRouter = () => {
  const queryClient = createQueryClient();
  const router = createRouter({
    routeTree,
    context: {
      queryClient,
      auth: ssrAuthStub,
    } satisfies RouterAppContext,
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
    defaultErrorComponent: DefaultErrorComponent,
  });
  return router;
};

declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof getRouter>;
  }
}

/**
 * Mounts inside <AuthProvider> + RouterContext. Pushes the live auth value
 * into the router's context object and invalidates matched routes whenever
 * the session changes, so `beforeLoad` guards re-run with fresh auth.
 */
export function RouterAuthSync() {
  const auth = useAuth();
  const router = useRouter();

  // Mutate router context in place so beforeLoad guards see live auth.
  router.options.context = {
    ...(router.options.context as RouterAppContext),
    auth,
  };

  const sessionId = auth.session?.user.id ?? null;
  const prevRef = React.useRef<string | null | undefined>(undefined);
  React.useEffect(() => {
    if (prevRef.current === undefined) {
      prevRef.current = sessionId;
      return;
    }
    if (prevRef.current !== sessionId) {
      prevRef.current = sessionId;
      router.invalidate();
    }
  }, [sessionId, router]);

  return null;
}
