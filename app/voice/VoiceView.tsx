"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { Mic, Plus, X, Check, AlertTriangle, Sparkles } from "lucide-react";
import { AppShell } from "@/components/shell/AppShell";
import { useBrand } from "@/components/BrandProvider";
import { brandKey } from "@/lib/brands";
import { storeGet, storeSet } from "@/lib/storeClient";
import {
  coerceSamples,
  mergeSamples,
  splitPastedSamples,
  SAMPLE_KINDS,
  MIN_SAMPLE_CHARS,
  type VoiceSample,
  type SampleKind
} from "@/lib/voiceSamples";
import { channelTallies, pickedIds, contributors, filterSamples, rejectionReason, corpusState } from "@/lib/voiceGuide";
import type { ChannelId } from "@/lib/founderProfiles";

// The voice guide — the corpus of real human writing every generation imitates.
//
// It exists as its own screen because three people now maintain it (Lokesh, Yashwanth
// and Harpreet), and until now contributing meant finding a collapsed panel inside a
// 2,400-line Studio component.
//
// THE DISTINCTION THIS SCREEN HOLDS, which the reference UI collapses into one free-text
// "author" field:
//
//   channel   WHOSE VOICE this is. Drives pickSamples — a post generated for Lokesh
//             imitates samples tagged Lokesh.
//   addedBy   WHO CONTRIBUTED it. Never affects generation.
//
// A sample of Lokesh's writing added by Yashwanth is channel "Lokesh", addedBy
// "yashwanth…". Merging the two would either credit the wrong person or write in the
// wrong voice.

export function VoiceView() {
  const brand = useBrand();
  const { data: session } = useSession();
  const k = (name: string) => brandKey(brand, name);

  const [samples, setSamples] = useState<VoiceSample[]>([]);
  const [stale, setStale] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saveError, setSaveError] = useState("");

  const [channelFilter, setChannelFilter] = useState<string>("");
  const [kindFilter, setKindFilter] = useState<SampleKind | "">("");

  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState("");
  const [draftChannel, setDraftChannel] = useState<ChannelId>(brand.defaultChannel);
  const [draftKind, setDraftKind] = useState<SampleKind>("post");
  const [draftNote, setDraftNote] = useState("");
  const [addResult, setAddResult] = useState<{ ok: boolean; message: string } | null>(null);

  const channels = Object.keys(brand.channels);

  // Each brand keeps its own corpus. Switching reloads rather than merging — a Konverz
  // sample must never end up teaching a Kognoz post.
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setSamples([]);
    setChannelFilter("");
    setDraftChannel(brand.defaultChannel);
    storeGet<unknown>(k("voice-samples"))
      .then((r) => {
        if (cancelled) return;
        setSamples(coerceSamples(r.value));
        setStale(r.stale);
      })
      .catch(() => !cancelled && setStale(true))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed on the brand
  }, [brand.id]);

  const state = corpusState(samples, stale, brand.name);
  const tallies = useMemo(() => channelTallies(samples), [samples]);
  const picked = useMemo(() => pickedIds(samples), [samples]);
  const people = useMemo(() => contributors(samples), [samples]);
  const shown = useMemo(
    () => filterSamples(samples, { channel: channelFilter || undefined, kind: kindFilter || undefined }),
    [samples, channelFilter, kindFilter]
  );

  async function persist(next: VoiceSample[]) {
    const before = samples;
    setSamples(next);
    setSaveError("");
    const res = await storeSet(k("voice-samples"), next);
    if (res && res.ok === false) {
      // Put it back. Leaving the optimistic list on screen after a failed write is how
      // someone believes a sample is saved when it is not.
      setSamples(before);
      setSaveError("Could not save — your change was undone. The voice guide is unchanged on the server.");
    }
  }

  function addSamples() {
    const reason = rejectionReason(draft);
    if (reason) {
      setAddResult({ ok: false, message: reason });
      return;
    }

    // splitPastedSamples already reports what it threw away, so all three outcomes can
    // be stated: added, too short, already saved. A paste that half-vanishes without
    // saying so is the failure that matters here.
    const { samples: parsed, skipped } = splitPastedSamples(draft, {
      channel: draftChannel,
      kind: draftKind,
      addedBy: session?.user?.email || undefined
    });

    const note = draftNote.trim();
    const incoming = note ? parsed.map((s) => ({ ...s, note })) : parsed;

    const merged = mergeSamples(samples, incoming);
    const added = merged.length - samples.length;
    const duplicates = incoming.length - added;

    if (!added) {
      setAddResult({
        ok: false,
        message: skipped
          ? `Nothing added — ${skipped} piece${skipped === 1 ? " was" : "s were"} shorter than ${MIN_SAMPLE_CHARS} characters${duplicates ? ", and the rest are already saved" : ""}.`
          : "Nothing added — every one of those is already in the guide."
      });
      return;
    }

    void persist(merged);
    const parts = [`Added ${added} sample${added === 1 ? "" : "s"} in ${draftChannel}'s voice.`];
    if (skipped) parts.push(`${skipped} skipped as shorter than ${MIN_SAMPLE_CHARS} characters.`);
    if (duplicates) parts.push(`${duplicates} already saved.`);
    setAddResult({ ok: true, message: parts.join(" ") });
    setDraft("");
    setDraftNote("");
    setAdding(false);
  }

  return (
    <AppShell>
      <div className="flex-1 overflow-y-auto p-4 md:p-8 bg-slate-50">
        <div className="max-w-4xl mx-auto space-y-6">
          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#43AFCD]/10 text-[#0A6E8F] border border-[#43AFCD]/30">
                <Mic className="w-3.5 h-3.5" />
                <span>Voice guide</span>
              </div>
              <h2 className="text-2xl md:text-3xl font-medium text-slate-900">Brand voice samples</h2>
              <p className="text-xs text-slate-500 max-w-xl leading-relaxed">
                Real writing by real people. Every generation imitates these — nothing here is written by
                the model, and nothing here should be paraphrased.
              </p>
            </div>

            <button
              onClick={() => {
                setAdding((v) => !v);
                setAddResult(null);
              }}
              className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold flex items-center gap-2 self-start transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{adding ? "Cancel" : "Add samples"}</span>
            </button>
          </div>

          {/* Corpus state — empty and unreadable must never look alike. */}
          <div
            className={`rounded-xl border p-3 text-xs leading-relaxed flex items-start gap-2 ${
              state.kind === "unreachable"
                ? "bg-amber-50 border-amber-200 text-amber-900"
                : state.kind === "empty"
                  ? "bg-slate-100 border-slate-200 text-slate-600"
                  : "bg-white border-slate-200 text-slate-600"
            }`}
          >
            {state.kind === "unreachable" && <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-px" />}
            <span>
              <strong className="text-slate-900">{brand.name}</strong> · {loading ? "Loading…" : state.message}
            </span>
          </div>

          {saveError && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">{saveError}</div>
          )}

          {/* Add form */}
          {adding && (
            <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">
                    Whose voice
                  </span>
                  <select
                    value={draftChannel}
                    onChange={(e) => setDraftChannel(e.target.value as ChannelId)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs text-slate-900 bg-white"
                  >
                    {channels.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block">
                  <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">
                    Kind
                  </span>
                  <select
                    value={draftKind}
                    onChange={(e) => setDraftKind(e.target.value as SampleKind)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs text-slate-900 bg-white"
                  >
                    {SAMPLE_KINDS.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <label className="block">
                <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">
                  The writing, verbatim
                </span>
                <textarea
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  rows={9}
                  placeholder={`Paste one post, or several separated by a blank line — each becomes its own sample.\n\nAt least ${MIN_SAMPLE_CHARS} characters each. Do not tidy the phrasing: the phrasing is the point.`}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs text-slate-900 leading-relaxed"
                />
              </label>

              <label className="block">
                <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">
                  Note (optional, never sent to the model)
                </span>
                <input
                  value={draftNote}
                  onChange={(e) => setDraftNote(e.target.value)}
                  placeholder="e.g. his best performing post this year"
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs text-slate-900"
                />
              </label>

              <div className="flex items-center justify-between gap-3">
                <span className="text-[11px] text-slate-400">
                  Saved as {session?.user?.email || "you"} — recorded against the sample.
                </span>
                <button
                  onClick={addSamples}
                  className="px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold transition-colors"
                >
                  Add to the guide
                </button>
              </div>
            </div>
          )}

          {addResult && (
            <div
              className={`rounded-xl border p-3 text-xs flex items-start gap-2 leading-relaxed ${
                addResult.ok
                  ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                  : "bg-amber-50 border-amber-200 text-amber-900"
              }`}
            >
              {addResult.ok ? (
                <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-px" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-px" />
              )}
              <span>{addResult.message}</span>
            </div>
          )}

          {/* Per-channel coverage. The "picked" number is the point of this block. */}
          {tallies.length > 0 && (
            <div className="bg-white rounded-xl border border-slate-200 p-4">
              <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-3">
                Coverage · what a generation actually draws on
              </div>
              <div className="space-y-2">
                {tallies.map((t) => (
                  <div key={t.channel} className="flex items-center justify-between gap-4 text-xs">
                    <span className="font-medium text-slate-800">{t.channel}</span>
                    <span className="font-mono tabular-nums text-slate-500">
                      {t.picked} of {t.total} used
                    </span>
                  </div>
                ))}
              </div>
              <p className="text-[11px] text-slate-400 mt-3 leading-relaxed">
                A generation imitates a rotating handful, not everything saved — so a channel with far
                more samples than it uses is well covered, not wasted.
              </p>
            </div>
          )}

          {/* Who has contributed. Worth showing now that three people maintain this —
              "who put this here" becomes a real question the moment it is not just one
              person's list. */}
          {people.length > 0 && (
            <div className="bg-white rounded-xl border border-slate-200 p-4">
              <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-3">
                Contributors
              </div>
              <div className="flex flex-wrap gap-2">
                {people.map((c) => (
                  <span
                    key={c.who}
                    className="text-[11px] px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 border border-slate-200"
                  >
                    {c.who} <span className="font-mono tabular-nums text-slate-400">{c.count}</span>
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Filters */}
          {samples.length > 0 && (
            <div className="bg-white rounded-xl border border-slate-200 p-3 flex items-center justify-between gap-3 flex-wrap">
              <span className="text-xs text-slate-500 font-mono tabular-nums">
                {shown.length} of {samples.length}
              </span>
              <div className="flex items-center gap-2 flex-wrap">
                <select
                  value={channelFilter}
                  onChange={(e) => setChannelFilter(e.target.value)}
                  className="px-2.5 py-1 rounded-lg border border-slate-300 text-xs bg-white text-slate-700"
                >
                  <option value="">Every voice</option>
                  {channels.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
                <div className="flex items-center bg-slate-100 p-0.5 rounded-lg text-xs font-medium">
                  {(["", ...SAMPLE_KINDS] as const).map((kind) => (
                    <button
                      key={kind || "all"}
                      onClick={() => setKindFilter(kind as SampleKind | "")}
                      className={`px-3 py-1 rounded-md transition-colors ${
                        kindFilter === kind ? "bg-white text-slate-900 font-semibold" : "text-slate-500 hover:text-slate-900"
                      }`}
                    >
                      {kind || "All"}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Samples */}
          <div className="space-y-3">
            {shown.map((s) => (
              <div key={s.id} className="bg-white rounded-xl border border-slate-200 p-4">
                <div className="flex items-center gap-2 mb-2 flex-wrap">
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#43AFCD]/10 text-[#0A6E8F] border border-[#43AFCD]/30">
                    {s.channel}
                  </span>
                  <span className="text-[10px] font-mono text-slate-400">{s.kind}</span>
                  {picked.has(s.id) && (
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 inline-flex items-center gap-1">
                      <Sparkles className="w-2.5 h-2.5" />
                      in use
                    </span>
                  )}
                  <button
                    onClick={() => void persist(samples.filter((v) => v.id !== s.id))}
                    aria-label="Remove this sample"
                    title="Remove this sample"
                    className="ml-auto p-1 rounded text-slate-300 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>

                <p className="text-xs text-slate-700 leading-relaxed whitespace-pre-wrap">{s.text}</p>

                <div className="mt-3 pt-2 border-t border-slate-100 text-[10px] text-slate-400 flex items-center gap-2 flex-wrap">
                  <span>{s.addedBy || "contributor not recorded"}</span>
                  <span>·</span>
                  <span className="font-mono">{s.addedAt.slice(0, 10)}</span>
                  {s.note && <span className="italic">· {s.note}</span>}
                </div>
              </div>
            ))}

            {!loading && samples.length > 0 && shown.length === 0 && (
              <div className="bg-white rounded-xl border border-slate-200 p-6 text-center text-xs text-slate-500">
                No samples match that filter.
              </div>
            )}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
