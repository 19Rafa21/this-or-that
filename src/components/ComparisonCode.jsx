import { useEffect, useMemo, useRef } from 'react';
import { compareAlignedCode } from '../game/codeDiff.js';
export default function ComparisonCode({ code, otherCode }) {
  const element = useRef(null);
  const rows = useMemo(() => {
    const first = code <= otherCode;
    const diff = compareAlignedCode(first ? code : otherCode, first ? otherCode : code);
    return diff.map(row => ({ parts: first ? row.left : row.right, changed: row.changed }));
  }, [code, otherCode]);
  useEffect(() => {
    const container = element.current;
    const mark = container?.querySelector('[data-comparison-focus]');
    if (!container) return;
    container.scrollTop = 0;
    container.scrollLeft = 0;
    if (mark) {
      const box = container.getBoundingClientRect(), target = mark.getBoundingClientRect();
      if (target.bottom > box.bottom) container.scrollTop = target.top - box.top - container.clientHeight / 3;
      const token = container.querySelector('mark')?.getBoundingClientRect();
      if (token && token.right > box.right) container.scrollLeft = Math.max(0, token.left - box.left - 40);
    }
  }, [code, otherCode]);
  return <pre ref={element} className="comparison-code comparison-code-diff"><code>{rows.map((row, index) => <span key={index} className={`comparison-line${row.parts === null ? ' comparison-spacer' : ''}`} aria-hidden={row.parts === null ? true : undefined} data-comparison-focus={row.changed ? '' : undefined}>{row.parts?.map((part, token) => part.changed ? <mark key={token} className="code-change">{part.text}</mark> : part.text)}</span>)}</code></pre>;
}
