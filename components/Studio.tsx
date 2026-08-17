// The Studio editor — ported from kognoz-social-studio-v3.jsx's App component
// (state, handlers, and the control-panel/preview JSX structure, lines
// ~915-2143). Adaptations from the reference, each deliberate and noted:
//   - API calls go through lib/claudeClient.ts -> /api/claude (never the raw
//     key; see that file's header comment for why the original couldn't be
//     copied as-is here).
//   - design / house-prefs / style-memory persist to Supabase via /api/store
//     instead of the artifact's window.storage. Same 4 keys, same shape.
//   - The Calendar is a separate route (/calendar) here rather than a
//     toggled `view` state, since this is a multi-page Next.js app, not a
//     single-page artifact. The nav pill is a Link instead of a setView call.
//   - Video recording (recordVideo/MediaRecorder + wrapCanvasText) is NOT
//     ported in this pass — flagged in README as the one remaining gap.
"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { C, GRAD, FONT, DISPLAY_FONT } from "@/lib/tokens";
import { FORMATS, type FormatId } from "@/lib/formats";
import { PILLARS } from "@/lib/pillars";
import { DESIGN_SETS, type DesignSetId } from "@/lib/designSets";
import {
  coerceContent,
  applyIdeaDeckKickers,
  applyStatCardHygiene,
  type CoercedSlide
} from "@/lib/coerce";
import {
  buildGeneratePrompt,
  buildArticlePrompt,
  buildVerifyPrompt,
  buildModifyPrompt,
  buildDesignNotePrompt,
  type IdeaStyle,
  type StyleExample
} from "@/lib/promptBuilders";
import { callClaudeJSON, callClaudeText, FAST_MODEL } from "@/lib/claudeClient";
import { exportPdf, exportPanorama, exportStrip, exportPNG, saveBlobAs } from "@/lib/exportPipeline";
import { Slide, type SlideDesign, type SlideKind } from "./Slide";
import { Logo } from "./Logo";

const font = FONT;
const displayFont = DISPLAY_FONT;

interface VerifyCheck {
  where: string;
  claim: string;
  verdict: "verified" | "wrong" | "unverifiable";
  note: string;
  realSource: string | null;
}

const DEFAULT_DESIGN: Required<SlideDesign> = {
  url: "kognozconsulting.com",
  coverRight: "swipe",
  contentRight: "page",
  singleRight: "cta",
  petals: true,
  set: "editorial",
  accent: null
};

const DEFAULT_SLIDES: CoercedSlide[] = [
  { title: "The survey and the behavior disagree", body: "Your engagement score says people own their work. Meanwhile decisions that belong two levels down are landing on your desk for sign-off." },
  { title: "Behavior is the honest data", body: "What people report once a year and what they do every week are different facts. We measure the second one." },
  { title: "The cause is usually structural", body: "Watch the behavior and the problem is rarely attitude. Decision rights, spans, and consequences are set up to push everything upward. Structures can be redesigned." },
  { title: "Read it with the Immersion Index", body: "Five conditions, read through behavioral signals across the organization. You see what is happening and which two changes matter most." }
];

async function storeGet<T>(key: string): Promise<T | null> {
  try {
    const res = await fetch(`/api/store?key=${key}`);
    if (!res.ok) return null;
    const data = await res.json();
    return (data?.value as T) ?? null;
  } catch {
    return null;
  }
}
async function storeSet(key: string, value: unknown): Promise<void> {
  try {
    await fetch(`/api/store?key=${key}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(value)
    });
  } catch {
    /* best-effort persistence — the UI already reflects the change locally */
  }
}

export default function Studio() {
  const searchParams = useSearchParams();

  const [format, setFormat] = useState<FormatId>("Carousel");
  const [pillar, setPillar] = useState("Behavioral Signal");
  const [topic, setTopic] = useState("");
  const [eyebrow, setEyebrow] = useState("Behavioral Signal");
  const [cover, setCover] = useState("Culture is what your people *do*");
  const [slides, setSlides] = useState<CoercedSlide[]>(DEFAULT_SLIDES);
  const [cta, setCta] = useState("See how we read culture");
  const [current, setCurrent] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [seed, setSeed] = useState(0);
  const [images, setImages] = useState<Record<string, string | null | undefined>>({});
  const setImg = (key: string, url: string) => setImages((m) => ({ ...m, [key]: url }));
  const [scales, setScales] = useState<Record<number, number>>({});
  const [imgOn, setImgOn] = useState<Record<number, boolean>>({});
  const [ideaStyle, setIdeaStyle] = useState<IdeaStyle>("signals");

  const [design, setDesignLocal] = useState<Required<SlideDesign>>(DEFAULT_DESIGN);
  const [housePrefs, setHousePrefsLocal] = useState("");
  const [styleMem, setStyleMem] = useState<StyleExample[]>([]);
  const [designNote, setDesignNote] = useState("");
  const [designBusy, setDesignBusy] = useState(false);
  const [lookI, setLookI] = useState(0);

  const [modTxt, setModTxt] = useState("");
  const [modLoading, setModLoading] = useState(false);

  const [article, setArticle] = useState("");
  const [artBusy, setArtBusy] = useState(false);
  const [artInstr, setArtInstr] = useState("");

  const [verifying, setVerifying] = useState(false);
  const [verifyRes, setVerifyRes] = useState<VerifyCheck[] | null>(null);
  const [verifyFixed, setVerifyFixed] = useState<{ eyebrow: string; cover: string; slides: CoercedSlide[]; cta: string } | null>(null);

  const [urlOpen, setUrlOpen] = useState(false);
  const [urlVal, setUrlVal] = useState("");
  const [urlBusy, setUrlBusy] = useState(false);

  const [pdfBusy, setPdfBusy] = useState(0);

  // Load shared design/house-prefs/style-memory once on mount (PRD §3.2).
  useEffect(() => {
    (async () => {
      const [d, hp, sm] = await Promise.all([
        storeGet<Partial<SlideDesign>>("kognoz-design"),
        storeGet<string>("kognoz-house-prefs"),
        storeGet<StyleExample[]>("kognoz-style-memory")
      ]);
      if (d && Object.keys(d).length) setDesignLocal((cur) => ({ ...cur, ...d }));
      if (typeof hp === "string") setHousePrefsLocal(hp);
      if (Array.isArray(sm)) setStyleMem(sm);
    })();
  }, []);

  const saveDesign = (next: Required<SlideDesign>) => {
    setDesignLocal(next);
    storeSet("kognoz-design", next);
  };
  const saveHousePrefs = (v: string) => {
    setHousePrefsLocal(v);
    storeSet("kognoz-house-prefs", v);
  };
  const appendPref = (t: string) => {
    const line = "- " + t.trim();
    if (!t.trim() || housePrefs.includes(line)) return;
    if (housePrefs.split("\n").filter(Boolean).length >= 12) return;
    saveHousePrefs((housePrefs ? housePrefs + "\n" : "") + line);
  };
  const saveStyleExample = () => {
    const ex: StyleExample = { format, cover, slides: slides.slice(0, 6), cta };
    const next = [...styleMem.filter((e) => e.cover !== cover), ex].slice(-6);
    setStyleMem(next);
    storeSet("kognoz-style-memory", next);
  };

  const updSlide = (i: number, key: "title" | "body", val: string) =>
    setSlides((s) => s.map((x, j) => (j === i ? { ...x, [key]: val } : x)));
  const addSlide = () => setSlides((s) => [...s, { title: "New point", body: "One clear idea for this slide." }]);
  const rmSlide = (i: number) => setSlides((s) => (s.length > 1 ? s.filter((_, j) => j !== i) : s));

  const accent = design.accent || PILLARS[pillar] || C.blue;
  const fmt = FORMATS[format];
  const baseW = fmt.w;
  const baseH = fmt.h;
  const previewW = baseW > 2000 ? 780 : baseW > baseH ? 620 : baseH > 1500 ? 330 : 400;
  const previewScale = previewW / baseW;

  type DeckItem = { kind: SlideKind } & Partial<CoercedSlide>;
  const deck: DeckItem[] = fmt.deck
    ? [{ kind: "cover" }, ...slides.map((s) => ({ kind: "content" as SlideKind, ...s })), { kind: "end" }]
    : [{ kind: (fmt.single as SlideKind) || "cover" }];
  const total = slides.length;
  const cur = deck[Math.min(current, deck.length - 1)];

  async function markDrafted(itemN: number) {
    // Calendar Create-> sets the item to Drafted on successful generation
    // (PRD §11). Round-trips through /api/store since Studio doesn't hold
    // calendar state directly.
    const plan = await storeGet<{ items: { n: number; status: string }[] }>("kognoz-calendar");
    if (!plan || !Array.isArray(plan.items)) return;
    const next = { ...plan, items: plan.items.map((it) => (it.n === itemN ? { ...it, status: "Drafted" } : it)) };
    await storeSet("kognoz-calendar", next);
  }

  async function generate(tTopic?: string, tPillar?: string, tFormat?: FormatId, itemN?: number | null, fresh?: boolean) {
    const gTopic = typeof tTopic === "string" ? tTopic : topic;
    const gPillar = typeof tPillar === "string" && tPillar ? tPillar : pillar;
    const gFormat = typeof tFormat === "string" && tFormat ? tFormat : format;
    if (!gTopic.trim() || loading || modLoading) return;
    setLoading(true);
    setError("");
    try {
      const { prompt, useSearch } = buildGeneratePrompt({
        topic: gTopic,
        pillar: gPillar,
        format: gFormat,
        ideaStyle,
        housePrefs,
        styleMem,
        fresh
      });
      const parsed = coerceContent(await callClaudeJSON("generate", prompt, { useSearch }));
      if (gFormat === "Idea Deck") parsed.slides = applyIdeaDeckKickers(parsed.slides, ideaStyle);
      if (gFormat === "Stat Card" && parsed.slides[0]) parsed.slides[0] = applyStatCardHygiene(parsed.slides[0]);

      setEyebrow(gPillar);
      setCover(parsed.cover);
      setSlides(parsed.slides);
      setCta(parsed.cta || "Start the conversation");
      setImages({});
      setScales({});
      setImgOn({});
      setArticle("");
      setVerifyRes(null);
      setVerifyFixed(null);
      setCurrent(0);
      if (itemN != null) markDrafted(itemN);
    } catch {
      setError("Couldn't generate this time — you can edit the content by hand below, or try again.");
    } finally {
      setLoading(false);
    }
  }

  const startFresh = () => {
    if (!topic.trim() || loading || modLoading) return;
    setSeed(seed + 1 + Math.floor(Math.random() * 7)); // new layout deal, not just +1
    setImages({});
    setModTxt("");
    setError("");
    setCurrent(0);
    generate(topic, pillar, format, null, true);
  };

  async function modifyContent() {
    if (!modTxt.trim() || modLoading || loading) return;
    setModLoading(true);
    setError("");
    try {
      const prompt = buildModifyPrompt({ eyebrow, cover, slides, cta, instruction: modTxt, housePrefs });
      const parsed = coerceContent(await callClaudeJSON("revise", prompt, { model: FAST_MODEL }));
      setEyebrow(parsed.eyebrow || eyebrow);
      setCover(parsed.cover || cover);
      setSlides(parsed.slides);
      setCta(parsed.cta || cta);
      setModTxt("");
    } catch {
      setError("Couldn't revise this time. Try again, or edit the fields directly.");
    } finally {
      setModLoading(false);
    }
  }

  async function writeArticle(instruction?: string) {
    if (artBusy || !topic.trim()) return;
    setArtBusy(true);
    setError("");
    try {
      const prompt = buildArticlePrompt({ topic, pillar, instruction, currentArticle: article });
      const text = await callClaudeText("article", prompt, { model: instruction && instruction.trim() ? FAST_MODEL : undefined, maxTokens: 2600 });
      setArticle(text.trim());
      setArtInstr("");
    } catch (e) {
      setError(`Article writing failed (${e instanceof Error ? e.message : e}). Try once more; tell me this message if it repeats.`);
    } finally {
      setArtBusy(false);
    }
  }

  async function verifyFacts() {
    if (verifying || loading) return;
    setVerifying(true);
    setError("");
    setVerifyRes(null);
    try {
      const prompt = buildVerifyPrompt({ eyebrow, cover, slides, cta });
      const parsed = await callClaudeJSON("verify", prompt, { useSearch: true });
      if (parsed && parsed.fixed) {
        setVerifyRes(parsed.checks || []);
        setVerifyFixed(parsed.fixed);
      } else {
        throw new Error("no verdicts returned");
      }
    } catch (e) {
      setError(`Fact check failed (${e instanceof Error ? e.message : e}). Try once more.`);
    } finally {
      setVerifying(false);
    }
  }
  function applyVerified() {
    if (!verifyFixed) return;
    const parsed = coerceContent(verifyFixed);
    setEyebrow(parsed.eyebrow || eyebrow);
    setCover(parsed.cover || cover);
    setSlides(parsed.slides && parsed.slides.length ? parsed.slides : slides);
    setCta(parsed.cta || cta);
    setVerifyRes(null);
    setVerifyFixed(null);
  }

  async function applyDesignNote() {
    if (!designNote.trim() || designBusy) return;
    setDesignBusy(true);
    setError("");
    try {
      const prompt = buildDesignNotePrompt(designNote);
      const parsed = await callClaudeJSON("designNote", prompt, { model: FAST_MODEL });
      const next = { ...design };
      if (typeof parsed.url === "string" && parsed.url.trim()) next.url = parsed.url.trim();
      if (["swipe", "url", "none"].includes(parsed.coverRight)) next.coverRight = parsed.coverRight;
      if (["page", "url", "none"].includes(parsed.contentRight)) next.contentRight = parsed.contentRight;
      if (["cta", "url", "none"].includes(parsed.singleRight)) next.singleRight = parsed.singleRight;
      if (typeof parsed.petals === "boolean") next.petals = parsed.petals;
      if (["editorial", "numeral", "dark", "glass", "bloom", "magazine", "mixed"].includes(parsed.set)) next.set = parsed.set;
      saveDesign(next);
      setDesignNote("");
    } catch {
      setError("Couldn't read that design note. The toggles below always work.");
    } finally {
      setDesignBusy(false);
    }
  }

  const LOOK_SETS: DesignSetId[] = ["editorial", "numeral", "dark", "glass", "bloom", "magazine"];
  const LOOK_ACCENTS: (string | null)[] = [null, C.blue, C.teal, C.cyan, C.green];
  const cycleLook = () => {
    const i = lookI + 1;
    setLookI(i);
    const nextSet: DesignSetId = design.set === "mixed" ? "mixed" : LOOK_SETS[i % LOOK_SETS.length];
    const nextAccent = LOOK_ACCENTS[Math.floor(i / LOOK_SETS.length) % LOOK_ACCENTS.length];
    saveDesign({ ...design, set: nextSet, accent: nextAccent });
    setSeed((x) => x + 1);
  };

  const photoKeyFor = (): string | null => {
    if (fmt.single === "story") return "story";
    if (fmt.single === "article") return "article";
    if (fmt.deck && !fmt.idea && cur.kind === "cover") return "cover";
    if (fmt.deck && !fmt.idea && cur.kind === "content") return `s${current - 1}`;
    return null;
  };
  async function importImageUrl() {
    const key = photoKeyFor();
    if (!key || !urlVal.trim() || urlBusy) return;
    setUrlBusy(true);
    setError("");
    try {
      const res = await fetch(urlVal.trim());
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      if (!/^image\//.test(blob.type)) throw new Error("that URL isn't an image");
      const dataUrl = await new Promise<string>((resv, rej) => {
        const r = new FileReader();
        r.onload = () => resv(r.result as string);
        r.onerror = () => rej(new Error("read failed"));
        r.readAsDataURL(blob);
      });
      setImg(key, dataUrl);
      setUrlVal("");
      setUrlOpen(false);
    } catch (e) {
      setError(
        `Couldn't import that image (${e instanceof Error ? e.message : e}). Many sites block cross-site fetches; download the picture and click the photo area to upload it instead. Unsplash links (images.unsplash.com) import cleanly.`
      );
    } finally {
      setUrlBusy(false);
    }
  }

  const bumpScale = (d: number) =>
    setScales((m) => {
      const c = m[current] || 1;
      const next = Math.min(1.5, Math.max(0.6, Math.round((c + d) * 100) / 100));
      return { ...m, [current]: next };
    });

  // -------------------- export handlers --------------------
  const elIds = deck.map((_, i) => `exp-${i}`);
  const filenameBase = (i: number) => `kognoz-${format.toLowerCase().replace(/\s+/g, "-")}-${String(i + 1).padStart(2, "0")}`;

  async function handleExportPNG(i: number) {
    setError("");
    try {
      await exportPNG({ elId: `exp-${i}`, baseW, baseH, frames: fmt.frames, filenameBase: filenameBase(i) });
      if (!fmt.frames) saveStyleExample();
    } catch (e) {
      setError(
        `Export failed (${e instanceof Error ? e.name + ": " + e.message : e}). Tap download once more; if it repeats, tell me this exact message. A screenshot of the preview always works meanwhile.`
      );
    }
  }
  async function handleExportAll() {
    for (let i = 0; i < deck.length; i++) {
      await handleExportPNG(i);
      await new Promise((r) => setTimeout(r, 900));
    }
  }
  async function handleExportPdf() {
    if (pdfBusy) return;
    setError("");
    try {
      await exportPdf(elIds, baseW, baseH, (n) => setPdfBusy(n));
    } catch (e) {
      setError(`Deck PDF failed (${e instanceof Error ? e.name + ": " + e.message : e}). Per-slide downloads still work; tell me this message if it repeats.`);
    } finally {
      setPdfBusy(0);
    }
  }
  async function handleExportPanorama() {
    setError("");
    try {
      await exportPanorama("exp-0", baseW, baseH);
    } catch (e) {
      setError(`Panorama failed (${e instanceof Error ? e.message : e}).`);
    }
  }
  async function handleExportStrip() {
    setError("");
    try {
      await exportStrip(elIds, baseW, baseH);
    } catch (e) {
      setError(`Whole-deck export failed (${e instanceof Error ? e.name + ": " + e.message : e}). Per-slide downloads still work.`);
    }
  }

  // -------------------- Calendar Create-> wiring --------------------
  // PRD §11: "Create -> loads Studio with the item's format+style+set, auto-generates."
  useEffect(() => {
    const qTopic = searchParams.get("topic");
    const qFormat = searchParams.get("format") as FormatId | null;
    const qPillar = searchParams.get("pillar");
    const qSet = searchParams.get("set") as DesignSetId | null;
    const qStyle = searchParams.get("style") as IdeaStyle | null;
    const qN = searchParams.get("n");
    if (!qTopic || !qFormat) return;
    setFormat(qFormat);
    if (qStyle) setIdeaStyle(qStyle);
    if (qSet) saveDesign({ ...design, set: qSet });
    if (qPillar && PILLARS[qPillar]) {
      setPillar(qPillar);
      setEyebrow(qPillar);
    }
    setTopic(qTopic);
    setCurrent(0);
    generate(qTopic, qPillar && PILLARS[qPillar] ? qPillar : pillar, qFormat, qN ? Number(qN) : null);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- runs once on the query params present at mount
  }, [searchParams]);

  // -------------------- style helpers (ported verbatim) --------------------
  const label: React.CSSProperties = { fontFamily: font, fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: C.inkMute, marginBottom: 8, display: "block" };
  const inputStyle: React.CSSProperties = { fontFamily: font, width: "100%", padding: "10px 12px", border: `1px solid ${C.line}`, borderRadius: 8, fontSize: 13.5, color: C.ink, background: C.white, boxSizing: "border-box", outline: "none", resize: "vertical", lineHeight: 1.5 };
  const chip = (on: boolean, col: string): React.CSSProperties => ({ fontFamily: font, fontSize: 12.5, fontWeight: 600, padding: "8px 13px", borderRadius: 20, cursor: "pointer", border: `1.5px solid ${on ? col : C.line}`, background: on ? col : C.white, color: on ? "#fff" : C.inkSoft, transition: "all .15s", display: "inline-flex", alignItems: "center", gap: 7 });
  const btn = (primary: boolean): React.CSSProperties => ({ fontFamily: font, fontSize: 13.5, fontWeight: 700, padding: "11px 18px", borderRadius: 8, cursor: loading ? "default" : "pointer", border: "none", color: "#fff", background: primary ? GRAD : C.blue, opacity: loading ? 0.6 : 1, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8, width: "100%" });

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: C.off, fontFamily: font, color: C.ink }}>
      {/* ---------------- CONTROLS ---------------- */}
      <div style={{ width: 400, flexShrink: 0, background: C.white, borderRight: `1px solid ${C.line}`, overflowY: "auto", padding: "26px 24px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 6 }}>
          <Logo h={36} />
        </div>
        <div style={{ fontFamily: font, fontSize: 13, color: C.inkMute, lineHeight: 1.5, marginBottom: 14 }}>Type a topic. Kognoz-voiced content and on-brand design, generated together.</div>
        <a href="/calendar" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "11px 14px", borderRadius: 10, background: C.mist, cursor: "pointer", marginBottom: 22, border: `1px solid ${C.line}`, textDecoration: "none" }}>
          <div style={{ fontFamily: font, fontSize: 13, fontWeight: 700, color: C.blue }}>Content Calendar</div>
          <div style={{ fontFamily: font, fontSize: 12, color: C.inkMute }}>→</div>
        </a>

        <span style={label}>Format</span>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 7, marginBottom: 20 }}>
          {(Object.keys(FORMATS) as FormatId[]).map((f) => (
            <div key={f} onClick={() => { setFormat(f); setCurrent(0); }} style={chip(format === f, C.blue)}>
              {FORMATS[f].hint}
            </div>
          ))}
        </div>

        {format === "Idea Deck" && (
          <div style={{ marginBottom: 20 }}>
            <span style={label}>Deck style</span>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
              {([["signals", "Signals"], ["book", "Book review"], ["story", "Story"]] as [IdeaStyle, string][]).map(([k, lb]) => (
                <div key={k} onClick={() => setIdeaStyle(k)} style={chip(ideaStyle === k, C.teal)}>
                  {lb}
                </div>
              ))}
            </div>
          </div>
        )}

        <span style={label}>Content pillar</span>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 7, marginBottom: 22 }}>
          {Object.keys(PILLARS).map((p) => (
            <div key={p} onClick={() => { setPillar(p); setEyebrow(p); }} style={chip(pillar === p, PILLARS[p])}>
              <span style={{ width: 9, height: 9, borderRadius: "50%", background: pillar === p ? "#fff" : PILLARS[p] }} />
              {p}
            </div>
          ))}
        </div>

        <span style={label}>Topic</span>
        <textarea
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          rows={2}
          placeholder={
            format === "Idea Deck" && ideaStyle === "book"
              ? "Book title, Author (e.g. The Culture Code, Daniel Coyle)"
              : format === "Idea Deck" && ideaStyle === "story"
              ? "The situation (e.g. inside a founder-family succession conversation)"
              : "e.g. Why internal mobility beats external hiring for scarce AI skills"
          }
          style={{ ...inputStyle, marginBottom: 10 }}
        />
        <button onClick={() => generate()} disabled={loading} style={btn(true)}>
          {loading ? "Writing & designing…" : "Generate with Claude"}
        </button>
        {error && <div style={{ fontFamily: font, fontSize: 12, color: "#B4442E", marginTop: 10, lineHeight: 1.5 }}>{error}</div>}

        {format === "Article Cover" && (
          <div style={{ marginTop: 14, border: `1px solid ${C.line}`, borderRadius: 12, padding: 14, background: C.off }}>
            <span style={label}>The article itself · the cover is the billboard, this is the asset</span>
            <button onClick={() => writeArticle()} disabled={artBusy || !topic.trim()} style={{ ...btn(true), opacity: artBusy || !topic.trim() ? 0.6 : 1, marginBottom: 10 }}>
              {artBusy ? "Writing the article…" : article ? "Rewrite from scratch" : "Write the full article"}
            </button>
            {article && (
              <>
                <textarea value={article} onChange={(e) => setArticle(e.target.value)} rows={16} style={{ ...inputStyle, fontFamily: font, fontSize: 12.5, lineHeight: 1.6, marginBottom: 8 }} />
                <div style={{ fontFamily: font, fontSize: 11, color: C.inkMute, marginBottom: 8 }}>{article.split(/\s+/).filter(Boolean).length} words · markdown headings paste cleanly into LinkedIn's article editor</div>
                <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
                  <input value={artInstr} onChange={(e) => setArtInstr(e.target.value)} placeholder="Revise: e.g. sharpen the hook, shorten section 3, add a Gulf example" style={{ ...inputStyle, flex: 1, marginBottom: 0 }} />
                  <button onClick={() => writeArticle(artInstr)} disabled={artBusy || !artInstr.trim()} style={{ fontFamily: font, fontSize: 12, fontWeight: 700, padding: "0 14px", borderRadius: 8, cursor: artBusy || !artInstr.trim() ? "default" : "pointer", border: "none", color: "#fff", background: GRAD, opacity: artBusy || !artInstr.trim() ? 0.55 : 1 }}>
                    ↻
                  </button>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    onClick={() => {
                      try {
                        navigator.clipboard.writeText(article);
                      } catch {
                        /* clipboard permission denied — nothing to recover here */
                      }
                    }}
                    style={{ fontFamily: font, fontSize: 12, fontWeight: 700, padding: "8px 14px", borderRadius: 8, cursor: "pointer", border: `1.5px solid ${C.blue}`, color: C.blue, background: "transparent" }}
                  >
                    Copy article
                  </button>
                  <button
                    onClick={() => saveBlobAs(new Blob([article], { type: "text/markdown" }), "kognoz-article.md")}
                    style={{ fontFamily: font, fontSize: 12, fontWeight: 700, padding: "8px 14px", borderRadius: 8, cursor: "pointer", border: `1.5px solid ${C.blue}`, color: C.blue, background: "transparent" }}
                  >
                    ⬇ .md file
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        <div style={{ marginTop: 14, border: `1px solid ${C.line}`, borderRadius: 12, padding: 14, background: C.off }}>
          <span style={label}>Facts · checked against the live web before you publish</span>
          <button onClick={verifyFacts} disabled={verifying || loading} style={{ ...btn(true), opacity: verifying || loading ? 0.6 : 1, marginBottom: verifyRes ? 10 : 0 }}>
            {verifying ? "Searching & checking…" : "Verify facts"}
          </button>
          {verifyRes && (
            <>
              {verifyRes.map((c, i) => (
                <div key={i} style={{ fontFamily: font, fontSize: 12, lineHeight: 1.5, marginBottom: 8, padding: "8px 10px", borderRadius: 8, background: C.white, borderLeft: `4px solid ${c.verdict === "verified" ? C.green : c.verdict === "wrong" ? "#B4442E" : "#C79A2A"}` }}>
                  <b>
                    {c.verdict === "verified" ? "✓" : c.verdict === "wrong" ? "✗" : "?"} {c.where}
                  </b>{" "}
                  · {c.claim}
                  <div style={{ color: C.inkMute, marginTop: 3 }}>
                    {c.note}
                    {c.realSource ? ` — real source: ${c.realSource}` : ""}
                  </div>
                </div>
              ))}
              {verifyRes.some((c) => c.verdict !== "verified") ? (
                <button onClick={applyVerified} style={{ fontFamily: font, fontSize: 12.5, fontWeight: 700, padding: "9px 16px", borderRadius: 8, cursor: "pointer", border: "none", color: "#fff", background: GRAD }}>
                  Apply corrections
                </button>
              ) : (
                <div style={{ fontFamily: font, fontSize: 12, color: C.green, fontWeight: 700 }}>All claims verified. Publish with confidence.</div>
              )}
            </>
          )}
        </div>

        <div style={{ marginTop: 14 }}>
          <span style={label}>Iterate on content · design elements have their own panel below</span>
          <textarea value={modTxt} onChange={(e) => setModTxt(e.target.value)} rows={2} placeholder="Tell Claude what to change: sharper hook, add a real number, aim it at CEOs, warmer close, shorter slides…" style={{ ...inputStyle, marginBottom: 8 }} />
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={modifyContent} disabled={modLoading || !modTxt.trim()} style={{ ...btn(false), flex: 1, opacity: modLoading || !modTxt.trim() ? 0.55 : 1, cursor: modLoading || !modTxt.trim() ? "default" : "pointer" }}>
              {modLoading ? "Revising…" : "↻ Revise content"}
            </button>
            <button
              onClick={() => appendPref(modTxt)}
              disabled={!modTxt.trim()}
              title="Add this instruction to House style so every future draft follows it"
              style={{ fontFamily: font, fontSize: 12, fontWeight: 700, padding: "0 12px", borderRadius: 8, cursor: modTxt.trim() ? "pointer" : "default", border: `1.5px solid ${C.teal}`, color: C.teal, background: "transparent", opacity: modTxt.trim() ? 1 : 0.5 }}
            >
              + Rule
            </button>
          </div>
          <button onClick={startFresh} disabled={loading || !topic.trim()} style={{ ...btn(false), background: "transparent", color: C.blue, border: `1.5px solid ${C.blue}`, marginTop: 8, opacity: loading || !topic.trim() ? 0.55 : 1, cursor: loading || !topic.trim() ? "default" : "pointer" }}>
            {loading ? "Regenerating…" : "⟳ Regenerate afresh"}
          </button>
          <div style={{ fontFamily: font, fontSize: 11, color: C.inkMute, marginTop: 7, lineHeight: 1.5 }}>
            Revise refines the current draft. Regenerate afresh discards it: a mandated new angle, a new layout deal, and earlier approved examples ignored for that run. For design alone, "Next look" under the preview re-deals layouts without touching the words.
          </div>
        </div>

        <div style={{ marginTop: 18, padding: "14px 14px 12px", background: C.off, borderRadius: 10, border: `1px solid ${C.line}` }}>
          <span style={label}>Design set · one family per deck</span>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
            {(Object.keys(DESIGN_SETS) as DesignSetId[]).map((k) => (
              <div key={k} onClick={() => saveDesign({ ...design, set: k })} style={chip((design.set || "editorial") === k, C.blue)}>
                {DESIGN_SETS[k].label}
              </div>
            ))}
          </div>
          <span style={label}>Accent tone</span>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12, alignItems: "center" }}>
            <div onClick={() => saveDesign({ ...design, accent: null })} style={chip(!design.accent, C.blue)}>
              Auto (pillar)
            </div>
            {([["Blue", C.blue], ["Teal", C.teal], ["Cyan", C.cyan], ["Green", C.green]] as [string, string][]).map(([nm, cv]) => (
              <div key={nm} onClick={() => saveDesign({ ...design, accent: cv })} style={{ ...chip(design.accent === cv, cv), display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ width: 10, height: 10, borderRadius: "50%", background: cv }} />
                {nm}
              </div>
            ))}
          </div>
          <span style={label}>Design elements</span>
          <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
            <input value={designNote} onChange={(e) => setDesignNote(e.target.value)} placeholder="e.g. show the website on every slide · hide page numbers · no circles" style={{ ...inputStyle, fontSize: 12.5, marginBottom: 0 }} />
            <button onClick={applyDesignNote} disabled={designBusy || !designNote.trim()} style={{ fontFamily: font, fontSize: 12, fontWeight: 700, padding: "0 14px", borderRadius: 8, cursor: designBusy || !designNote.trim() ? "default" : "pointer", border: "none", color: "#fff", background: C.teal, opacity: designBusy || !designNote.trim() ? 0.55 : 1, whiteSpace: "nowrap" }}>
              {designBusy ? "…" : "Apply"}
            </button>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 8 }}>
            <div>
              <span style={{ ...label, fontSize: 10 }}>Cover corner</span>
              <select value={design.coverRight} onChange={(e) => saveDesign({ ...design, coverRight: e.target.value as "swipe" | "url" | "none" })} style={{ ...inputStyle, fontSize: 12.5, padding: "8px 10px", marginBottom: 0 }}>
                <option value="swipe">Swipe</option>
                <option value="url">Website</option>
                <option value="none">None</option>
              </select>
            </div>
            <div>
              <span style={{ ...label, fontSize: 10 }}>Slide corner</span>
              <select value={design.contentRight} onChange={(e) => saveDesign({ ...design, contentRight: e.target.value as "page" | "url" | "none" })} style={{ ...inputStyle, fontSize: 12.5, padding: "8px 10px", marginBottom: 0 }}>
                <option value="page">Page numbers</option>
                <option value="url">Website</option>
                <option value="none">None</option>
              </select>
            </div>
            <div>
              <span style={{ ...label, fontSize: 10 }}>Card corner</span>
              <select value={design.singleRight} onChange={(e) => saveDesign({ ...design, singleRight: e.target.value as "cta" | "url" | "none" })} style={{ ...inputStyle, fontSize: 12.5, padding: "8px 10px", marginBottom: 0 }}>
                <option value="cta">Closing line</option>
                <option value="url">Website</option>
                <option value="none">None</option>
              </select>
            </div>
            <div>
              <span style={{ ...label, fontSize: 10 }}>Website line</span>
              <input value={design.url} onChange={(e) => setDesignLocal({ ...design, url: e.target.value })} onBlur={(e) => saveDesign({ ...design, url: e.target.value })} style={{ ...inputStyle, fontSize: 12.5, padding: "8px 10px", marginBottom: 0 }} />
            </div>
          </div>
          <label style={{ display: "flex", alignItems: "center", gap: 8, fontFamily: font, fontSize: 12.5, color: C.inkSoft, cursor: "pointer" }}>
            <input type="checkbox" checked={design.petals} onChange={(e) => saveDesign({ ...design, petals: e.target.checked })} />
            Background circle motif
          </label>
          <div style={{ fontFamily: font, fontSize: 10.5, color: C.inkMute, marginTop: 7, lineHeight: 1.5 }}>The website address lives here as a design element and never appears inside the written content. Content instructions go in &quot;Iterate on content&quot; above.</div>
        </div>

        <div style={{ marginTop: 14, padding: "14px 14px 12px", background: C.mist, borderRadius: 10, border: `1px solid ${C.line}` }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
            <span style={{ ...label, marginBottom: 0 }}>House style · applied to every generation</span>
            <span style={{ fontFamily: font, fontSize: 10.5, fontWeight: 700, color: C.teal }}>
              {styleMem.length} approved example{styleMem.length === 1 ? "" : "s"}
            </span>
          </div>
          <textarea value={housePrefs} onChange={(e) => setHousePrefsLocal(e.target.value)} onBlur={(e) => saveHousePrefs(e.target.value)} rows={3} placeholder='Standing notes Claude follows on every draft. Your revision instructions land here automatically; edit or prune anytime.' style={{ ...inputStyle, background: C.white, fontSize: 12.5 }} />
          <div style={{ fontFamily: font, fontSize: 10.5, color: C.inkMute, marginTop: 6, lineHeight: 1.5 }}>Only rules you save with &quot;+ Rule&quot; land here, so one-off instructions never pollute future drafts. Downloaded finals still become approved examples automatically.</div>
        </div>

        <div style={{ height: 1, background: C.line, margin: "24px 0 20px" }} />

        <span style={label}>Cover headline · mark one word *like this* for the gradient</span>
        <textarea value={cover} onChange={(e) => setCover(e.target.value)} rows={2} style={{ ...inputStyle, marginBottom: 18, fontFamily: displayFont, fontSize: 15 }} />

        <span style={label}>Slides</span>
        {slides.map((s, i) => (
          <div key={i} style={{ border: `1px solid ${C.line}`, borderRadius: 10, padding: 12, marginBottom: 10, background: C.off }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <span style={{ fontFamily: font, fontSize: 11, fontWeight: 700, color: accent, letterSpacing: "0.06em" }}>SLIDE {String(i + 1).padStart(2, "0")}</span>
              <span onClick={() => rmSlide(i)} style={{ fontFamily: font, fontSize: 11, color: C.inkMute, cursor: "pointer", fontWeight: 600 }}>
                Remove
              </span>
            </div>
            <input value={s.title} onChange={(e) => updSlide(i, "title", e.target.value)} placeholder="Slide title" style={{ ...inputStyle, marginBottom: 7, fontFamily: displayFont, fontWeight: 600 }} />
            <textarea value={s.body} onChange={(e) => updSlide(i, "body", e.target.value)} rows={3} placeholder="One idea for this slide" style={inputStyle} />
          </div>
        ))}
        <div onClick={addSlide} style={{ fontFamily: font, fontSize: 12.5, fontWeight: 700, color: C.blue, cursor: "pointer", padding: "6px 0", marginBottom: 18 }}>
          + Add slide
        </div>

        <span style={label}>Closing / CTA</span>
        <textarea value={cta} onChange={(e) => setCta(e.target.value)} rows={2} style={{ ...inputStyle, fontFamily: displayFont, fontSize: 15 }} />
      </div>

      {/* ---------------- PREVIEW ---------------- */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", background: "#E6ECF0", padding: "56px 24px 40px", position: "relative", overflowY: "auto", overflowX: "auto" }}>
        <div style={{ alignSelf: "flex-start", marginBottom: 14, flexShrink: 0, fontFamily: font, fontSize: 12, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: C.inkMute }}>
          {cur.kind === "cover" ? "Cover" : cur.kind === "end" ? "Closing" : cur.kind === "content" ? `Slide ${current} of ${total}` : format} · {baseW}×{baseH}
        </div>

        <div style={{ position: "relative", width: previewW, height: baseH * previewScale, flexShrink: 0, borderRadius: 14 * previewScale, overflow: "hidden", boxShadow: "0 24px 60px rgba(0,40,70,0.22)", background: "#fff" }}>
          {fmt.frames &&
            [...Array(fmt.frames - 1)].map((_, k) => (
              <div key={k} style={{ position: "absolute", top: 0, bottom: 0, left: `${((k + 1) / (fmt.frames as number)) * 100}%`, width: 0, borderLeft: "2px dashed rgba(0,81,132,0.35)", zIndex: 5, pointerEvents: "none" }} />
            ))}
          <div style={{ transform: `scale(${previewScale})`, transformOrigin: "top left", width: baseW, height: baseH }}>
            <Slide
              kind={cur.kind}
              data={cur as CoercedSlide}
              accent={accent}
              eyebrow={eyebrow}
              cta={cta}
              baseW={baseW}
              baseH={baseH}
              idx={cur.kind === "content" ? current : 0}
              total={total}
              id="preview-slide"
              cover={cover}
              slides={slides}
              seed={seed}
              images={images}
              setImg={setImg}
              design={design}
              scale={scales[current] || 1}
              ideaMode={!!fmt.idea}
              photoOn={!!imgOn[current]}
            />
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 14, marginTop: 22, flexShrink: 0 }}>
          <div onClick={() => setCurrent((c) => Math.max(0, c - 1))} style={{ cursor: "pointer", width: 40, height: 40, borderRadius: "50%", background: current === 0 ? C.line : C.white, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 2px 10px rgba(0,40,70,.1)", fontSize: 18, color: C.ink }}>
            ‹
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            {deck.map((_, i) => (
              <div key={i} onClick={() => setCurrent(i)} style={{ width: i === current ? 22 : 8, height: 8, borderRadius: 4, background: i === current ? C.blue : C.lineD, cursor: "pointer", transition: "all .2s" }} />
            ))}
          </div>
          <div onClick={() => setCurrent((c) => Math.min(deck.length - 1, c + 1))} style={{ cursor: "pointer", width: 40, height: 40, borderRadius: "50%", background: current === deck.length - 1 ? C.line : C.white, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 2px 10px rgba(0,40,70,.1)", fontSize: 18, color: C.ink }}>
            ›
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 14, flexShrink: 0, flexWrap: "wrap", justifyContent: "center", background: C.white, borderRadius: 20, padding: "6px 14px", boxShadow: "0 2px 10px rgba(0,40,70,.08)" }}>
          <span style={{ fontFamily: font, fontSize: 11.5, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: C.inkMute }}>Text size · this slide</span>
          <div onClick={() => bumpScale(-0.08)} style={{ cursor: "pointer", fontFamily: font, fontSize: 15, fontWeight: 800, color: C.blue, padding: "0 6px", userSelect: "none" }}>
            A−
          </div>
          <span style={{ fontFamily: font, fontSize: 12.5, fontWeight: 700, color: C.ink, width: 44, textAlign: "center" }}>{Math.round((scales[current] || 1) * 100)}%</span>
          <div onClick={() => bumpScale(0.08)} style={{ cursor: "pointer", fontFamily: font, fontSize: 17, fontWeight: 800, color: C.blue, padding: "0 6px", userSelect: "none" }}>
            A+
          </div>
          {(scales[current] || 1) !== 1 && (
            <div onClick={() => setScales((m) => ({ ...m, [current]: 1 }))} style={{ cursor: "pointer", fontFamily: font, fontSize: 12, fontWeight: 700, color: C.inkMute, userSelect: "none" }}>
              ↺ Reset
            </div>
          )}
          {fmt.deck && !fmt.idea && (cur.kind === "cover" || cur.kind === "content") && (
            <div onClick={() => setImgOn((m) => ({ ...m, [current]: !m[current] }))} style={{ cursor: "pointer", fontFamily: font, fontSize: 12, fontWeight: 700, color: imgOn[current] ? C.teal : C.inkMute, userSelect: "none", borderLeft: `1px solid ${C.line}`, paddingLeft: 10 }}>
              {imgOn[current] ? "Photo on" : "Add photo"}
            </div>
          )}
          {photoKeyFor() && (
            <div onClick={() => setUrlOpen((v) => !v)} style={{ cursor: "pointer", fontFamily: font, fontSize: 12, fontWeight: 700, color: urlOpen ? C.blue : C.inkMute, userSelect: "none", borderLeft: `1px solid ${C.line}`, paddingLeft: 10 }}>
              🔗 Image URL
            </div>
          )}
        </div>
        {urlOpen && photoKeyFor() && (
          <div style={{ display: "flex", gap: 8, marginTop: 10, flexShrink: 0, width: "min(560px, 92%)" }}>
            <input value={urlVal} onChange={(e) => setUrlVal(e.target.value)} placeholder="Paste an image URL (Unsplash images import cleanly) — lands on this slide's photo slot" style={{ flex: 1, fontFamily: font, fontSize: 12.5, color: C.ink, background: C.white, border: `1px solid ${C.line}`, borderRadius: 8, padding: "9px 12px", outline: "none" }} />
            <button onClick={importImageUrl} disabled={urlBusy || !urlVal.trim()} style={{ fontFamily: font, fontSize: 12, fontWeight: 700, padding: "0 16px", borderRadius: 8, cursor: urlBusy || !urlVal.trim() ? "default" : "pointer", border: "none", color: "#fff", background: C.teal, opacity: urlBusy || !urlVal.trim() ? 0.55 : 1 }}>
              {urlBusy ? "…" : "Import"}
            </button>
          </div>
        )}

        <div style={{ display: "flex", gap: 10, marginTop: 14, flexWrap: "wrap", justifyContent: "center", flexShrink: 0 }}>
          {fmt.single !== "video" && (
            <button onClick={cycleLook} style={{ fontFamily: font, fontSize: 13, fontWeight: 700, padding: "10px 18px", borderRadius: 8, cursor: "pointer", border: "none", color: "#fff", background: GRAD }}>
              🎲 Next look · {(DESIGN_SETS[design.set || "editorial"] || DESIGN_SETS.editorial).label.split(" ·")[0]}
              {design.accent ? " · tinted" : ""}
            </button>
          )}
          <button onClick={() => handleExportPNG(current)} style={{ fontFamily: font, fontSize: 13, fontWeight: 700, padding: "10px 18px", borderRadius: 8, cursor: "pointer", border: "none", color: "#fff", background: C.blue }}>
            {fmt.frames ? `Download ${fmt.frames} frames` : fmt.single === "video" ? "Download poster PNG" : "Download this slide"}
          </button>
          {fmt.deck && (
            <button onClick={handleExportPdf} disabled={!!pdfBusy} style={{ fontFamily: font, fontSize: 13, fontWeight: 700, padding: "10px 18px", borderRadius: 8, cursor: pdfBusy ? "default" : "pointer", border: "none", color: "#fff", background: GRAD, opacity: pdfBusy ? 0.7 : 1 }}>
              {pdfBusy ? `Building PDF · slide ${pdfBusy}/${deck.length}…` : "⬇ Deck PDF · LinkedIn-ready"}
            </button>
          )}
          {fmt.deck && (
            <button onClick={handleExportStrip} style={{ fontFamily: font, fontSize: 13, fontWeight: 700, padding: "10px 18px", borderRadius: 8, cursor: "pointer", border: `1.5px solid ${C.blue}`, color: C.blue, background: "transparent" }}>
              🧵 Review strip
            </button>
          )}
          {fmt.frames && (
            <button onClick={handleExportPanorama} style={{ fontFamily: font, fontSize: 13, fontWeight: 700, padding: "10px 18px", borderRadius: 8, cursor: "pointer", border: `1.5px solid ${C.blue}`, color: C.blue, background: "transparent" }}>
              🖼 Panorama · one image
            </button>
          )}
          <button onClick={handleExportAll} style={{ fontFamily: font, fontSize: 13, fontWeight: 700, padding: "10px 18px", borderRadius: 8, cursor: "pointer", border: `1.5px solid ${C.blue}`, color: C.blue, background: "transparent" }}>
            Download all ({deck.length})
          </button>
        </div>
        <div style={{ fontFamily: font, fontSize: 11, color: C.inkMute, marginTop: 12, maxWidth: 380, textAlign: "center", lineHeight: 1.5 }}>
          PNGs export at full size, with the Fraunces/Open Sans font files embedded so they render correctly outside the browser. A Design set holds ONE layout across the whole deck. &quot;Next look&quot; cycles 30 uniform looks (6 sets × 5 accent tones); pick a set or accent directly in Design elements to pin it. Click any image area to drop in a photo. Montage slices into carousel frames (dashed lines show the cuts). &quot;Deck PDF&quot; is the file LinkedIn document posts upload directly, one slide per page. &quot;Review strip&quot; is a half-size single image for quick sharing.
        </div>
      </div>

      {/* hidden full-resolution renders used for export */}
      <div style={{ position: "absolute", left: -99999, top: 0, pointerEvents: "none" }} aria-hidden>
        {deck.map((d, i) => (
          <Slide
            key={i}
            id={`exp-${i}`}
            kind={d.kind}
            data={d as CoercedSlide}
            accent={accent}
            eyebrow={eyebrow}
            cta={cta}
            baseW={baseW}
            baseH={baseH}
            idx={d.kind === "content" ? i : 0}
            total={total}
            cover={cover}
            slides={slides}
            seed={seed}
            images={images}
            setImg={setImg}
            design={design}
            scale={scales[i] || 1}
            ideaMode={!!fmt.idea}
            photoOn={!!imgOn[i]}
          />
        ))}
      </div>
    </div>
  );
}
