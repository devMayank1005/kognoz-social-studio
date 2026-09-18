"use client";

import React from "react";
import { AppShell } from "@/components/shell/AppShell";

// Studio lays out its own canvas, rail and filmstrip edge to edge, so it takes the
// shell without the content gutter.
export function StudioShell({ children }: { children: React.ReactNode }) {
  return <AppShell padded={false}>{children}</AppShell>;
}
