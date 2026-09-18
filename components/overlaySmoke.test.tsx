import { describe, it, expect, vi } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { HelpModal } from "./overlays/HelpModal";
import { ExportDrawer, type ExportAction } from "./overlays/ExportDrawer";
import { VerifyFactsModal } from "./overlays/VerifyFactsModal";

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

describe("VerifyFactsModal keeps 'not confirmed' apart from 'wrong'", () => {
  const checks = [
    { where: "cover", claim: "Attrition fell 14%", verdict: "wrong", note: "The figure is 9%.", realSource: "Report 2026" },
    { where: "slide 2", claim: "Most firms restructure yearly", verdict: "unverifiable", note: "No source found." },
    { where: "cta", claim: "Skills decay in 18 months", verdict: "verified", note: "Matches the study." }
  ];
  const out = html(<VerifyFactsModal isOpen onClose={() => {}} checks={checks} />);

  it("labels the three states differently", () => {
    // One red ✗ for both "contradicted" and "could not confirm" makes someone delete a
    // true sentence because a search came back thin.
    expect(out).toContain("Contradicted");
    expect(out).toContain("Not confirmed");
    expect(out).toContain("Confirmed");
  });

  it("leads with the contradiction, not the green ticks", () => {
    expect(out.indexOf("Attrition fell 14%")).toBeLessThan(out.indexOf("Skills decay in 18 months"));
  });

  it("warns against cutting an unconfirmed claim", () => {
    expect(out).toMatch(/not the same as false/i);
  });

  it("never says 'all confirmed' when something was only unconfirmed", () => {
    const partial = html(
      <VerifyFactsModal
        isOpen
        onClose={() => {}}
        checks={[
          { where: "cover", claim: "A", verdict: "verified", note: "" },
          { where: "cta", claim: "B", verdict: "unverifiable", note: "" }
        ]}
      />
    );
    expect(partial).not.toMatch(/all \d+ claims? confirmed/i);
    expect(partial).toMatch(/could not be confirmed/i);
  });

  it("says nothing has run rather than implying a clean pass", () => {
    const fresh = html(<VerifyFactsModal isOpen onClose={() => {}} checks={[]} />);
    expect(fresh).toMatch(/nothing checked yet/i);
    expect(fresh).not.toMatch(/confirmed\./i);
  });

  it("warns that a grounded check costs more, since it is billed per run", () => {
    expect(html(<VerifyFactsModal isOpen onClose={() => {}} checks={[]} />)).toMatch(/costs several times/i);
  });

  it("offers Apply only when a corrected deck came back", () => {
    expect(out).not.toContain("Apply corrections");
    const withFix = html(<VerifyFactsModal isOpen onClose={() => {}} checks={checks} canApply onApply={() => {}} />);
    expect(withFix).toContain("Apply corrections");
  });

  it("is nothing when closed", () => {
    expect(html(<VerifyFactsModal isOpen={false} onClose={() => {}} checks={checks} />)).toBe("");
  });
});
