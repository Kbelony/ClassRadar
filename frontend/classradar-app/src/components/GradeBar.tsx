import type { GradeCounts } from "../types";

const BUCKETS: { key: keyof GradeCounts; label: string; color: string; title: string }[] = [
  { key: "a", label: "A", color: "#22c55e", title: "A grade" },
  { key: "b", label: "B", color: "#84cc16", title: "B grade" },
  { key: "c", label: "C", color: "#eab308", title: "C grade" },
  { key: "d", label: "D", color: "#f97316", title: "D grade" },
  { key: "f", label: "F", color: "#ef4444", title: "F grade" },
  { key: "w", label: "W", color: "#71717a", title: "W = withdrawal, not a grade" },
];

const EXCLUDED: { key: keyof GradeCounts; label: string }[] = [
  { key: "p", label: "P (pass)" },
  { key: "np", label: "NP (no pass)" },
  { key: "ew", label: "EW (excused withdrawal)" },
  { key: "ix", label: "IX (incomplete)" },
];

export function GradeBar({ counts }: { counts: GradeCounts }) {
  const total = counts.n > 0 ? counts.n : BUCKETS.reduce((s, b) => s + counts[b.key], 0);
  if (total === 0) return <p className="text-sm text-zinc-500">Not enough data</p>;
  const excluded = EXCLUDED.filter((e) => counts[e.key] > 0);
  return (
    <div>
      <div className="flex h-3 w-full overflow-hidden rounded-full bg-zinc-800">
        {BUCKETS.map((b) =>
          counts[b.key] > 0 ? (
            <div
              key={b.key}
              style={{ width: `${(counts[b.key] / total) * 100}%`, backgroundColor: b.color }}
              title={`${b.title}: ${counts[b.key]}`}
            />
          ) : null,
        )}
      </div>
      <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-zinc-400">
        {BUCKETS.filter((b) => counts[b.key] > 0).map((b) => (
          <span key={b.key} title={b.title}>
            <span className="font-medium" style={{ color: b.color }}>{b.label}</span>{" "}
            {Math.round((counts[b.key] / total) * 100)}%
          </span>
        ))}
        <span className="text-zinc-500">n={total} enrolled</span>
      </div>
      <p className="mt-1 text-xs text-zinc-500">
        Percentages of all enrolled students (n = printed total). W = withdrawal, not a
        grade.
        {excluded.length > 0 && (
          <>
            {" "}
            Not shown: {excluded.map((e) => `${e.label} ${counts[e.key]}`).join(", ")}.
          </>
        )}
      </p>
    </div>
  );
}
