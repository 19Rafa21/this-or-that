const indexes = new WeakMap();
export function comparisonIndex(comparisons) {
  if (indexes.has(comparisons)) return indexes.get(comparisons);
  const byCategory = new Map();
  const byId = new Map();
  let cumulative = false;
  for (const pair of comparisons) {
    byId.set(pair.id, pair);
    const context = pair.snippet_a.inherited_styles || {};
    const keys = Object.keys(context).sort();
    if (pair.progressive || (pair.category === 'functions' && keys.length === 6)) cumulative = true;
    let groups = byCategory.get(pair.category);
    if (!groups) { groups = new Map(); byCategory.set(pair.category, groups); }
    const keySet = JSON.stringify(keys);
    let group = groups.get(keySet);
    if (!group) { group = { keys, contexts: new Map() }; groups.set(keySet, group); }
    const key = JSON.stringify(keys.map(k => context[k]));
    const pairs = group.contexts.get(key) || [];
    pairs.push(pair); group.contexts.set(key, pairs);
  }
  const index = { byId, byCategory, cumulative };
  indexes.set(comparisons, index);
  return index;
}
export function contextComparisons(comparisons, category, styles = {}) {
  const groups = comparisonIndex(comparisons).byCategory.get(category);
  if (!groups) return [];
  return [...groups.values()].flatMap(({ keys, contexts }) => contexts.get(JSON.stringify(keys.map(k => styles[k]))) || []);
}
export function isCumulativeStudy(comparisons) { return comparisonIndex(comparisons).cumulative; }
