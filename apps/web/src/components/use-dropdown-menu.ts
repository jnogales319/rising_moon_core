"use client";

import { useEffect, useRef, useState } from "react";

// Generic open/close interaction plumbing for an aria-haspopup="menu"
// trigger + role="menu" panel: tracks open state, and closes on Escape
// (returning focus to the trigger), on an outside pointer press (mouse or
// touch), and when focus leaves the trigger+panel entirely (e.g. Tabbing
// past the last item). Callers own all markup, styling, and item content —
// this hook owns only the interaction state, so it isn't tied to any
// particular menu's shape.
//
// `preventClose` suppresses all three automatic-dismiss paths above while
// true — for a consumer that needs the panel to stay visibly open through
// an in-flight action (e.g. showing a pending/spinner state on an item)
// regardless of an incidental Escape, outside click, or focus change during
// that window. It does not affect `close()`/`toggle()`, which the caller
// can still call directly.
export function useDropdownMenu<
  TTrigger extends HTMLElement = HTMLButtonElement,
  TContainer extends HTMLElement = HTMLElement,
>({ preventClose = false }: { preventClose?: boolean } = {}) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<TTrigger>(null);
  // Wraps both the trigger and the panel, so a click/tap/focus on the
  // trigger itself isn't misclassified as "outside" while toggling.
  const containerRef = useRef<TContainer>(null);

  useEffect(() => {
    if (!open || preventClose) return;

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    }
    function handleOutsidePointer(e: Event) {
      if (!containerRef.current?.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function handleFocusOut(e: FocusEvent) {
      const next = e.relatedTarget as Node | null;
      if (!next || !containerRef.current?.contains(next)) {
        setOpen(false);
      }
    }

    const container = containerRef.current;
    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("mousedown", handleOutsidePointer);
    document.addEventListener("touchstart", handleOutsidePointer);
    container?.addEventListener("focusout", handleFocusOut);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("mousedown", handleOutsidePointer);
      document.removeEventListener("touchstart", handleOutsidePointer);
      container?.removeEventListener("focusout", handleFocusOut);
    };
  }, [open, preventClose]);

  return {
    open,
    setOpen,
    toggle: () => setOpen((o) => !o),
    close: () => setOpen(false),
    triggerRef,
    containerRef,
  };
}
