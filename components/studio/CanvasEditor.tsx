"use client";

// Direct manipulation on top of the slide preview.
//
// This is EDITOR CHROME and it renders OUTSIDE the node lib/exportPipeline.ts clones, so
// nothing here can reach a downloaded PNG. That is the whole reason selection outlines,
// grips and toolbars live in this file rather than in components/slide/ElementLayer.tsx:
// there is no "do not export this" mechanism in the pipeline, only the boundary.
//
// Two things worth knowing before changing anything here:
//
//   base pixels     The slide lays out at 1080x1350 (or whatever the format says) and the
//                   preview is that box under a single CSS scale. Every number this file
//                   receives or stores is in SLIDE space; only the chrome is drawn in
//                   screen space, by multiplying through `previewScale`. Pointer deltas
//                   are divided by it on the way in. Store a screen pixel anywhere and the
//                   export lands somewhere else than the preview showed.
//   one commit      A drag updates a local draft and re-renders only this component. The
//                   deck is written once, on pointer-up. Slide.tsx is ~2000 lines and is
//                   mounted twice; re-rendering it per pointermove is visibly slow.

import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowUp, ArrowDown, RotateCcw, Trash2 } from "lucide-react";
import ElementLayer from "@/components/slide/ElementLayer";
import { slotAt } from "@/lib/templateSlots";
import {
  boundsOf,
  bringForward,
  centerOf,
  clampToCanvas,
  createText,
  hitTest,
  moveTo,
  removeElement,
  resetSlot,
  resizeBy,
  rotateTo,
  sendBackward,
  snapPosition,
  updateElement,
  type Handle,
  type SlideElement,
  type SnapGuide
} from "@/lib/slideElements";

const ACCENT = "#7C3AED";
const GRIP = 10;
/** Snap pull measured on screen, so it feels the same at any zoom. */
const SNAP_SCREEN_PX = 6;
/** Hold shift while rotating to land on a clean angle. */
const ROTATE_SNAP_DEG = 15;

const HANDLES: { h: Handle; left: string; top: string; cursor: string }[] = [
  { h: "nw", left: "0%", top: "0%", cursor: "nwse-resize" },
  { h: "n", left: "50%", top: "0%", cursor: "ns-resize" },
  { h: "ne", left: "100%", top: "0%", cursor: "nesw-resize" },
  { h: "e", left: "100%", top: "50%", cursor: "ew-resize" },
  { h: "se", left: "100%", top: "100%", cursor: "nwse-resize" },
  { h: "s", left: "50%", top: "100%", cursor: "ns-resize" },
  { h: "sw", left: "0%", top: "100%", cursor: "nesw-resize" },
  { h: "w", left: "0%", top: "50%", cursor: "ew-resize" }
];

type Gesture =
  | { kind: "move"; id: string; bx: number; by: number; origin: SlideElement }
  | { kind: "resize"; id: string; handle: Handle; bx: number; by: number; origin: SlideElement }
  | { kind: "rotate"; id: string; origin: SlideElement; startDeg: number };

export interface CanvasEditorProps {
  /** Off means the overlay is inert, so the slide's own controls keep working. */
  active: boolean;
  elements: readonly SlideElement[];
  baseW: number;
  baseH: number;
  previewScale: number;
  /**
   * The hidden full-size copy to measure template elements from.
   *
   * Never the preview: that one is scaled, so every rect read off it would be a fraction
   * of the real geometry. See lib/templateSlots.ts.
   */
  exportRootId: string;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  /** Called once per gesture, never per pointermove. */
  onCommit: (next: SlideElement[]) => void;
  /** Tells the exported layer to stop drawing the element this file is drawing. */
  onDraggingChange: (id: string | null) => void;
}

export default function CanvasEditor({
  active,
  elements,
  baseW,
  baseH,
  previewScale,
  exportRootId,
  selectedId,
  onSelect,
  onCommit,
  onDraggingChange
}: CanvasEditorProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const gestureRef = useRef<Gesture | null>(null);
  const [draft, setDraftState] = useState<SlideElement | null>(null);
  const [guides, setGuides] = useState<SnapGuide[]>([]);

  /**
   * The draft is mirrored in a ref because the commit has to read it OUTSIDE a state
   * updater. React runs updater functions during render, so committing from inside one
   * means calling Studio's setState mid-render — which React reports as "Cannot update a
   * component while rendering a different component", and which loses the last frame of
   * the gesture under StrictMode's double-invoke.
   */
  const draftRef = useRef<SlideElement | null>(null);
  const setDraft = useCallback((next: SlideElement | null) => {
    draftRef.current = next;
    setDraftState(next);
  }, []);

  const s = previewScale;
  const selected = elements.find((e) => e.id === selectedId) ?? null;
  const shown = draft ?? selected;

  /** Pointer position in slide coordinates. */
  const toBase = useCallback(
    (e: { clientX: number; clientY: number }) => {
      const r = rootRef.current?.getBoundingClientRect();
      if (!r) return { x: 0, y: 0 };
      return { x: (e.clientX - r.left) / s, y: (e.clientY - r.top) / s };
    },
    [s]
  );

  const endGesture = useCallback(() => {
    const g = gestureRef.current;
    const d = draftRef.current;
    gestureRef.current = null;
    setGuides([]);
    onDraggingChange(null);
    setDraft(null);
    if (g && d) onCommit(updateElement(elements, d.id, () => d));
  }, [elements, onCommit, onDraggingChange, setDraft]);

  // Window-level listeners so a fast drag that leaves the preview box still tracks, and
  // still finishes if the button is released outside it.
  useEffect(() => {
    if (!active) return;
    const move = (e: PointerEvent) => {
      const g = gestureRef.current;
      if (!g) return;
      const p = toBase(e);

      if (g.kind === "move") {
        const moved = moveTo(g.origin, g.origin.x + (p.x - g.bx), g.origin.y + (p.y - g.by));
        const snapped = snapPosition({ ...moved, id: moved.id }, elements, baseW, baseH, SNAP_SCREEN_PX / s);
        setGuides(snapped.guides);
        setDraft(clampToCanvas({ ...moved, x: snapped.x, y: snapped.y }, baseW, baseH));
        return;
      }

      if (g.kind === "resize") {
        setDraft(resizeBy(g.origin, g.handle, p.x - g.bx, p.y - g.by, { lockAspect: e.shiftKey }));
        return;
      }

      const c = centerOf(g.origin);
      const deg = (Math.atan2(p.y - c.y, p.x - c.x) * 180) / Math.PI;
      setDraft(rotateTo(g.origin, g.origin.rot + (deg - g.startDeg), e.shiftKey ? ROTATE_SNAP_DEG : 0));
    };
    const up = () => endGesture();
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
    };
  }, [active, baseH, baseW, elements, endGesture, s, setDraft, toBase]);

  // Keyboard, only while something is selected. The guard on editable targets mirrors the
  // one Studio puts on Cmd+Z: a person typing in a field expects the field's behaviour.
  useEffect(() => {
    if (!active || !selectedId) return;
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      const tag = t?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || t?.isContentEditable) return;

      if (e.key === "Escape") return onSelect(null);
      if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        onCommit(removeElement(elements, selectedId));
        return onSelect(null);
      }
      const step = e.shiftKey ? 10 : 1;
      const nudge: Record<string, [number, number]> = {
        ArrowLeft: [-step, 0],
        ArrowRight: [step, 0],
        ArrowUp: [0, -step],
        ArrowDown: [0, step]
      };
      const d = nudge[e.key];
      if (!d) return;
      e.preventDefault();
      onCommit(
        updateElement(elements, selectedId, (el) => clampToCanvas(moveTo(el, el.x + d[0], el.y + d[1]), baseW, baseH))
      );
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active, baseH, baseW, elements, onCommit, onSelect, selectedId]);

  if (!active) return null;

  function onBackgroundDown(e: React.PointerEvent) {
    const p = toBase(e);
    const hit = hitTest(elements, p.x, p.y);

    // Nothing of ours under the pointer: the click may be on template content, which
    // becomes a free object the moment it is touched. The copy is measured off the render,
    // so it appears exactly where the original was and the unlock is invisible.
    if (!hit) {
      const root = document.getElementById(exportRootId);
      const slot = root ? slotAt(root, p.x, p.y) : null;
      if (!slot) return onSelect(null);
      const made = createText(elements, {
        x: slot.x,
        y: slot.y,
        w: slot.w,
        h: slot.h,
        text: slot.text,
        fontFamily: slot.fontFamily,
        fontSize: slot.fontSize,
        fontWeight: slot.fontWeight,
        color: slot.color,
        align: slot.align,
        lineHeight: slot.lineHeight,
        from: slot.slot
      });
      onCommit([...elements, made]);
      return onSelect(made.id);
    }

    onSelect(hit.id);
    gestureRef.current = { kind: "move", id: hit.id, bx: p.x, by: p.y, origin: hit };
    onDraggingChange(hit.id);
    setDraft(hit);
  }

  function startResize(e: React.PointerEvent, handle: Handle) {
    if (!shown) return;
    e.stopPropagation();
    const p = toBase(e);
    gestureRef.current = { kind: "resize", id: shown.id, handle, bx: p.x, by: p.y, origin: shown };
    onDraggingChange(shown.id);
    setDraft(shown);
  }

  function startRotate(e: React.PointerEvent) {
    if (!shown) return;
    e.stopPropagation();
    const p = toBase(e);
    const c = centerOf(shown);
    gestureRef.current = {
      kind: "rotate",
      id: shown.id,
      origin: shown,
      startDeg: (Math.atan2(p.y - c.y, p.x - c.x) * 180) / Math.PI
    };
    onDraggingChange(shown.id);
    setDraft(shown);
  }

  const bounds = shown ? boundsOf(shown) : null;
  const canReset = shown?.kind === "text" && !!shown.from;

  const actions = [
    { key: "fwd", Icon: ArrowUp, label: "Bring forward", run: () => shown && onCommit(bringForward(elements, shown.id)) },
    { key: "back", Icon: ArrowDown, label: "Send backward", run: () => shown && onCommit(sendBackward(elements, shown.id)) },
    // Only an unlocked template element has a template to go back to; an added shape does not.
    ...(canReset && shown && shown.kind === "text" && shown.from
      ? [
          {
            key: "reset",
            Icon: RotateCcw,
            label: "Reset to template",
            run: () => {
              onCommit(resetSlot(elements, shown.from!));
              onSelect(null);
            }
          }
        ]
      : []),
    {
      key: "del",
      Icon: Trash2,
      label: "Delete",
      run: () => {
        if (!shown) return;
        onCommit(removeElement(elements, shown.id));
        onSelect(null);
      }
    }
  ];

  return (
    <div
      ref={rootRef}
      onPointerDown={onBackgroundDown}
      style={{
        position: "absolute",
        left: 0,
        top: 0,
        width: baseW * s,
        height: baseH * s,
        cursor: "default",
        touchAction: "none",
        zIndex: 6
      }}
    >
      {/* The element being dragged, drawn with the real renderer so the ghost and the
          committed result cannot look different. */}
      {draft && (
        <div
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            width: baseW,
            height: baseH,
            transform: `scale(${s})`,
            transformOrigin: "top left",
            pointerEvents: "none"
          }}
        >
          <ElementLayer elements={[draft]} baseW={baseW} baseH={baseH} />
        </div>
      )}

      {guides.map((g, i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            background: ACCENT,
            pointerEvents: "none",
            ...(g.axis === "x"
              ? { left: g.at * s, top: 0, width: 1, height: baseH * s }
              : { left: 0, top: g.at * s, height: 1, width: baseW * s })
          }}
        />
      ))}

      {shown && (
        <div
          style={{
            position: "absolute",
            left: shown.x * s,
            top: shown.y * s,
            width: shown.w * s,
            height: shown.h * s,
            transform: shown.rot ? `rotate(${shown.rot}deg)` : undefined,
            transformOrigin: "center center",
            border: `1.5px solid ${ACCENT}`,
            pointerEvents: "none"
          }}
        >
          {HANDLES.map(({ h, left, top, cursor }) => (
            <div
              key={h}
              onPointerDown={(e) => startResize(e, h)}
              style={{
                position: "absolute",
                left,
                top,
                width: GRIP,
                height: GRIP,
                marginLeft: -GRIP / 2,
                marginTop: -GRIP / 2,
                borderRadius: 2,
                background: "#fff",
                border: `1.5px solid ${ACCENT}`,
                cursor,
                pointerEvents: "auto"
              }}
            />
          ))}
          <div
            onPointerDown={startRotate}
            title="Rotate — hold Shift for 15° steps"
            style={{
              position: "absolute",
              left: "50%",
              top: "100%",
              marginLeft: -GRIP,
              marginTop: 18,
              width: GRIP * 2,
              height: GRIP * 2,
              borderRadius: "50%",
              background: "#fff",
              border: `1.5px solid ${ACCENT}`,
              cursor: "grab",
              pointerEvents: "auto"
            }}
          />
        </div>
      )}

      {/* Toolbar stays upright whatever the element's rotation, and sits above its
          axis-aligned bounds so it never covers the thing you are editing. */}
      {shown && bounds && !draft && (
        <div
          onPointerDown={(e) => e.stopPropagation()}
          style={{
            position: "absolute",
            left: (bounds.x + bounds.w / 2) * s,
            top: Math.max(4, bounds.y * s - 44),
            transform: "translateX(-50%)",
            display: "flex",
            gap: 2,
            padding: 4,
            borderRadius: 10,
            background: "#1F2430",
            boxShadow: "0 8px 24px rgba(0,0,0,.28)",
            pointerEvents: "auto"
          }}
        >
          {actions.map(({ key, Icon, label, run }) => (
            <button
              key={key}
              type="button"
              onClick={run}
              title={label}
              aria-label={label}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: 30,
                height: 30,
                borderRadius: 7,
                border: "none",
                background: "transparent",
                color: "#fff",
                cursor: "pointer"
              }}
            >
              <Icon size={15} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
