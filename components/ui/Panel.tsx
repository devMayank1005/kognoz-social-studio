"use client";

// A surface, and the thing to put on it when there is nothing to put on it.
//
// Both read their colours from the chrome tokens in app/globals.css rather than from
// slate-*, so a brand switch repaints them. lib/designTokens.test.ts fails the build if
// a literal brand hex comes back.

import React from "react";

export function Panel({
  title,
  action,
  className = "",
  bodyClassName = "p-4",
  children
}: {
  title?: React.ReactNode;
  /** Right-aligned control on the header row. */
  action?: React.ReactNode;
  className?: string;
  bodyClassName?: string;
  children: React.ReactNode;
}) {
  return (
    <section
      className={`bg-[var(--surface-panel)] rounded-xl border shadow-xs ${className}`}
      style={{ borderColor: "var(--border-subtle)" }}
    >
      {(title || action) && (
        <header
          className="px-4 py-3 border-b flex items-center justify-between gap-3"
          style={{ borderColor: "var(--border-subtle)" }}
        >
          {title && <h2 className="text-xs font-semibold text-slate-900">{title}</h2>}
          {action}
        </header>
      )}
      <div className={bodyClassName}>{children}</div>
    </section>
  );
}

export function EmptyState({
  icon,
  title,
  body,
  action
}: {
  icon?: React.ReactNode;
  title: string;
  body?: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center text-center gap-2 py-12 px-6">
      {icon && <div className="text-slate-300 mb-1">{icon}</div>}
      <h3 className="text-sm font-semibold text-slate-700">{title}</h3>
      {body && <p className="text-xs text-slate-500 max-w-sm leading-relaxed">{body}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
