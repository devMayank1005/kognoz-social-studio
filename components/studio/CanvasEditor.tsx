"use client";

// Direct manipulation on top of the slide preview.
//
// This is EDITOR CHROME and it renders OUTSIDE the node lib/exportPipeline.ts clones, so
// nothing here can reach a downloaded PNG. That is the whole reason selection outlines,
// grips and toolbars live in this file rather than in components/slide/ElementLayer.tsx:
// there is no "do not export this" mechanism in the pipeline, only the boundary.
//
// Four things worth knowing before changing anything here:
//
//   base pixels     The slide lays out at 1080x1350 (or whatever the format says) and the
//                   preview is that box under a single CSS scale. Every number this file
//                   receives or stores is in SLIDE space; only the chrome is drawn in
//                   screen space, by multiplying through `previewScale`. Pointer deltas
//                   are divided by it on the way in.
//   one commit      A drag updates a local draft and re-renders only this component. The
//                   deck is written once, on pointer-up, and NOT AT ALL if the gesture
//                   changed nothing — every commit snapshots the deck for undo, so a plain
//                   click used to cost a press of Cmd+Z.
//   late detaching  Clicking template text selects it without changing the deck. It only
//                   becomes a real element — "ejected" — at the first actual edit: a drag
//                   past the threshold, a grip, or a double-click to type. Clicking around
//                   to look at things leaves the slide exactly as the template drew it.
//   pointer handover While text is being edited this overlay goes inert so the caret can
//                   receive clicks, and a capture-phase listener on the document handles
//                   "click elsewhere commits and selects the new target".

import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowUp, ArrowDown, RotateCcw, Trash2 } from "lucide-react";
import ElementLayer from "@/components/slide/ElementLayer";
import { slotAt, type SlotHit } from "@/lib/templateSlots";
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
  slotIdentity,
  resizeElement,
  rotateTo,
  sameBox,
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
/** How far the pointer must travel before a click becomes a drag, in screen pixels. */
const DRAG_THRESHOLD_SCREEN_PX = 3;
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

interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
  rot: number;
}

type Gesture =
  | { kind: "move"; id: string; bx: number; by: number; origin: SlideElement }
  | { kind: "resize"; id: string; handle: Handle; bx: number; by: number; origin: SlideElement }
  | { kind: "rotate"; id: string; origin: SlideElement; startDeg: number };

/** A press on template text that has not become an edit yet. */
interface PendingSlot {
  slot: SlotHit;
  bx: number;
  by: number;
}

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
  /** Called once per gesture, never per pointermove, and never for a gesture that did nothing. */
  onCommit: (next: SlideElement[]) => void;
  /** Tells the exported layer to stop drawing the element this file is drawing. */
  onDraggingChange: (id: string | null) => void;
  /** The element with a caret in it, if any. */
  editingId: string | null;
  onEditingChange: (id: string | null) => void;
  /**
   * A template slot to detach and open the moment this editor becomes active.
   *
   * It exists because the editor does not render at all while `active` is false, so a
   * double-click on the slide cannot reach it. Studio resolves the slot itself and arms the
   * mode; this is the handoff. Without it, on-slide editing is only reachable by somebody
   * who already knows the "Edit canvas" pill exists.
   */
  pendingEditSlot?: SlotHit | null;
  onPendingEditHandled?: () => void;
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
  onDraggingChange,
  editingId,
  onEditingChange,
  pendingEditSlot,
  onPendingEditHandled
}: CanvasEditorProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const gestureRef = useRef<Gesture | null>(null);
  const pendingRef = useRef<PendingSlot | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<SlotHit | null>(null);
  const [draft, setDraftState] = useState<SlideElement | null>(null);
  const [guides, setGuides] = useState<SnapGuide[]>([]);

  /**
   * The draft is mirrored in a ref because the commit has to read it OUTSIDE a state
   * updater. React runs updater functions during render, so committing from inside one
   * means calling Studio's setState mid-render.
   */
  const draftRef = useRef<SlideElement | null>(null);
  const setDraft = useCallback((next: SlideElement | null) => {
    draftRef.current = next;
    setDraftState(next);
  }, []);

  const s = previewScale;
  const selected = elements.find((e) => e.id === selectedId) ?? null;
  const shownEl = draft ?? selected;
  const shownBox: Box | null = shownEl
    ? { x: shownEl.x, y: shownEl.y, w: shownEl.w, h: shownEl.h, rot: shownEl.rot }
    : selectedSlot
      ? { x: selectedSlot.x, y: selectedSlot.y, w: selectedSlot.w, h: selectedSlot.h, rot: 0 }
      : null;

  /** Pointer position in slide coordinates. */
  const toBase = useCallback(
    (e: { clientX: number; clientY: number }) => {
      const r = rootRef.current?.getBoundingClientRect();
      if (!r) return { x: 0, y: 0 };
      return { x: (e.clientX - r.left) / s, y: (e.clientY - r.top) / s };
    },
    [s]
  );

  /** Turn a selected template slot into a real element. Returns it, already committed. */
  const ejectSlot = useCallback(
    (slot: SlotHit): SlideElement => {
      const made = createText(elements, {
        x: slot.x,
        y: slot.y,
        w: slot.w,
        h: slot.h,
        text: slot.text,
        html: slot.html,
        fontFamily: slot.fontFamily,
        fontSize: slot.fontSize,
        fontWeight: slot.fontWeight,
        color: slot.color,
        align: slot.align,
        lineHeight: slot.lineHeight,
        from: slot.slot,
        ...(slot.key ? { slotKey: slot.key } : {})
      });
      onCommit([...elements, made]);
      onSelect(made.id);
      setSelectedSlot(null);
      pendingRef.current = null;
      return made;
    },
    [elements, onCommit, onSelect]
  );

  const endGesture = useCallback(() => {
    const g = gestureRef.current;
    const d = draftRef.current;
    gestureRef.current = null;
    pendingRef.current = null;
    setGuides([]);
    onDraggingChange(null);
    setDraft(null);
    // A click arms a move gesture and ends it having moved nothing. Committing that would
    // write an identical element and leave an undo entry behind.
    if (g && d && !sameBox(g.origin, d)) onCommit(updateElement(elements, d.id, () => d));
  }, [elements, onCommit, onDraggingChange, setDraft]);

  // Window-level listeners so a fast drag that leaves the preview box still tracks, and
  // still finishes if the button is released outside it.
  useEffect(() => {
    if (!active) return;
    const move = (e: PointerEvent) => {
      const p = toBase(e);

      // A press on template text that has now travelled far enough to be a drag: detach it
      // and carry straight on into a normal move of the element it became.
      const pending = pendingRef.current;
      if (pending && !gestureRef.current) {
        const far = Math.hypot(p.x - pending.bx, p.y - pending.by) * s >= DRAG_THRESHOLD_SCREEN_PX;
        if (!far) return;
        const made = ejectSlot(pending.slot);
        gestureRef.current = { kind: "move", id: made.id, bx: pending.bx, by: pending.by, origin: made };
        onDraggingChange(made.id);
        setDraft(made);
      }

      const g = gestureRef.current;
      if (!g) return;

      if (g.kind === "move") {
        const moved = moveTo(g.origin, g.origin.x + (p.x - g.bx), g.origin.y + (p.y - g.by));
        const snapped = snapPosition({ ...moved, id: moved.id }, elements, baseW, baseH, SNAP_SCREEN_PX / s);
        setGuides(snapped.guides);
        setDraft(clampToCanvas({ ...moved, x: snapped.x, y: snapped.y }, baseW, baseH));
        return;
      }

      if (g.kind === "resize") {
        setDraft(resizeElement(g.origin, g.handle, p.x - g.bx, p.y - g.by, { lockAspect: e.shiftKey }));
        return;
      }

      const c = centerOf(g.origin);
      const deg = (Math.atan2(p.y - c.y, p.x - c.x) * 180) / Math.PI;
      setDraft(rotateTo(g.origin, g.origin.rot + (deg - g.startDeg), e.shiftKey ? ROTATE_SNAP_DEG : 0));
    };
    const up = () => {
      pendingRef.current = null;
      endGesture();
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
    };
  }, [active, baseH, baseW, ejectSlot, elements, endGesture, onDraggingChange, s, setDraft, toBase]);

  // Clicking away from a live caret commits the edit and selects whatever was clicked.
  // The overlay is inert while editing, so this has to come off the document, in the capture
  // phase, before anything else can swallow it.
  useEffect(() => {
    if (!active || !editingId) return;
    const onDown = (e: PointerEvent) => {
      const node = document.querySelector<HTMLElement>(`#preview-slide [data-el-id="${editingId}"]`);
      if (node && e.target instanceof Node && node.contains(e.target)) return;
      // Chrome that acts ON the caret is exempt. The styling bar sits outside the preview,
      // so without this every press of it would blur the editable and throw the selection
      // away before the control's own handler ran — and you cannot fix that from the
      // toolbar's side, because this listener is on the document in the CAPTURE phase and
      // preventDefault does not stop it.
      if (e.target instanceof Element && e.target.closest("[data-keep-caret]")) return;
      // Blur first: that is what fires the editable's onBlur and commits the words.
      node?.blur();
      onEditingChange(null);

      const root = rootRef.current?.getBoundingClientRect();
      if (!root) return;
      const inside =
        e.clientX >= root.left && e.clientX <= root.right && e.clientY >= root.top && e.clientY <= root.bottom;
      if (!inside) return;
      const p = { x: (e.clientX - root.left) / s, y: (e.clientY - root.top) / s };
      const hit = hitTest(elements, p.x, p.y);
      if (hit) {
        onSelect(hit.id);
        setSelectedSlot(null);
        return;
      }
      const expRoot = document.getElementById(exportRootId);
      const slot = expRoot ? slotAt(expRoot, p.x, p.y) : null;
      onSelect(null);
      setSelectedSlot(slot);
    };
    document.addEventListener("pointerdown", onDown, true);
    return () => document.removeEventListener("pointerdown", onDown, true);
  }, [active, editingId, elements, exportRootId, onEditingChange, onSelect, s]);

  // Keyboard, only while something is selected and nothing is being typed into. The guard on
  // editable targets mirrors the one Studio puts on Cmd+Z: a person typing in a field expects
  // the field's behaviour, and Escape while editing is handled by the editable itself.
  useEffect(() => {
    if (!active || !selectedId || editingId) return;
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
  }, [active, baseH, baseW, editingId, elements, onCommit, onSelect, selectedId]);

  // The handoff from Studio's double-click: detach the slot and open a caret in it, exactly
  // as onBackgroundDoubleClick does for a double-click that landed on the overlay.
  useEffect(() => {
    if (!active || !pendingEditSlot) return;
    const made = ejectSlot(pendingEditSlot);
    onEditingChange(made.id);
    onPendingEditHandled?.();
  }, [active, pendingEditSlot, ejectSlot, onEditingChange, onPendingEditHandled]);

  if (!active) return null;

  function onBackgroundDown(e: React.PointerEvent) {
    const p = toBase(e);
    const hit = hitTest(elements, p.x, p.y);

    if (hit) {
      setSelectedSlot(null);
      onSelect(hit.id);
      gestureRef.current = { kind: "move", id: hit.id, bx: p.x, by: p.y, origin: hit };
      onDraggingChange(hit.id);
      setDraft(hit);
      return;
    }

    // Nothing of ours under the pointer: this may be template content. Select it and show
    // its handles, but change NOTHING until the person actually edits it.
    const root = document.getElementById(exportRootId);
    const slot = root ? slotAt(root, p.x, p.y) : null;
    onSelect(null);
    setSelectedSlot(slot);
    pendingRef.current = slot ? { slot, bx: p.x, by: p.y } : null;
  }

  function onBackgroundDoubleClick(e: React.MouseEvent) {
    const p = toBase(e);
    const hit = hitTest(elements, p.x, p.y);
    if (hit) {
      if (hit.kind !== "text") return;
      onSelect(hit.id);
      onEditingChange(hit.id);
      return;
    }
    // Double-clicking template text is unambiguously an edit, so detach it now and open it.
    const pending = pendingRef.current?.slot ?? selectedSlot;
    if (!pending) return;
    gestureRef.current = null;
    setDraft(null);
    onDraggingChange(null);
    const made = ejectSlot(pending);
    onEditingChange(made.id);
  }

  /** A grip is unambiguously an edit too, so a pending slot detaches on contact. */
  function elementForGesture(): SlideElement | null {
    if (shownEl) return shownEl;
    const pending = selectedSlot;
    if (!pending) return null;
    return ejectSlot(pending);
  }

  function startResize(e: React.PointerEvent, handle: Handle) {
    e.stopPropagation();
    const target = elementForGesture();
    if (!target) return;
    const p = toBase(e);
    gestureRef.current = { kind: "resize", id: target.id, handle, bx: p.x, by: p.y, origin: target };
    onDraggingChange(target.id);
    setDraft(target);
  }

  function startRotate(e: React.PointerEvent) {
    e.stopPropagation();
    const target = elementForGesture();
    if (!target) return;
    const p = toBase(e);
    const c = centerOf(target);
    gestureRef.current = {
      kind: "rotate",
      id: target.id,
      origin: target,
      startDeg: (Math.atan2(p.y - c.y, p.x - c.x) * 180) / Math.PI
    };
    onDraggingChange(target.id);
    setDraft(target);
  }

  const bounds = shownBox ? boundsOf({ ...shownBox, id: "", z: 0 }) : null;
  const canReset = shownEl?.kind === "text" && !!shownEl.from;

  const actions = shownEl
    ? [
        { key: "fwd", Icon: ArrowUp, label: "Bring forward", run: () => onCommit(bringForward(elements, shownEl.id)) },
        { key: "back", Icon: ArrowDown, label: "Send backward", run: () => onCommit(sendBackward(elements, shownEl.id)) },
        // Only an unlocked template element has a template to go back to.
        ...(canReset && shownEl.kind === "text" && shownEl.from
          ? [
              {
                key: "reset",
                Icon: RotateCcw,
                label: "Reset to template",
                run: () => {
                  onCommit(resetSlot(elements, slotIdentity(shownEl.from!, shownEl.slotKey)));
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
            onCommit(removeElement(elements, shownEl.id));
            onSelect(null);
          }
        }
      ]
    : [];

  return (
    <div
      ref={rootRef}
      onPointerDown={onBackgroundDown}
      onDoubleClick={onBackgroundDoubleClick}
      style={{
        position: "absolute",
        left: 0,
        top: 0,
        width: baseW * s,
        height: baseH * s,
        cursor: "default",
        // Inert while text is being edited, so clicks reach the caret beneath.
        pointerEvents: editingId ? "none" : "auto",
        touchAction: "none",
        zIndex: 6
      }}
    >
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

      {shownBox && !editingId && (
        <div
          style={{
            position: "absolute",
            left: shownBox.x * s,
            top: shownBox.y * s,
            width: shownBox.w * s,
            height: shownBox.h * s,
            transform: shownBox.rot ? `rotate(${shownBox.rot}deg)` : undefined,
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
      {shownEl && bounds && !draft && !editingId && (
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
