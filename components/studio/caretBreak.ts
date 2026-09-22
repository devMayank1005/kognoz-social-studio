"use client";

// Inserting a line break where the caret is.
//
// WHY THIS EXISTS AT ALL. The editable had no Enter handling, and nothing set
// `defaultParagraphSeparator`, so the browser chose. Chrome and Safari wrap each new line in
// a `<div>`; `<div>` is not in ALLOWED_TAGS (lib/slideElements.ts), so `sanitiseHtml` removed
// it on commit AND REJOINED THE TEXT WITH NO SEPARATOR. Three typed lines came back as one.
// Firefox inserts `<br>` and survived — the same keystrokes gave different content in
// different browsers, the loss happened on blur rather than as you typed, and nothing said so.
//
// `<br>` is the separator the whole pipeline already speaks: it is in ALLOWED_TAGS,
// lib/exportPipeline.ts XML-normalises it for the SVG, and `textOfHtml` maps it back to a
// newline. So choosing it here means the sanitiser, the store and the export need no change.
//
// Ranges rather than execCommand, matching components/studio/useTextRange.ts, which already
// does its span wrapping this way.

/** Is there anything after this node that would actually draw? */
function rendersAfter(node: Node): boolean {
  for (let n: Node | null = node.nextSibling; n; n = n.nextSibling) {
    if (n.nodeType === Node.TEXT_NODE) {
      if ((n.textContent ?? "") !== "") return true;
    } else {
      return true;
    }
  }
  return false;
}

/**
 * Put a `<br>` at the caret and leave the caret after it.
 *
 * Returns false when there is no usable selection, which the caller reads as "let the browser
 * do whatever it was going to do" rather than swallowing the keystroke.
 */
export function insertLineBreak(host: HTMLElement): boolean {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return false;

  const range = sel.getRangeAt(0);
  if (!host.contains(range.commonAncestorContainer)) return false;

  // Typing over a selection replaces it, the same as every other editor.
  range.deleteContents();

  const br = document.createElement("br");
  range.insertNode(br);

  // THE TRAILING BR. A `<br>` that is the last thing in the element renders no new line —
  // the browser needs something after it before the caret has anywhere to sit, so a break at
  // the very end looks like it did nothing at all. A second `<br>` gives the caret its line.
  //
  // "Last thing" is not `!br.nextSibling`, which is what this first checked and why the test
  // below caught it: inserting at the end of a text node SPLITS that node, so the `<br>` is
  // left with an empty text node after it rather than nothing. The question is whether
  // anything that renders follows, not whether any node does.
  if (!rendersAfter(br)) br.parentNode?.insertBefore(document.createElement("br"), br.nextSibling);

  const after = document.createRange();
  after.setStartAfter(br);
  after.collapse(true);
  sel.removeAllRanges();
  sel.addRange(after);
  return true;
}
