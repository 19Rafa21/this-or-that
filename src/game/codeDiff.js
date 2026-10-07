// Token LCS keeps shared code readable and marks only inserted/removed syntax.
// Whitespace is preserved exactly but never highlighted by itself.
export function compareCode(left, right) {
  const tokenize = code => code.match(/\w+|\s+|[^\w\s]/gu) || [];
  const a = tokenize(left), b = tokenize(right);
  const lengths = Array.from({ length: a.length + 1 }, () => new Uint16Array(b.length + 1));
  for (let i = a.length - 1; i >= 0; i--) for (let j = b.length - 1; j >= 0; j--) {
    lengths[i][j] = a[i] === b[j] ? lengths[i + 1][j + 1] + 1 : Math.max(lengths[i + 1][j], lengths[i][j + 1]);
  }
  const sameA = new Set(), sameB = new Set();
  let i = 0, j = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) { sameA.add(i++); sameB.add(j++); }
    else if (lengths[i + 1][j] >= lengths[i][j + 1]) i++;
    else j++;
  }
  const parts = (tokens, same) => tokens.map((text, index) => ({ text, changed: !same.has(index) && /\S/u.test(text) }));
  return { left: parts(a, sameA), right: parts(b, sameB) };
}

// Empty visual rows align matching source lines; they never enter saved code.
export function compareAlignedCode(left, right) {
  const diff = compareCode(left, right);
  const split = parts => {
    const lines = [[]];
    for (const part of parts) part.text.split('\n').forEach((text, index) => {
      if (index) lines.push([]);
      if (text) lines.at(-1).push({ ...part, text });
    });
    return lines;
  };
  const a = split(diff.left), b = split(diff.right);
  const key = line => line.map(part => part.text).join('').trim();
  const same = (i, j) => key(a[i]) !== '' && key(a[i]) === key(b[j]);
  const lengths = Array.from({ length: a.length + 1 }, () => new Uint16Array(b.length + 1));
  for (let i = a.length - 1; i >= 0; i--) for (let j = b.length - 1; j >= 0; j--) {
    lengths[i][j] = same(i, j) ? lengths[i + 1][j + 1] + 1 : Math.max(lengths[i + 1][j], lengths[i][j + 1]);
  }
  const anchors = [];
  let i = 0, j = 0;
  while (i < a.length && j < b.length) {
    if (same(i, j)) { anchors.push([i++, j++]); }
    else if (lengths[i + 1][j] >= lengths[i][j + 1]) i++;
    else j++;
  }
  anchors.push([a.length, b.length]);
  const rows = [];
  let ai = 0, bi = 0;
  for (const [endA, endB] of anchors) {
    while (ai < endA || bi < endB) rows.push({ left: ai < endA ? a[ai++] : null, right: bi < endB ? b[bi++] : null });
    if (endA < a.length) { rows.push({ left: a[ai++], right: b[bi++] }); }
  }
  return rows.map(row => ({ ...row, changed: [row.left, row.right].some(line => line?.some(part => part.changed)) }));
}
