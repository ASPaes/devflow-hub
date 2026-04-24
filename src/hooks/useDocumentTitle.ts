import { useEffect } from "react";

const SUFFIX = "devflow-hub";

/** Sets `document.title` to `${title} — devflow-hub` while mounted. */
export function useDocumentTitle(title: string | undefined | null) {
  useEffect(() => {
    if (typeof document === "undefined") return;
    const previous = document.title;
    if (title && title.trim()) {
      document.title = `${title.trim()} — ${SUFFIX}`;
    }
    return () => {
      document.title = previous;
    };
  }, [title]);
}
