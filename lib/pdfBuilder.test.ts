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

// ---------------------------------------------------------------------------
// Page geometry.
//
// buildPdfFromJpegs asserts the page size from its arguments — nothing ever parses
// the JPEG SOF header — so /MediaBox, /Width, /Height and the content-stream matrix
// are all claims, not measurements. Hand it the wrong number and you get a PDF that
// is structurally valid, opens without complaint in most readers, and is garbled.
//
// That is the live risk for the Montage export: the canvas is 3240 wide but each
// PAGE is 1080. Passing baseW instead of the frame width is a silent corruption, so
// the geometry is pinned here rather than left to a visual check.
// ---------------------------------------------------------------------------
describe("page geometry is what the caller asked for", () => {
  const fake = (n: number, len: number) => new Uint8Array([0xff, 0xd8, 0xff, 0xe0, ...Array.from({ length: len }, () => n)]);
  const read = async (blob: Blob) => new TextDecoder("latin1").decode(new Uint8Array(await blob.arrayBuffer()));

  // The exact call the Montage export makes: 3 frames sliced from a 3240x1350 strip.
  const montage = () => buildPdfFromJpegs([fake(1, 5), fake(2, 6), fake(3, 7)], 1080, 1350);

  it("stamps the frame size on every page, not the canvas size", async () => {
    const text = await read(montage());
    const boxes = text.match(/\/MediaBox \[0 0 \d+ \d+\]/g) || [];
    expect(boxes).toHaveLength(3);
    expect(new Set(boxes)).toEqual(new Set(["/MediaBox [0 0 1080 1350]"]));
    expect(text).not.toContain("3240"); // the canvas width must not leak into the file
  });

  it("declares each image at the page size and draws it to fill", async () => {
    const text = await read(montage());
    expect(text.match(/\/Width 1080 \/Height 1350/g)).toHaveLength(3);
    expect(text.match(/q 1080 0 0 1350 0 0 cm/g)).toHaveLength(3);
  });

  it("counts three pages", async () => {
    expect(await read(montage())).toContain("/Count 3");
  });

  it("keeps the frames in order", async () => {
    // toContain is order-blind, so assert the positions instead: a reversed loop
    // would still satisfy every other check in this file.
    const text = await read(montage());
    const at = (n: number) => text.indexOf(new TextDecoder("latin1").decode(fake(n, n === 1 ? 5 : n === 2 ? 6 : 7)));
    expect(at(1)).toBeGreaterThan(-1);
    expect(at(1)).toBeLessThan(at(2));
    expect(at(2)).toBeLessThan(at(3));
  });

  it("still resolves every xref offset at three pages", async () => {
    // Objects run 1..(2 + n*3) — the catalog, the page tree, then page/content/image
    // per frame. `total` is 3 + n*3 because it counts the free object 0 as well, so
    // the xref lists total-1 real entries. The existing structural test only ever
    // exercised n = 2, where an off-by-one in that arithmetic would still line up.
    const text = await read(montage());
    const xrefStart = parseInt(text.slice(text.lastIndexOf("startxref") + "startxref".length).trim().split("\n")[0], 10);
    const lines = text.slice(xrefStart).split("\n").slice(2).filter((l) => / 00000 n /.test(l));
    expect(lines).toHaveLength(2 + 3 * 3);
    expect(text).toContain("/Size 12");
    lines.forEach((line, idx) => {
      const offset = parseInt(line.slice(0, 10), 10);
      expect(text.slice(offset, offset + `${idx + 1} 0 obj`.length)).toBe(`${idx + 1} 0 obj`);
    });
  });

  it("a portrait deck page is unaffected", async () => {
    const text = await read(buildPdfFromJpegs([fake(9, 4)], 1080, 1350));
    expect(text).toContain("/MediaBox [0 0 1080 1350]");
    expect(text).toContain("/Count 1");
  });
});
