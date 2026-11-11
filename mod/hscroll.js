// One open file's sideways scrolling: a bar of its own, wheel and drag. A view helper:
// state (offsets, drag, viewport, wrap) lives on the GitDiff view it is handed.
import { div } from "gpui-kit";
import { v_flex } from "gpui-base";

// An open file: its rows shift sideways under a clip of their own, driven by the wheel,
// a click on the bar or a drag of it. No nested scroll area: a second one on top of the
// vertical list made a plain wheel move both and the panel drift diagonally.
export function hscroll(view, g, t) {
  const vw = view.viewport || 320;
  const maxOff = view.wrap ? 0 : Math.max(0, g.width - vw);
  const off = Math.min(Math.max(view.offsets[g.id] ?? 0, 0), maxOff);
  const wide = maxOff > 0;
  const move = (to, cx) => { view.offsets[g.id] = Math.min(Math.max(to, 0), maxOff); cx.notify(); };
  const rows = v_flex().w_full().when(off > 0, (e) => e.ml(-off))
    .children(g.body.map((row, i) => view.codeRow(row, g.file.path, t, wide ? g.width : 0, i)));
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
