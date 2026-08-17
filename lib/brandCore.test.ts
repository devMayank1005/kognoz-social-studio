import { describe, it, expect } from "vitest";
import { laneContext } from "./brandCore";

// PRD §16: "Lane router: the 10-topic table (incl. mobility/AI-skills → talent)."
// This is the one example named explicitly in the PRD — a topic that mentions
// AI must still route to `talent` when the substance is mobility/succession,
// not fall through to `aiwork` just because "AI" appears in the text. Confirmed
// by the detector's priority order (family > org > talent > aiwork > culture).
describe("laneContext — practice lane detector", () => {
  it("routes internal mobility with AI-skills language to talent, not aiwork", () => {
    const out = laneContext("Internal mobility and closing the AI skills gap through succession pipelines");
    expect(out).toContain("TALENT & LEADERSHIP LANE");
  });

  it("routes pure AI/agent topics to aiwork", () => {
    const out = laneContext("Agentic workflows and the human-AI work spectrum");
    expect(out).toContain("HUMAN + AI WORK DESIGN LANE");
  });

  it("routes founder/family topics to family, ahead of everything else", () => {
    const out = laneContext("Founder succession and generational alignment in the family business");
    expect(out).toContain("FAMILY BUSINESS LANE");
  });

  it("falls back to a general instruction when no keywords match", () => {
    const out = laneContext("A completely unrelated topic about nothing in particular");
    expect(out).toContain("choose ONE Kognoz practice lens");
  });
});
