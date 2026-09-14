import { describe, it, expect } from "vitest";
import { KONVERZ_CORE, KONVERZ_LANES, konverzDetect } from "./konverzCore";
import { laneContext } from "./brandCore";
import { KONVERZ, KOGNOZ } from "./brands";

describe("konverzDetect", () => {
  it("routes each module to its own lane", () => {
    expect(konverzDetect("cutting time-to-hire with AI interviews")).toBe("hire");
    expect(konverzDetect("succession lists and bench strength")).toBe("nurture");
    expect(konverzDetect("the 12-month mentoring programme")).toBe("coach");
    expect(konverzDetect("personalized learning paths and the content library")).toBe("learn");
    expect(konverzDetect("generating a skills taxonomy per role")).toBe("skills");
    expect(konverzDetect("Cognitive Signatures and the science moat")).toBe("layer");
  });

  // The priority order is load-bearing and deliberately not alphabetical. These
  // are the collisions it exists to settle; reordering the function silently
  // reroutes real topics, and nothing else would notice.
  it("settles the collisions in the documented order", () => {
    // Names hiring, but the subject is the skills model.
    expect(konverzDetect("skills-first hiring, and the taxonomy underneath it")).toBe("skills");
    // Names interviews, but the subject is the science.
    expect(konverzDetect("what Cognitive Signatures add to an interview")).toBe("layer");
    // Names learning, but the subject is coaching sessions.
    expect(konverzDetect("what a mentee learns in a 1:1 session")).toBe("coach");
  });

  it("returns null when nothing matches, so the fallback can name the lanes", () => {
    expect(konverzDetect("a general note about the quarter")).toBeNull();
    expect(konverzDetect("")).toBeNull();
    expect(konverzDetect(null)).toBeNull();
  });
});

describe("laneContext under a brand", () => {
  it("uses the brand's own lanes and its own fallback", () => {
    const hire = laneContext("screening a campus intake", 0, KONVERZ);
    expect(hire).toContain("HIRE LANE");
    expect(hire).toContain("Screen AI");

    const none = laneContext("a general note about the quarter", 0, KONVERZ);
    expect(none).toBe(KONVERZ.laneFallback);
    expect(none).toContain("Hire, Nurture, Coach, Learn, Skills AI, or The Layer");
  });

  it("leaves Kognoz routing exactly as it was, including the seeded illustration", () => {
    const a = laneContext("succession depth on the exec team", 0, KOGNOZ);
    const b = laneContext("succession depth on the exec team", 1, KOGNOZ);
    expect(a).toContain("TALENT & LEADERSHIP LANE");
    // Kognoz rotates its one illustration on the seed; Konverz has none to rotate.
    expect(a).not.toBe(b);
    expect(laneContext("succession depth on the exec team", 0)).toBe(a);
  });
});

describe("the Konverz ground truth", () => {
  it("carries the proof numbers and the psychometric evidence verbatim", () => {
    expect(KONVERZ_CORE).toContain("60% reduction in time-to-hire");
    expect(KONVERZ_CORE).toContain("ICC 0.96");
    expect(KONVERZ_CORE).toContain("0.909");
  });

  it("names all eight assistants", () => {
    for (const a of [
      "Screen AI",
      "Behavior AI",
      "Tech AI",
      "Interview Partner AI",
      "Coach AI",
      "Coaching Session Conferencing",
      "AI Simulation",
      "Skills AI"
    ]) {
      expect(KONVERZ_CORE, a).toContain(a);
    }
  });

  it("every lane declares what it must not borrow", () => {
    for (const [id, text] of Object.entries(KONVERZ_LANES)) {
      expect(text, `${id} has no OFF-LIMITS`).toContain("OFF-LIMITS");
    }
    expect(Object.keys(KONVERZ_LANES)).toHaveLength(6);
  });
});
