import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// The middleware itself needs the Next edge runtime to execute, so this reads the source
// and pins the shape of the decision instead. Thin, but it guards a specific regression:
//
// every unauthenticated exit used to redirect to /login, INCLUDING /api/*. The browser
// followed the 307, /login answered 200 HTML, and lib/storeClient.ts's res.json() threw on
// "<!DOCTYPE" — landing in its catch and reporting `stale`. The Studio then said "Could not
// reach the server" to somebody whose session had merely ended, while they carried on
// editing a deck that could never save.
//
// storeClient carved out `res.status !== 401` from the start, which is the evidence a 401
// was always intended here; it was simply never produced.

const src = readFileSync(join(process.cwd(), "middleware.ts"), "utf8");

describe("the unauthenticated response fits its caller", () => {
  it("answers API requests with a 401 rather than a redirect", () => {
    expect(src).toMatch(/pathname\.startsWith\("\/api\/"\)/);
    // [\s\S] rather than the `s` flag: this tsconfig targets below ES2018.
    expect(src).toMatch(/NextResponse\.json\([\s\S]*?status:\s*401/);
  });

  it("routes every unauthenticated exit through the one helper", () => {
    // Three of them: no cookie, a cookie that will not verify, and the verifier throwing.
    // One that still redirected would put the old bug back for that path alone.
    expect(src.match(/return deny\(req\)/g) ?? []).toHaveLength(3);
  });

  it("keeps a deep link's query string across sign-in", () => {
    // `pathname` alone dropped ?set=… and landed people on a bare screen after signing in.
    expect(src).toMatch(/callbackUrl["']?,\s*req\.nextUrl\.pathname \+ req\.nextUrl\.search/);
  });

  it("still sends a page request to the login screen", () => {
    expect(src).toMatch(/url\.pathname = "\/login"/);
    expect(src).toMatch(/NextResponse\.redirect\(url\)/);
  });

  it("signs with the shared secret rather than a literal", () => {
    // The fallback secret that used to live here was readable by anyone with the repo.
    expect(src).toContain("SESSION_SECRET");
    expect(src).not.toMatch(/secret-key-20\d\d/);
  });
});
