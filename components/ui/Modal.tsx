"use client";

// The dialog every overlay is built from.
//
// It exists because the five files in components/overlays/ had each copied the same fifteen
// lines of backdrop and panel — and, reading them together, **not one of them closed on
// Escape, trapped focus, restored focus on close, or locked body scroll.** HelpModal, the
// file the rest were copied from, has no key handler at all. So this is an accessibility
// fix as much as a visual one.
//
// Two behaviours are worth calling out because they are the ones people get wrong:
//
//   the drag-out guard   Selecting text inside a dialog and releasing the mouse outside it
//                        fires a click on the backdrop, which closes the dialog and throws
//                        the selection away. components/calendar/ContentEditorModal.tsx:370
//                        had already solved this; the overlays never got it. The backdrop
//                        only closes when the press STARTED on the backdrop.
//
//   nothing when closed  components/overlaySmoke.test.tsx asserts the closed markup is
//                        exactly "". A hidden node would pass a human's eye and fail that
//                        test — correctly, because a mounted-but-hidden dialog still holds
//                        focus and still reads to a screen reader.

import React, { useCallback, useEffect, useRef } from "react";
import { X } from "lucide-react";

export type ModalSize = "sm" | "md" | "lg" | "xl";

const WIDTH: Record<ModalSize, string> = {
  sm: "max-w-md",
  md: "max-w-lg",
  lg: "max-w-xl",
  xl: "max-w-2xl"
};

export type ModalAnchor = "center" | "top" | "right";

// Where the panel sits, and how tall it is allowed to get. `top` is the palette shape:
// near the top of the viewport and shorter, so the list does not run to the bottom edge
// while you are reading the first few rows.
const LAYOUT: Record<ModalAnchor, { backdrop: string; panel: (w: string) => string }> = {
  center: {
    backdrop: "items-center justify-center p-4",
    panel: (w) => `w-full ${w} rounded-2xl overflow-hidden max-h-[85vh]`
  },
  top: {
    backdrop: "items-start justify-center pt-20 p-4",
    panel: (w) => `w-full ${w} rounded-2xl overflow-hidden max-h-[70vh]`
  },
  right: {
    backdrop: "justify-end",
    panel: () => `w-full max-w-md h-full border-l`
  }
};

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** The accessible name. Falls back to `title` when that is a plain string. */
  label?: string;
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  /** Small square badge to the left of the title. */
  icon?: React.ReactNode;
  size?: ModalSize;
  /** `right` is the drawer: full height, anchored to the edge. `top` is the palette. */
  anchor?: ModalAnchor;
  /**
   * Replaces the default title row entirely — for a dialog whose header is a control
   * rather than a label, like the palette's search field.
   */
  header?: React.ReactNode;
  footer?: React.ReactNode;
  /** Hide the × when the dialog must be dismissed deliberately. */
  hideClose?: boolean;
  /**
   * Replaces the scrolling body wrapper. For dialogs that own their own scroll regions —
   * SettingsModal's two panes each scroll independently, and nesting those inside a
   * scroller gives you two scrollbars for one gesture.
   */
  bodyClassName?: string;
  children: React.ReactNode;
}

export function Modal({
  isOpen,
  onClose,
  label,
  title,
  subtitle,
  icon,
  size = "lg",
  anchor = "center",
  header,
  footer,
  hideClose,
  bodyClassName = "flex-1 overflow-y-auto min-h-0",
  children
}: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const restoreTo = useRef<HTMLElement | null>(null);
  // True only while a press that began on the backdrop is still in progress.
  const armed = useRef(false);

  // Escape, and a Tab that would otherwise walk out of the dialog into the page behind it.
  const onKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
        return;
      }
      if (e.key !== "Tab") return;
      const panel = panelRef.current;
      if (!panel) return;
      // Filtered on attributes, not on `offsetParent`: jsdom implements no layout, so
      // offsetParent is always null there and a visibility filter would silently drop
      // every candidate — the trap would pass its tests while doing nothing.
      const items = [...panel.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(
        (n) => !n.hasAttribute("hidden") && n.getAttribute("aria-hidden") !== "true"
      );
      if (!items.length) {
        e.preventDefault();
        panel.focus();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;
      if (e.shiftKey && (active === first || active === panel)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    },
    [onClose]
  );

  useEffect(() => {
    if (!isOpen) return;
    restoreTo.current = document.activeElement as HTMLElement | null;
    const body = document.body;
    const previousOverflow = body.style.overflow;
    body.style.overflow = "hidden";
    document.addEventListener("keydown", onKeyDown, true);

    // Focus the panel rather than its first control: landing on a destructive button
    // because it happened to be first is worse than landing nowhere.
    //
    // Unless something inside already has focus. An autoFocus input — the palette's
    // search field — is focused by React during the commit that mounts it, which is
    // BEFORE this effect runs, so focusing the panel here would silently take it away
    // and the first keystroke would go nowhere.
    const panel = panelRef.current;
    if (panel && !panel.contains(document.activeElement)) panel.focus();

    return () => {
      document.removeEventListener("keydown", onKeyDown, true);
      body.style.overflow = previousOverflow;
      // Only steal focus back if it is still inside the dialog we are closing.
      const active = document.activeElement;
      if (!active || active === document.body || panelRef.current?.contains(active)) restoreTo.current?.focus?.();
    };
  }, [isOpen, onKeyDown]);

  if (!isOpen) return null;

  const layout = LAYOUT[anchor];
  const accessibleName = label ?? (typeof title === "string" ? title : undefined);

  return (
    <div
      className={`fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex ${layout.backdrop}`}
      role="presentation"
      onMouseDown={(e) => {
        armed.current = e.target === e.currentTarget;
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && armed.current) onClose();
        armed.current = false;
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={accessibleName}
        tabIndex={-1}
        onMouseDown={(e) => e.stopPropagation()}
        className={`bg-white shadow-2xl border flex flex-col outline-none ${layout.panel(WIDTH[size])}`}
        style={{ borderColor: "var(--border-subtle)" }}
      >
        {header ?? ((title || !hideClose) && (
          <header
            className="p-5 border-b flex items-center justify-between gap-3 shrink-0 bg-slate-50"
            style={{ borderColor: "var(--border-subtle)" }}
          >
            <div className="flex items-center gap-2.5 min-w-0">
              {icon && (
                <div className="w-8 h-8 rounded-lg bg-[var(--brand-accent-soft)]/15 text-[var(--accent-deep)] flex items-center justify-center font-bold shrink-0">
                  {icon}
                </div>
              )}
              <div className="min-w-0">
                {title && <h3 className="font-semibold text-sm text-slate-900 truncate">{title}</h3>}
                {subtitle && <p className="text-xs text-slate-500 truncate">{subtitle}</p>}
              </div>
            </div>
            {!hideClose && (
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </header>
        ))}

        <div className={bodyClassName}>{children}</div>

        {footer && (
          <footer
            className="p-4 border-t bg-slate-50 shrink-0"
            style={{ borderColor: "var(--border-subtle)" }}
          >
            {footer}
          </footer>
        )}
      </div>
    </div>
  );
}

/** The right-anchored variant, so callers say what they mean. */
export function Drawer(props: Omit<ModalProps, "anchor">) {
  return <Modal {...props} anchor="right" />;
}
