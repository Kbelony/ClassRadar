import { useEffect, useRef, useState } from "react";
import type { GradeCounts } from "../types";

/** Apple-style light palette (M3 Vitals colors tuned for light backgrounds). */
export const GRADE_COLORS: [keyof GradeCounts, string, string][] = [
  ["a", "A", "#28B84C"],
  ["b", "B", "#0A84FF"],
  ["c", "C", "#E0A800"],
  ["d", "D", "#FF9500"],
  ["f", "F", "#FF3B30"],
  ["w", "W", "#8E8E93"],
];

const EXCLUDED: [keyof GradeCounts, string][] = [
  ["p", "P"], ["np", "NP"], ["ew", "EW"], ["ix", "IX"], ["rd", "RD"], ["ip", "IP"], ["sp", "SP"],
];

export function countOf(g: GradeCounts, k: keyof GradeCounts): number {
  return g[k] ?? 0;
}

export function excludedLine(g: GradeCounts): string {
  const parts = EXCLUDED.filter(([k]) => countOf(g, k) > 0).map(([k, l]) => `${countOf(g, k)} ${l}`);
  return parts.length ? `Not shown: ${parts.join(", ")}` : "";
}

/** Animated count-up number; lands on the exact value, never loops. */
export function CountUp({ target, duration = 1000 }: { target: number; duration?: number }) {
  const [v, setV] = useState(0);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setV(target);
      return;
    }
    let raf = 0;
    const t0 = performance.now();
    const step = (t: number) => {
      const p = Math.min(1, (t - t0) / duration);
      setV(Math.round(target * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);
  return <>{v.toLocaleString()}</>;
}

/** Animated per-grade bar rows. Shares are of the printed total n. */
export function GradeRows({ counts }: { counts: GradeCounts }) {
  const n = counts.n ?? 0;
  const ref = useRef<HTMLDivElement>(null);
  const [on, setOn] = useState(false);
  useEffect(() => {
    const t = requestAnimationFrame(() => requestAnimationFrame(() => setOn(true)));
    return () => cancelAnimationFrame(t);
  }, []);
  if (n === 0) return <p className="excl">Not enough data.</p>;
  return (
    <div ref={ref}>
      <div className="bars">
        {GRADE_COLORS.map(([k, label, color], i) => {
          const v = countOf(counts, k);
          if (v === 0) return null;
          const pct = (100 * v) / n;
          return (
            <div className="bl" key={k}>
              <span className="L">{label}</span>
              <span className="tk">
                <span
                  className="fill"
                  style={{
                    background: color,
                    width: on ? `${pct}%` : "0%",
                    transitionDelay: `${i * 40}ms`,
                  }}
                />
              </span>
              <span className="pc">{Math.round(pct)}%</span>
              <span className="v">{v.toLocaleString()}</span>
            </div>
          );
        })}
      </div>
      {excludedLine(counts) && <p className="excl">{excludedLine(counts)}</p>}
    </div>
  );
}

/** % of enrolled students earning A or B, drawn as an animated ring. A distribution stat, not a quality score. */
export function ABShareRing({ counts }: { counts: GradeCounts }) {
  const n = counts.n ?? 0;
  const share = n > 0 ? (countOf(counts, "a") + countOf(counts, "b")) / n : 0;
  const R = 34;
  const C = 2 * Math.PI * R;
  const [on, setOn] = useState(false);
  useEffect(() => {
    const t = requestAnimationFrame(() => requestAnimationFrame(() => setOn(true)));
    return () => cancelAnimationFrame(t);
  }, []);
  return (
    <div className="ringtile">
      <svg className="ring" width="84" height="84" viewBox="0 0 84 84">
        <circle className="bg" cx="42" cy="42" r={R} fill="none" strokeWidth="9" />
        <circle
          className="fg"
          cx="42" cy="42" r={R} fill="none" strokeWidth="9"
          strokeDasharray={C}
          strokeDashoffset={on ? C * (1 - share) : C}
        />
      </svg>
      <div>
        <div className="ringnum">
          <CountUp target={Math.round(share * 100)} />
          <span style={{ fontSize: 15, fontWeight: 700 }}>%</span>
        </div>
        <div className="ringlab">of enrolled got A-B</div>
      </div>
    </div>
  );
}
