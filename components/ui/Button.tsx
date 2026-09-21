"use client";

// One button, four intents.
//
// Two defaults here are bug fixes rather than styling:
//
//   type="button"   A bare <button> inside a <form> submits it. Several overlays sit
//                   inside forms; none of them said `type`.
//   focus-visible   Tailwind's preflight is not imported, so nothing in this app strips
//                   the UA focus ring — but nothing replaces it on the elements that DO
//                   set their own background either, and a slate-900 button with the
//                   default ring is close to invisible. Keyboard users get a real one.

import React from "react";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "sm" | "md" | "icon";

const VARIANT: Record<ButtonVariant, string> = {
  primary: "bg-slate-900 hover:bg-[var(--brand-accent)] text-white shadow-xs",
  secondary: "bg-white border border-slate-300 text-slate-700 hover:bg-slate-50",
  ghost: "text-slate-500 hover:text-slate-800 hover:bg-slate-100",
  danger: "bg-rose-600 hover:bg-rose-700 text-white shadow-xs"
};

const SIZE: Record<ButtonSize, string> = {
  sm: "px-3 py-1.5 text-xs",
  md: "px-4 py-2 text-xs",
  icon: "p-1.5 text-xs"
};

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

export function Button({
  variant = "primary",
  size = "md",
  className = "",
  type = "button",
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      className={[
        "inline-flex items-center justify-center gap-1.5 rounded-lg font-medium transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-accent)] focus-visible:ring-offset-1",
        "disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-inherit",
        VARIANT[variant],
        SIZE[size],
        className
      ]
        .filter(Boolean)
        .join(" ")}
      {...rest}
    />
  );
}
