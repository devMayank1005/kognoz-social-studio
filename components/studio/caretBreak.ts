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

/** Is there anything before this node that would actually draw? Mirror of rendersAfter. */
function rendersBefore(node: Node): boolean {
  for (let n: Node | null = node.previousSibling; n; n = n.previousSibling) {
    if (n.nodeType === Node.TEXT_NODE) {
      if ((n.textContent ?? "") !== "") return true;
    } else {
      return true;
    }
  }
  return false;
}

const isBr = (n: Node | null): boolean => n?.nodeName === "BR";

const BLOCK_SELECTOR = "div, p, li, h1, h2, h3, h4, h5, h6, blockquote, pre, ul, ol";

/**
 * Turn every block element under `host` into `<br>`-separated inline content, in place.
 *
 * WHY. Enter is intercepted (insertLineBreak above), but it is not the only way a browser
 * makes a line. Pasting multi-line text, IME/autocorrect paragraph inserts and mobile
 * keyboards all still produce `<div>`/`<p>` blocks — one per line, `<div><br></div>` for a
 * blank one. They LOOK right while editing, then `sanitiseHtml` strips them on commit and
 * rejoins the text with nothing between it: blank lines vanish and lines run together the
 * moment you click out of the box. Doing this on the live DOM before reading `innerHTML` is
 * what makes the commit keep what the person saw, whatever produced the markup.
 *
 * The rules follow the browser's own line semantics (innerText):
 *   - a block starts a new line if anything renders before it;
 *   - a trailing `<br>` inside a block is a placeholder, not a line;
 *   - an empty block (`<div><br></div>`) is one empty line;
 *   - anything that renders after a block starts on a new line.
 */
export function flattenBlocks(host: HTMLElement): void {
  // Document order. Each block decides "is there already a break before me?" by looking at
  // what the PREVIOUS block left behind, so earlier blocks must be flattened first. A nested
  // block is still in the tree after its ancestor dissolves, so the static list stays valid.
  const blocks = Array.from(host.querySelectorAll(BLOCK_SELECTOR));
  for (const block of blocks) {
    const parent = block.parentNode;
    if (!parent) continue;

    // The placeholder <br> the browser leaves at the end of a block renders no line of its
    // own. Only ONE is a placeholder: `A<br><br>` is A plus an empty line.
    const last = block.lastChild;
    if (last && isBr(last) && rendersBefore(last)) block.removeChild(last);
    // `<div><br></div>`: the <br> IS the line, and it is an empty one.
    const empty = !block.hasChildNodes() || (block.childNodes.length === 1 && isBr(block.firstChild));
    if (empty) block.textContent = "";

    const frag = document.createDocumentFragment();
    if (rendersBefore(block) && !isBr(lastRendered(block.previousSibling))) {
      frag.appendChild(document.createElement("br"));
    }
    while (block.firstChild) frag.appendChild(block.firstChild);
    if (rendersAfter(block)) {
      frag.appendChild(document.createElement("br"));
    } else if (frag.lastChild && (empty || isBr(frag.lastChild))) {
      // Last thing in the element and ending on a break: that break needs a second one to
      // give its line somewhere to exist — the same trailing rule as insertLineBreak.
      frag.appendChild(document.createElement("br"));
    }
    parent.replaceChild(frag, block);
  }
}

/** The nearest preceding sibling that is not an empty text node. */
function lastRendered(node: Node | null): Node | null {
  for (let n = node; n; n = n.previousSibling) {
    if (n.nodeType === Node.TEXT_NODE && (n.textContent ?? "") === "") continue;
    return n;
  }
  return null;
}

/**
 * Paste as plain text, newlines as `<br>`.
 *
 * Left to itself the browser pastes the clipboard's HTML — `<p>`, `<div>`, foreign styles,
 * whatever the source app wrote. flattenBlocks would rescue the lines on commit, but the
 * pasted fonts and colours would still fight the element's own. Plain text is what every
 * design tool does on a paste into a text box.
 */
export function insertPlainText(host: HTMLElement, text: string): boolean {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return false;
  const range = sel.getRangeAt(0);
  if (!host.contains(range.commonAncestorContainer)) return false;

  range.deleteContents();
  const frag = document.createDocumentFragment();
  const lines = text.replace(/\r\n?/g, "\n").split("\n");
  lines.forEach((line, i) => {
    if (i > 0) frag.appendChild(document.createElement("br"));
    if (line) frag.appendChild(document.createTextNode(line));
  });
  const last = frag.lastChild;
  if (!last) return true;
  range.insertNode(frag);

  // Same trailing-break rule as insertLineBreak: a final <br> needs something after it.
  if (isBr(last) && !rendersAfter(last)) last.parentNode?.insertBefore(document.createElement("br"), last.nextSibling);

  const after = document.createRange();
  after.setStartAfter(last);
  after.collapse(true);
  sel.removeAllRanges();
  sel.addRange(after);
  return true;
}
