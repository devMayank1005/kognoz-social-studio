import { describe, it, expect } from "vitest";
import { buildPdfFromJpegs } from "./pdfBuilder";

// PRD §16: PDF builder is structurally unit-tested — header, startxref -> xref,
// every offset resolves to "N 0 obj", page count, JPEG bytes verbatim.
describe("buildPdfFromJpegs", () => {
  it("produces a structurally valid hand-assembled PDF", async () => {
    const jpeg1 = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]); // fake JPEG bytes
    const jpeg2 = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 4, 5, 6, 7, 8]);
    const blob = buildPdfFromJpegs([jpeg1, jpeg2], 1080, 1350);

    const buf = new Uint8Array(await blob.arrayBuffer());
    const text = new TextDecoder("latin1").decode(buf);

    expect(text.startsWith("%PDF-1.4\n")).toBe(true);
    expect(text).toContain("startxref");
    expect(text.trim().endsWith("%%EOF")).toBe(true);
    expect(text).toContain("/Count 2"); // page count == number of jpegs

    // Every "N 0 obj" offset in the xref table must resolve to the literal
    // bytes "N 0 obj" at that byte position.
    const xrefStart = parseInt(text.slice(text.lastIndexOf("startxref") + "startxref".length).trim().split("\n")[0], 10);
    expect(Number.isFinite(xrefStart)).toBe(true);
    const xrefBlock = text.slice(xrefStart);
    expect(xrefBlock.startsWith("xref\n")).toBe(true);

    const offsetLines = xrefBlock.split("\n").slice(2).filter((l) => / 00000 n /.test(l));
    offsetLines.forEach((line, idx) => {
      const objNum = idx + 1; // object numbering starts at 1
      const offset = parseInt(line.slice(0, 10), 10);
      const atOffset = text.slice(offset, offset + `${objNum} 0 obj`.length);
      expect(atOffset).toBe(`${objNum} 0 obj`);
    });

    // JPEG bytes must appear verbatim in the output stream.
    const jpeg1Str = new TextDecoder("latin1").decode(jpeg1);
    const jpeg2Str = new TextDecoder("latin1").decode(jpeg2);
    expect(text).toContain(jpeg1Str);
    expect(text).toContain(jpeg2Str);
  });
});
