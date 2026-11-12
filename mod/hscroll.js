// One open file's sideways scrolling: a bar of its own, wheel and drag. A view helper:
// state (offsets, drag, wrap) lives on the GitDiff view it is handed. `width` is the column the
// file is in (the list or the tree), which its bar is sized from.
import { div } from "gpui-kit";
import { v_flex } from "gpui-base";
import { LINE_H, HUNK_H } from "./metrics.js";

// The hatching's layer in wrap, in px at 12px: taller than a wrapped diff, clipped by the box.
const WRAP_HATCH_H = 100000;

// An open file: its rows shift sideways under a clip of their own, driven by the wheel,
// a click on the bar or a drag of it. No nested scroll area: a second one on top of the
// vertical list made a plain wheel move both and the panel drift diagonally.
// Side by side (g.split): each half of a row is a clip of its own, and both take this one offset,
// so the two sides scroll together; the visible width is then half the column.
export function hscroll(view, g, t, width) {
  const vw = (width || 320) / (g.split ? 2 : 1);
  const maxOff = view.wrap ? 0 : Math.max(0, g.width - vw);
  const off = Math.min(Math.max(view.offsets[g.id] ?? 0, 0), maxOff);
  const wide = maxOff > 0;
  const move = (to, cx) => { view.offsets[g.id] = Math.min(Math.max(to, 0), maxOff); cx.notify(); };
  // Side by side: the hatching of the empty sides is one layer under the rows, so it runs on from one
  // row to the next. Without wrap the layer is the diff's height (its rows' fixed heights: LINE_H a
  // pair, HUNK_H a header; they were 20 and 22 px before the rows grew, which cut the hatching short). With wrap the rows' heights are not known here, so the layer is taller than any
  // diff and this box clips it.
  // shortcut: a wrapped diff longer than WRAP_HATCH_H px loses its hatching below that.
  let height = 0;
  for (const r of g.body) height += view.px(r.kind === "pair" ? LINE_H : HUNK_H);
  const kids = g.body.map((row, i) => g.split
    ? view.splitRow(row, g, t, wide ? off : 0)
    : view.codeRow(row, g.file.path, t, wide ? g.width : 0, i, g.id));
  if (g.split) kids.unshift(view.hatch(t, view.wrap ? view.px(WRAP_HATCH_H) : height));
  const rows = v_flex().w_full().relative().when(!g.split && off > 0, (e) => e.ml(-off)).children(kids);
  const box = div().w_full().overflow_hidden().child(rows)
    .when(wide, (e) => e.on_scroll_wheel((event, cx) => {
      // A sideways wheel, or a vertical one with shift; a plain vertical wheel is the list's.
      const dx = Math.abs(event.delta.x) > 0 ? event.delta.x : (event.modifiers.shift ? event.delta.y : 0);
      if (!dx) return;
      cx.stop_propagation();
      move(off + dx, cx);
    }));
  // The bar takes its length from the box (percentages), so it follows the panel's size;
  // only the thumb's share needs the numbers.
  const share = wide ? Math.max(0.04, Math.min(1, vw / g.width)) : 1;
  const thumbAt = maxOff ? off / maxOff : 0;
  let bar = div().h(10).w_full().relative()
    .child(div().absolute().left(8).right(8).top(2).h(6).rounded(3).bg(t.chrome)
      .child(div().absolute().left(`${(thumbAt * (1 - share) * 100).toFixed(2)}%`).w(`${(share * 100).toFixed(2)}%`).h_full().rounded(3).bg(t.muted)));
  if (wide) {
    bar = bar.on_mouse_down("left", (event, cx) => {
      const b = event.bounds;
      if (!b) return;
      // Press anywhere: the thumb jumps under the pointer, then follows it.
      const trackW = Math.max(b.width - 16, 1);
      const frac = Math.min(Math.max((event.position.x - b.x - 8) / trackW, 0), 1);
      const to = frac * maxOff;
      view.drag = { id: g.id, startX: event.position.x, startOff: to, trackW };
      move(to, cx);
      cx.stop_propagation();
    })
      .on_mouse_move((event, cx) => {
        if (view.drag?.id !== g.id) return;
        move(view.drag.startOff + ((event.position.x - view.drag.startX) * maxOff) / view.drag.trackW, cx);
      })
      .on_mouse_up("left", (_event, cx) => { view.drag = null; cx.notify(); });
  }
  return div().w_full()
    .child(box)
    .when(wide, (e) => e.child(bar));
}
