"use client";

import React from "react";
import { AppShell } from "@/components/shell/AppShell";

// Studio lays out its own three columns edge to edge, so it takes the shell with no
// gutter of its own — the same arrangement the reference uses, where <main> has no
// padding and each view decides.
export function StudioShell({ children }: { children: React.ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
