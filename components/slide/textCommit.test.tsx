// @vitest-environment jsdom

import { describe, it, expect, vi, afterEach } from "vitest";
import { render, fireEvent, cleanup } from "@testing-library/react";
import ElementLayer, { type EditCommit } from "./ElementLayer";
import { createText } from "@/lib/slideElements";

// THE BUG. Type lines with a blank one between, click out of the blue box, and the blank
// line was gone. Enter was already safe; the browser still made <div>/<p> lines by every
// other route (paste, IME, mobile), and the commit stripped them with no separator.
// These drive the real TextView: fill the editable the way the browser does, blur it, and
// read what gets stored.

afterEach(cleanup);

function mount() {
  const el = createText([], { id: "el_1", text: "", x: 0, y: 0, w: 300, h: 100 });
  const onEditCommit = vi.fn<(c: EditCommit) => void>();
  const { container } = render(
    <ElementLayer elements={[el]} baseW={1080} baseH={1350} editingId="el_1" onEditCommit={onEditCommit} />
  );
  const node = container.querySelector<HTMLElement>('[data-el-id="el_1"]')!;
  return { node, onEditCommit };
}

describe("committing an inline edit keeps its lines", () => {
  it("keeps a blank line the browser spelled as <div><br></div>", () => {
    const { node, onEditCommit } = mount();
    node.innerHTML = "Line1<div><br></div><div>Line3</div>";
    fireEvent.blur(node);
    const c = onEditCommit.mock.calls[0][0];
    expect(c.html).toBe("Line1<br/><br/>Line3");
    expect(c.text).toBe("Line1\n\nLine3");
  });

  it("keeps blank lines typed with Enter", () => {
    const { node, onEditCommit } = mount();
    node.innerHTML = "Line1<br><br>Line3<br>";
    fireEvent.blur(node);
    expect(onEditCommit.mock.calls[0][0].text).toBe("Line1\n\nLine3");
  });

  it("keeps spaces, including a styled run of nothing but spaces", () => {
    const { node, onEditCommit } = mount();
    node.innerHTML = 'A   B<span style="color: red;">   </span>C';
    fireEvent.blur(node);
    expect(onEditCommit.mock.calls[0][0].html).toBe('A   B<span style="color: red;">   </span>C');
  });

  it("pastes multi-line text as lines, blank line included", () => {
    const { node, onEditCommit } = mount();
    node.textContent = "";
    node.appendChild(document.createTextNode(""));
    const range = document.createRange();
    range.setStart(node.firstChild!, 0);
    range.collapse(true);
    window.getSelection()!.removeAllRanges();
    window.getSelection()!.addRange(range);
    fireEvent.paste(node, { clipboardData: { getData: () => "one\n\nthree" } });
    fireEvent.blur(node);
    expect(onEditCommit.mock.calls[0][0].text).toBe("one\n\nthree");
  });
});
