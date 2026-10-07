export const LEGACY_CATEGORY_ORDER = ['variables', 'loops', 'conditionals'];
export const EXTENDED_CATEGORY_ORDER = ['variables', 'blocks', 'loops', 'conditionals', 'assignments', 'logical', 'functions'];
export function getCategoryOrder(comparisons) {
  if (comparisons.length && comparisons.every(c => Number.isInteger(c.display_order))) {
    return [...new Map([...comparisons].sort((a, b) => a.display_order - b.display_order).map(c => [c.category, c.category])).values()];
  }
  return comparisons.some((c) => c.category === 'blocks') ? EXTENDED_CATEGORY_ORDER : LEGACY_CATEGORY_ORDER;
}
