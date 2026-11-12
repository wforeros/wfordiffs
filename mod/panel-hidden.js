// Whether a mod's block in the shown layout is out of sight: inside a node marked `hidden` (a closed side
// panel) or a stack child that is not the stack's active one (another mod picked with the panel's buttons).
// Pure: the layout comes in as a value (herdr's layout()).

/**
 * @param {unknown} root the shown layout (herdr's layout())
 * @param {string} mod the mod's name, as in a block's `content.mod`
 * @returns {boolean} true only when a block of that mod exists and is out of sight; false when it is shown
 *   or the layout has no such block (a copy opened by overlay), so the caller leaves things alone
 */
export function isModHidden(root, mod) {
  const walk = (node, hidden) => {
    if (!node || typeof node !== "object") return null;
    const out = hidden || node.hidden === true;
    if (node.type === "block" && node.content?.mod === mod) return out;
    for (const child of node.children ?? []) {
      const off = out || (node.type === "stack" && node.active !== undefined && node.active !== child.id);
      const found = walk(child, off);
      if (found !== null) return found;
    }
    return null;
  };
  return walk(root, false) === true;
}
