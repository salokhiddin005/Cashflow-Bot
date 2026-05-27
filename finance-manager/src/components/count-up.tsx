"use client";

import { useEffect, useRef, useState } from "react";
import { formatMoney } from "@/lib/format";

// Tiny count-up animator. Animates from `from` → `to` over ~700ms with an
// ease-out curve. Renders the *final* value on first paint (server-rendered)
// so SSR shows the right number; the animation is a paint-once polish.
//
// Designed for KPI numbers where users care about the value, not the show.
export function CountUp({
  to,
  from = 0,
  duration = 700,
  format = formatMoney,
  prefix = "",
  className,
}: {
  to: number;
  from?: number;
  duration?: number;
  format?: (n: number) => string;
  prefix?: string;
  className?: string;
}) {
  const [value, setValue] = useState(to);
  const lastTo = useRef(to);

  useEffect(() => {
    // Animate on mount and whenever `to` changes (e.g. after period switch).
    const start = performance.now();
    const startVal = lastTo.current === to ? from : lastTo.current;
    const delta = to - startVal;
    let raf = 0;
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3); // ease-out cubic
      setValue(Math.round(startVal + delta * eased));
      if (p < 1) raf = requestAnimationFrame(tick);
      else lastTo.current = to;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [to]);

  return <span className={className}>{prefix}{format(value)}</span>;
}
