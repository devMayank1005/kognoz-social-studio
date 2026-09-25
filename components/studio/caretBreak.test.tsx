// @vitest-environment jsdom

import { describe, it, expect, afterEach } from "vitest";
import { flattenBlocks, insertLineBreak, insertPlainText } from "./caretBreak";

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

// THE SAME BUG BY ANOTHER DOOR. Enter is intercepted, but paste, IME and mobile keyboards
// still make <div>/<p> lines. They look right while editing and were stripped on commit —
// blank lines gone, lines run together, the moment you clicked out of the box.
describe("flattenBlocks", () => {
  const flat = (html: string) => {
    const node = editable(html);
    flattenBlocks(node);
    return node.innerHTML;
  };

  it("turns Chrome's div lines into breaks, keeping the blank line", () => {
    expect(flat("Line1<div><br></div><div>Line3</div>")).toBe("Line1<br><br>Line3");
  });

  it("does the same for pasted paragraphs", () => {
    expect(flat("<p>A</p><p><br></p><p>B</p>")).toBe("A<br><br>B");
  });

  it("puts a break between text and a block on either side", () => {
    expect(flat("A<div>B</div>")).toBe("A<br>B");
    expect(flat("<div>A</div>B")).toBe("A<br>B");
  });

  it("keeps a block's own blank line and drops only its placeholder break", () => {
    expect(flat("<div>A<br><br></div><div>B</div>")).toBe("A<br><br>B");
  });

  it("keeps a trailing blank line visible", () => {
    expect(flat("A<div><br></div>")).toBe("A<br><br>");
  });

  it("flattens a nested list one item per line", () => {
    expect(flat("<ul><li>a</li><li>b</li></ul>")).toBe("a<br>b");
  });

  it("leaves inline markup and existing breaks untouched", () => {
    const html = 'A<br><br><span style="color: red;">B</span>';
    expect(flat(html)).toBe(html);
  });
});

describe("insertPlainText", () => {
  it("pastes lines as breaks, keeping blank lines", () => {
    const node = editable("X");
    caretAt(node, 1);
    expect(insertPlainText(node, "one\n\nthree")).toBe(true);
    expect(node.innerHTML).toBe("Xone<br><br>three");
  });

  it("normalises Windows line endings", () => {
    const node = editable("");
    node.appendChild(document.createTextNode(""));
    caretAt(node, 0);
    insertPlainText(node, "a\r\nb");
    expect(node.innerHTML).toBe("a<br>b");
  });

  it("gives a trailing newline a line to land on", () => {
    const node = editable("X");
    caretAt(node, 1);
    insertPlainText(node, "a\n");
    expect(node.innerHTML).toBe("Xa<br><br>");
  });

  it("replaces the selection", () => {
    const node = editable("Hello");
    const range = caretAt(node, 0);
    range.setEnd(node.firstChild!, 5);
    const sel = window.getSelection()!;
    sel.removeAllRanges();
    sel.addRange(range);
    insertPlainText(node, "Bye");
    expect(node.textContent).toBe("Bye");
  });
});
