// Hand-assembled PDF builder — ported verbatim from kognoz-social-studio-v3.jsx
// (PRD §12). One JPEG per page; LinkedIn document carousels take a single PDF
// upload, so this is the deck's native delivery format. Structurally unit-
// tested per PRD §16: header, startxref -> xref, every offset resolves to
// "N 0 obj", page count, JPEG bytes verbatim.
//
// Client-side only (uses TextEncoder + Blob) — this runs in the export
// pipeline, in the browser, exactly as in the reference implementation.

export function buildPdfFromJpegs(jpegs: Uint8Array[], w: number, h: number): Blob {
  const enc = new TextEncoder();
  const parts: (Uint8Array | string)[] = [];
  let pos = 0;
  const offsets: number[] = [];

  const push = (x: Uint8Array | string) => {
    const b = typeof x === "string" ? enc.encode(x) : x;
    parts.push(b);
    pos += b.length;
  };
  const obj = (i: number, body: string) => {
    offsets[i] = pos;
    push(`${i} 0 obj\n${body}\nendobj\n`);
  };

  push("%PDF-1.4\n");
  const n = jpegs.length;
  const kids = jpegs.map((_, k) => `${3 + k * 3} 0 R`).join(" ");
  obj(1, "<< /Type /Catalog /Pages 2 0 R >>");
  obj(2, `<< /Type /Pages /Kids [${kids}] /Count ${n} >>`);

  jpegs.forEach((jp, k) => {
    const pg = 3 + k * 3,
      ct = pg + 1,
      im = pg + 2;
    obj(
      pg,
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${w} ${h}] /Resources << /XObject << /Im0 ${im} 0 R >> >> /Contents ${ct} 0 R >>`
    );
    const stream = `q ${w} 0 0 ${h} 0 0 cm /Im0 Do Q`;
    obj(ct, `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`);
    offsets[im] = pos;
    push(
      `${im} 0 obj\n<< /Type /XObject /Subtype /Image /Width ${w} /Height ${h} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jp.length} >>\nstream\n`
    );
    push(jp);
    push(`\nendstream\nendobj\n`);
  });

  const xrefPos = pos;
  const total = 3 + n * 3;
  let xref = `xref\n0 ${total}\n0000000000 65535 f \n`;
  for (let i = 1; i < total; i++) xref += String(offsets[i]).padStart(10, "0") + " 00000 n \n";
  push(xref + `trailer\n<< /Size ${total} /Root 1 0 R >>\nstartxref\n${xrefPos}\n%%EOF`);

  return new Blob(parts as BlobPart[], { type: "application/pdf" });
}
