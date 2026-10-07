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
