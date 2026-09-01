import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  logActivity,
  logDownload,
  setActivitySession,
  commonLabel,
  extensionsOf,
  resetDownloadBurst
} from "./activityClient";

// This module runs beside real work — an export, a save — so most of these tests are
// about what it must NOT do: throw, block, or turn one click into five audit rows.
//
// The vitest environment here is "node", so `window` and `fetch` are stubbed by hand
// rather than provided by jsdom. Same approach as lib/claudeClient.test.ts.

const originalWindow = (globalThis as Record<string, unknown>).window;

function stubBrowser() {
  (globalThis as Record<string, unknown>).window = {};
  const fetchMock = vi.fn(() => Promise.resolve(new Response(null, { status: 204 })));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

const bodyOf = (fetchMock: ReturnType<typeof vi.fn>, call = 0) =>
  JSON.parse((fetchMock.mock.calls[call][1] as RequestInit).body as string);

beforeEach(() => {
  resetDownloadBurst();
  setActivitySession(undefined);
  vi.useRealTimers();
});

afterEach(() => {
  resetDownloadBurst();
  vi.unstubAllGlobals();
  if (originalWindow === undefined) delete (globalThis as Record<string, unknown>).window;
  else (globalThis as Record<string, unknown>).window = originalWindow;
});

describe("logActivity never becomes the user's problem", () => {
  it("does not throw when the request fails", () => {
    stubBrowser();
    vi.stubGlobal("fetch", vi.fn(() => Promise.reject(new Error("offline"))));
    expect(() => logActivity("content_created")).not.toThrow();
  });

  it("does not throw when fetch throws synchronously", () => {
    stubBrowser();
    vi.stubGlobal(
      "fetch",
      vi.fn(() => {
        throw new Error("bad body");
      })
    );
    expect(() => logActivity("content_created")).not.toThrow();
  });

  it("leaves no unhandled rejection behind", async () => {
    stubBrowser();
    const rejection = vi.fn();
    process.on("unhandledRejection", rejection);
    vi.stubGlobal("fetch", vi.fn(() => Promise.reject(new Error("offline"))));
    logActivity("download");
    await new Promise((r) => setTimeout(r, 20));
    process.off("unhandledRejection", rejection);
    expect(rejection).not.toHaveBeenCalled();
  });

  it("returns immediately rather than awaiting the network", () => {
    stubBrowser();
    // A never-settling fetch: if this call awaited it, the test would hang.
    vi.stubGlobal("fetch", vi.fn(() => new Promise(() => {})));
    expect(logActivity("content_edited")).toBeUndefined();
  });

  it("does nothing at all on the server", () => {
    delete (globalThis as Record<string, unknown>).window;
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    logActivity("content_created");
    logDownload("x.png");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("what gets sent", () => {
  it("posts the action and keeps the request alive past a page close", () => {
    const fetchMock = stubBrowser();
    logActivity("content_created", { entity: "content", entityLabel: "AI in hiring", screen: "calendar" });

    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("/api/activity");
    expect(init.method).toBe("POST");
    // Without this the last event of every visit — the sign-out — is cancelled in flight.
    expect(init.keepalive).toBe(true);
    expect(bodyOf(fetchMock)).toMatchObject({
      action: "content_created",
      entity: "content",
      entityLabel: "AI in hiring",
      screen: "calendar"
    });
  });

  it("never sends an identity — the server decides who this was", () => {
    const fetchMock = stubBrowser();
    logActivity("content_created", { entityLabel: "AI in hiring" });
    const body = bodyOf(fetchMock);
    for (const forbidden of ["actorEmail", "actor_email", "ip", "userAgent", "user_agent", "actorName"]) {
      expect(body).not.toHaveProperty(forbidden);
    }
  });

  it("attaches the current sign-in id so a visit can be reassembled", () => {
    const fetchMock = stubBrowser();
    setActivitySession("sid-123");
    logActivity("content_edited");
    expect(bodyOf(fetchMock).sessionId).toBe("sid-123");
  });

  it("lets an explicit sessionId win over the ambient one", () => {
    const fetchMock = stubBrowser();
    setActivitySession("sid-123");
    logActivity("content_edited", { sessionId: "sid-explicit" });
    expect(bodyOf(fetchMock).sessionId).toBe("sid-explicit");
  });
});

describe("one click is one row", () => {
  it("coalesces a five-file carousel export into a single event", async () => {
    vi.useFakeTimers();
    const fetchMock = stubBrowser();

    // This is exactly what exportPNG does for a 5-slide deck.
    for (let i = 1; i <= 5; i++) logDownload(`kognoz-carousel-${i}.png`);
    expect(fetchMock).not.toHaveBeenCalled(); // still collecting

    await vi.advanceTimersByTimeAsync(1600);

    expect(fetchMock).toHaveBeenCalledOnce();
    const body = bodyOf(fetchMock);
    expect(body.action).toBe("download");
    expect(body.meta.count).toBe(5);
    expect(body.meta.formats).toBe("png");
    expect(body.entityLabel).toBe("kognoz-carousel");
  });

  it("keeps two separate exports separate", async () => {
    vi.useFakeTimers();
    const fetchMock = stubBrowser();

    logDownload("first.png");
    await vi.advanceTimersByTimeAsync(1600);
    logDownload("second.pdf");
    await vi.advanceTimersByTimeAsync(1600);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(bodyOf(fetchMock, 0).entityLabel).toBe("first.png");
    expect(bodyOf(fetchMock, 1).entityLabel).toBe("second.pdf");
  });

  it("reports a mixed export's formats", async () => {
    vi.useFakeTimers();
    const fetchMock = stubBrowser();
    logDownload("deck.pdf");
    logDownload("deck-1.png");
    await vi.advanceTimersByTimeAsync(1600);
    expect(bodyOf(fetchMock).meta.formats).toBe("pdf, png");
  });

  it("caps the file list so a huge export cannot bloat the row", async () => {
    vi.useFakeTimers();
    const fetchMock = stubBrowser();
    for (let i = 0; i < 40; i++) logDownload(`slide-${i}.png`);
    await vi.advanceTimersByTimeAsync(1600);
    const body = bodyOf(fetchMock);
    expect(body.meta.count).toBe(40); // the count stays truthful
    expect(body.meta.files).toHaveLength(10); // the list does not
  });
});

describe("commonLabel", () => {
  it("finds the stem of a numbered set", () => {
    expect(commonLabel(["kognoz-carousel-1.png", "kognoz-carousel-2.png"])).toBe("kognoz-carousel");
  });

  it("returns a single filename unchanged", () => {
    expect(commonLabel(["kognoz-deck.pdf"])).toBe("kognoz-deck.pdf");
  });

  it("falls back to the first name when nothing is shared", () => {
    expect(commonLabel(["alpha.png", "beta.pdf"])).toBe("alpha.png");
  });

  it("handles an empty list", () => {
    expect(commonLabel([])).toBe("");
  });

  it("does not leave a dangling separator", () => {
    expect(commonLabel(["report-a.png", "report-b.png"])).toBe("report");
  });
});

describe("extensionsOf", () => {
  it("lists each extension once, in the order seen", () => {
    expect(extensionsOf(["a.png", "b.png", "c.pdf"])).toBe("png, pdf");
  });

  it("lowercases", () => {
    expect(extensionsOf(["A.PNG"])).toBe("png");
  });

  it("ignores a name with no extension", () => {
    expect(extensionsOf(["noext", "a.png"])).toBe("png");
    expect(extensionsOf(["noext"])).toBe("");
  });
});
