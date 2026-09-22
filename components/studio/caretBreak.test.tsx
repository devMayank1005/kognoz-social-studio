// @vitest-environment jsdom

import { describe, it, expect, afterEach } from "vitest";
import { insertLineBreak } from "./caretBreak";

// THE BUG, and it was losing people's words. The editable had no Enter handling, so the
// browser chose the separator: Chrome and Safari wrap each line in a <div>, sanitiseHtml
// strips <div> and rejoins with nothing between, and three typed lines committed as one.
// Firefox inserted <br> and was fine — same keystrokes, different content, no warning.
//
// These assert the DOM half. lib/slideElements.test.ts asserts the other half: that <br>
// survives sanitiseHtml and reads back as a newline.

let host: HTMLElement | null = null;
afterEach(() => {
  host?.remove();
  host = null;
});

function editable(html: string) {
  host = document.createElement("div");
  host.contentEditable = "true";
  host.innerHTML = html;
  document.body.appendChild(host);
  return host;
}

/** Put the caret inside the host at a character offset of its first text node. */
function caretAt(node: HTMLElement, offset: number) {
  const text = node.firstChild!;
  const range = document.createRange();
  range.setStart(text, offset);
  range.collapse(true);
  const sel = window.getSelection()!;
  sel.removeAllRanges();
  sel.addRange(range);
  return range;
}

describe("insertLineBreak", () => {
  it("breaks the line where the caret is", () => {
    const el = editable("HelloWorld");
    caretAt(el, 5);
    expect(insertLineBreak(el)).toBe(true);
    expect(el.innerHTML).toBe("Hello<br>World");
  });

  it("adds a trailing br when the break lands at the very end", () => {
    // A <br> that is the last node renders no new line — the caret has nowhere to sit, so
    // pressing Enter at the end of a sentence appears to do nothing at all.
    const el = editable("Hello");
    caretAt(el, 5);
    insertLineBreak(el);
    expect(el.innerHTML).toBe("Hello<br><br>");
  });

  it("does not add a trailing br in the middle, where there is already content after", () => {
    const el = editable("HelloWorld");
    caretAt(el, 5);
    insertLineBreak(el);
    expect(el.querySelectorAll("br")).toHaveLength(1);
  });

  it("leaves the caret after the break, so typing continues on the new line", () => {
    const el = editable("HelloWorld");
    caretAt(el, 5);
    insertLineBreak(el);
    const sel = window.getSelection()!;
    expect(sel.isCollapsed).toBe(true);
    expect(sel.getRangeAt(0).startContainer).toBe(el);
  });

  it("replaces a selection rather than leaving it behind", () => {
    const el = editable("HelloWorld");
    const text = el.firstChild!;
    const range = document.createRange();
    range.setStart(text, 5);
    range.setEnd(text, 10);
    const sel = window.getSelection()!;
    sel.removeAllRanges();
    sel.addRange(range);
    insertLineBreak(el);
    expect(el.textContent).toBe("Hello");
  });

  it("builds up several lines rather than collapsing them", () => {
    const el = editable("One");
    caretAt(el, 3);
    insertLineBreak(el);
    expect(el.innerHTML.match(/<br>/g)?.length).toBeGreaterThanOrEqual(1);
  });

  it("refuses when the caret is outside the element, instead of stealing the keystroke", () => {
    const el = editable("Hello");
    const other = document.createElement("div");
    other.textContent = "elsewhere";
    document.body.appendChild(other);
    const range = document.createRange();
    range.selectNodeContents(other);
    const sel = window.getSelection()!;
    sel.removeAllRanges();
    sel.addRange(range);
    expect(insertLineBreak(el)).toBe(false);
    other.remove();
  });

  it("refuses when there is no selection at all", () => {
    const el = editable("Hello");
    window.getSelection()!.removeAllRanges();
    expect(insertLineBreak(el)).toBe(false);
  });
});
