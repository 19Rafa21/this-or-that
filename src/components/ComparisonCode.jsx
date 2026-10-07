import { useEffect, useMemo, useRef } from 'react';
import { compareCode } from '../game/codeDiff.js';
export default function ComparisonCode({ code, otherCode }) {
  const element = useRef(null);
  const parts = useMemo(() => {
    const first = code <= otherCode;
    const diff = compareCode(first ? code : otherCode, first ? otherCode : code);
    return first ? diff.left : diff.right;
  }, [code, otherCode]);
  useEffect(() => {
    const container = element.current;
    const mark = container?.querySelector('mark');
    if (!container) return;
    container.scrollTop = 0;
    container.scrollLeft = 0;
    if (mark) {
      const box = container.getBoundingClientRect(), target = mark.getBoundingClientRect();
      if (target.bottom > box.bottom) container.scrollTop = target.top - box.top - container.clientHeight / 3;
      if (target.right > box.right) container.scrollLeft = Math.max(0, target.left - box.left - 40);
    }
  }, [code, otherCode]);
  return <pre ref={element} className="comparison-code comparison-code-diff"><code>{parts.map((part, index) => part.changed ? <mark key={index} className="code-change">{part.text}</mark> : part.text)}</code></pre>;
}
