export const LEGACY_CATEGORY_ORDER = ['variables', 'loops', 'conditionals'];
export const EXTENDED_CATEGORY_ORDER = ['variables', 'blocks', 'loops', 'conditionals', 'assignments', 'logical', 'functions'];
export function getCategoryOrder(comparisons) {
  return comparisons.some((c) => c.category === 'blocks') ? EXTENDED_CATEGORY_ORDER : LEGACY_CATEGORY_ORDER;
}
