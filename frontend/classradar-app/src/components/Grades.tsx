import { useEffect, useState, type ReactNode } from "react";
import type { GradeCounts } from "../types";

/** Apple-style light palette (M3 Vitals colors tuned for light backgrounds). */
// eslint-disable-next-line react-refresh/only-export-components
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

/** Sums a {group: GradeCounts} map into one GradeCounts. */
// eslint-disable-next-line react-refresh/only-export-components
export function sumCounts(groups: Record<string, GradeCounts>): GradeCounts {
  const out: GradeCounts = { n: 0 };
  for (const g of Object.values(groups)) {
    for (const k of Object.keys(g) as (keyof GradeCounts)[]) {
      out[k] = (out[k] ?? 0) + (g[k] ?? 0);
    }
  }
  return out;
}

// eslint-disable-next-line react-refresh/only-export-components
export function countOf(g: GradeCounts, k: keyof GradeCounts): number {
  return g[k] ?? 0;
}

// eslint-disable-next-line react-refresh/only-export-components
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

/** Flips true two frames after mount to trigger CSS draw transitions; immediate under reduced motion. */
// eslint-disable-next-line react-refresh/only-export-components
export function useDrawn(): boolean {
  const [on, setOn] = useState(false);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setOn(true);
      return;
    }
    let r2 = 0;
    const r1 = requestAnimationFrame(() => {
      r2 = requestAnimationFrame(() => setOn(true));
    });
    return () => {
      cancelAnimationFrame(r1);
      cancelAnimationFrame(r2);
    };
  }, []);
  return on;
}

/** Small stat tile: small-caps label above the value, hint below. */
export function Tile({ label, hint, children }: { label: string; hint: string; children: ReactNode }) {
  return (
    <div className="tile">
      <span className="tilelab">{label}</span>
      <b className="tileval">{children}</b>
      <span className="tilehint">{hint}</span>
    </div>
  );
}

/** Segmented A-F bar; segments are shares of the printed total n, remainder stays track. */
export function StackBar({ counts, thin = false }: { counts: GradeCounts; thin?: boolean }) {
  const n = counts.n ?? 0;
  const drawn = useDrawn();
  if (n === 0) return null;
  return (
    <div className={thin ? "stack thin" : "stack"} role="img" aria-label="Grade distribution from A to F">
      {GRADE_COLORS.slice(0, 5).map(([k, , color], i) => {
        const pct = (100 * countOf(counts, k)) / n;
        if (pct <= 0) return null;
        return (
          <span
            key={k}
            className="seg"
            style={{ background: color, width: drawn ? `${pct}%` : "0%", transitionDelay: `${i * 60}ms` }}
          />
        );
      })}
    </div>
  );
}

/** Grade rows A-F, then W as a separate block (withdrawal, not a grade), then the not-shown line. */
export function GradeRows({ counts }: { counts: GradeCounts }) {
  const n = counts.n ?? 0;
  const drawn = useDrawn();
  if (n === 0) return <p className="excl">Not enough data.</p>;
  const w = countOf(counts, "w");
  return (
    <div>
      <div className="bars">
        {GRADE_COLORS.slice(0, 5).map(([k, label, color], i) => {
          const v = countOf(counts, k);
          if (v === 0) return null;
          const pct = (100 * v) / n;
          return (
            <div className="bl" key={k}>
              <span className="L">{label}</span>
              <span className="tk">
                <span
                  className="fill"
                  style={{ background: color, width: drawn ? `${pct}%` : "0%", transitionDelay: `${i * 40}ms` }}
                />
              </span>
              <span className="pc">{Math.round(pct)}%</span>
              <span className="v">{v.toLocaleString()}</span>
            </div>
          );
        })}
      </div>
      {w > 0 && (
        <div className="wblock">
          <div className="bl">
            <span className="L">W</span>
            <span className="tk">
              <span
                className="fill"
                style={{ background: "#8E8E93", width: drawn ? `${(100 * w) / n}%` : "0%", transitionDelay: "200ms" }}
              />
            </span>
            <span className="pc">{Math.round((100 * w) / n)}%</span>
            <span className="v">{w.toLocaleString()}</span>
          </div>
          <p className="wnote">Withdrew from the course. Not a grade.</p>
        </div>
      )}
      {excludedLine(counts) && <p className="excl">{excludedLine(counts)}</p>}
    </div>
  );
}

/** % of enrollments earning A or B, drawn as a two-segment animated ring. A distribution stat, not a quality score. */
export function ABShareRing({ counts }: { counts: GradeCounts }) {
  const n = counts.n ?? 0;
  const a = n > 0 ? countOf(counts, "a") / n : 0;
  const b = n > 0 ? countOf(counts, "b") / n : 0;
  const R = 34;
  const C = 2 * Math.PI * R;
  const drawn = useDrawn();
  return (
    <div className="ringcard">
      <div className="kick">A-B share</div>
      <div className="ringwrap">
      <svg className="ring" width="96" height="96" viewBox="0 0 96 96" role="img" aria-label={`A-B share ${Math.round((a + b) * 100)} percent`}>
        <circle className="ringbg" cx="48" cy="48" r={R} fill="none" strokeWidth="9" />
        <circle
          cx="48" cy="48" r={R} fill="none" stroke="#28B84C" strokeWidth="9" strokeLinecap="round"
          strokeDasharray={C} strokeDashoffset={drawn ? C * (1 - a) : C} className="ringseg"
          transform="rotate(-90 48 48)"
        />
        <circle
          cx="48" cy="48" r={R} fill="none" stroke="#0A84FF" strokeWidth="9" strokeLinecap="round"
          strokeDasharray={C} strokeDashoffset={drawn ? C * (1 - b) : C} className="ringseg"
          transform={`rotate(${a * 360 - 90} 48 48)`}
        />
      </svg>
        <div className="ringcenter">
          <CountUp target={Math.round((a + b) * 100)} />
          <span className="pct">%</span>
        </div>
      </div>
      <div className="ringlab">of enrollments ended in an A or a B</div>
      <div className="ringlegend">
          <span><i style={{ background: "#28B84C" }} />A {Math.round(a * 100)}%</span>
          <span><i style={{ background: "#0A84FF" }} />B {Math.round(b * 100)}%</span>
      </div>
    </div>
  );
}

/** Concentric A-F rings across every section; legend carries the percentages, no title above it. */
export function OverallRings({ counts, range }: { counts: GradeCounts; range: string }) {
  const n = counts.n ?? 0;
  const drawn = useDrawn();
  const radii = [60, 49, 38, 27, 16];
  const grades = GRADE_COLORS.slice(0, 5);
  return (
    <div className="orings">
      <svg width="136" height="136" viewBox="0 0 136 136" role="img" aria-label="Distribution of grades across all sections">
        {grades.map(([k, , color], i) => {
          const r = radii[i];
          const C = 2 * Math.PI * r;
          const share = n > 0 ? countOf(counts, k) / n : 0;
          return (
            <g key={k}>
              <circle cx="68" cy="68" r={r} fill="none" stroke={color} strokeOpacity="0.16" strokeWidth="8" />
              <circle
                cx="68" cy="68" r={r} fill="none" stroke={color} strokeWidth="8" strokeLinecap="round"
                strokeDasharray={C} strokeDashoffset={drawn ? C * (1 - share) : C}
                style={{ transition: `stroke-dashoffset 1.1s var(--ease-draw) ${i * 90}ms` }}
                transform="rotate(-90 68 68)"
              />
            </g>
          );
        })}
      </svg>
      <div className="oright">
        <ul className="olegend">
          {grades.map(([k, label, color]) => {
            const pct = n > 0 ? Math.round((100 * countOf(counts, k)) / n) : 0;
            return (
              <li key={k}>
                <span className="sw" style={{ background: color }} />
                {label} <b>{pct}%</b>
              </li>
            );
          })}
        </ul>
        <p className="onote">Every section, {range}. Shares of the printed total n; W is a withdrawal, not a grade.</p>
      </div>
    </div>
  );
}
