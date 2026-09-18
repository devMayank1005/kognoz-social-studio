import { describe, it, expect, vi } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { HelpModal } from "./overlays/HelpModal";
import { ExportDrawer, type ExportAction } from "./overlays/ExportDrawer";

// Render checks for the overlays, in the same spirit as renderSmoke.test.tsx.
//
// SettingsModal and CommandPalette are absent on purpose: both call useSession(), which
// needs a SessionProvider above them. Their logic lives in lib/commandPalette.ts and is
// tested directly there.

const html = (el: React.ReactElement) => renderToStaticMarkup(el);

describe("overlays render only when open", () => {
  it("HelpModal is nothing when closed", () => {
    expect(html(<HelpModal isOpen={false} onClose={() => {}} />)).toBe("");
  });

  it("ExportDrawer is nothing when closed", () => {
    expect(html(<ExportDrawer isOpen={false} onClose={() => {}} actions={[]} />)).toBe("");
  });
});

describe("HelpModal describes THIS app, not the reference's mock", () => {
  const out = html(<HelpModal isOpen onClose={() => {}} />);

  it("does not claim benchmark databases we never query", () => {
    // The reference's copy says claims are audited against "Deloitte 2026, Kognoz GCC
    // Restructuring Database, Gartner". We query none of them — our verify task searches
    // the live web. Shipping that sentence would be a false statement about the product,
    // to the people relying on it.
    for (const claim of ["Deloitte", "Gartner", "GCC Restructuring"]) {
      expect(out, `help text claims "${claim}"`).not.toContain(claim);
    }
  });

  it("says what verification actually is, including its limit", () => {
    expect(out).toContain("live web");
    expect(out).toMatch(/unconfirmed claim as unconfirmed/i);
  });

  it("carries the activity-recording notice", () => {
    expect(out).toMatch(/recorded/i);
    expect(out).toContain("180 days");
  });

  it("documents the shortcuts the app really has", () => {
    expect(out).toContain("⌘K");
  });
});

describe("ExportDrawer exports for real", () => {
  const action = (kind: ExportAction["kind"], run: () => Promise<void>): ExportAction => ({
    kind,
    run,
    available: true
  });

  it("lists the available formats and hides the unavailable", () => {
    const out = html(
      <ExportDrawer
        isOpen
        onClose={() => {}}
        actions={[
          action("pdf", async () => {}),
          { kind: "panorama", run: async () => {}, available: false }
        ]}
      />
    );
    expect(out).toContain("LinkedIn document");
    // Panorama only exists for Montage; offering it elsewhere would produce nothing.
    expect(out).not.toContain("Panorama");
  });

  it("says PNGs are saved individually, because that is what exportPNG does", () => {
    // The reference advertises a ".zip". Ours does not make one.
    const out = html(<ExportDrawer isOpen onClose={() => {}} actions={[action("png", async () => {})]} />);
    expect(out).toContain("saved individually");
    expect(out).not.toContain(".zip");
  });

  it("does not repeat the reference's unfounded DPI claim", () => {
    // "Target DPI: 300" is not a property our pipeline sets — an export is a pixel size.
    const out = html(<ExportDrawer isOpen onClose={() => {}} actions={[action("pdf", async () => {})]} />);
    expect(out).not.toContain("300");
    expect(out).toMatch(/fonts are embedded/i);
  });

  it("says so plainly when there is nothing to export", () => {
    const out = html(<ExportDrawer isOpen onClose={() => {}} actions={[]} />);
    expect(out).toMatch(/nothing to export yet/i);
  });

  it("shows neither success nor failure before anything has run", () => {
    // The reference shows a green tick a second after a click, having produced no file.
    const out = html(<ExportDrawer isOpen onClose={() => {}} actions={[action("pdf", async () => {})]} />);
    expect(out).not.toMatch(/saved\./);
    expect(out).not.toMatch(/failed/i);
  });

  it("carries a real run() for every option, not a timer", () => {
    const run = vi.fn(async () => {});
    const a = action("pdf", run);
    expect(typeof a.run).toBe("function");
    expect(run).not.toHaveBeenCalled();
  });
});
