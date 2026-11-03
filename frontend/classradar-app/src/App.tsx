import "./App.css";
import { useEffect, useMemo, useState } from "react";
import type { Course, Professor } from "./types";
import { displayName, loadCourses, loadProfessors, rmpSearchUrl } from "./data";
import { GradeBar } from "./components/GradeBar";

type Result =
  | { kind: "professor"; prof: Professor }
  | { kind: "course"; course: Course };

function App() {
  const [profs, setProfs] = useState<Professor[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Result | null>(null);
  const [activeIndex, setActiveIndex] = useState(-1);

  useEffect(() => {
    Promise.all([loadProfessors(), loadCourses()])
      .then(([p, c]) => {
        setProfs(p);
        setCourses(c);
        setLoading(false);
      })
      .catch(() => {
        setError("Could not load the grade data. Please try again later.");
        setLoading(false);
      });
  }, []);

  const results = useMemo<Result[]>(() => {
    const q = query.trim().toUpperCase();
    if (q.length < 2) return [];
    const profHits: Result[] = profs
      .filter((p) => p.name.includes(q))
      .slice(0, 10)
      .map((prof) => ({ kind: "professor", prof }));
    const courseHits: Result[] = courses
      .filter((c) => c.course.includes(q))
      .slice(0, 10)
      .map((course) => ({ kind: "course", course }));
    return [...courseHits, ...profHits];
  }, [query, profs, courses]);

  return (
    <div className="mx-auto min-h-screen max-w-2xl bg-zinc-950 px-4 py-10 text-zinc-100">
      <h1 className="text-3xl font-bold tracking-tight">ClassRadar</h1>
      <p className="mt-1 text-sm text-zinc-400">
        Official Fall 2025 grade distributions for Santa Monica College professors
        and courses.
      </p>

      <input
        type="search"
        value={query}
        role="combobox"
        aria-expanded={results.length > 0}
        aria-label="Search professors and courses"
        onChange={(e) => {
          setQuery(e.target.value);
          setSelected(null);
          setActiveIndex(-1);
        }}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setActiveIndex((i) => Math.min(i + 1, results.length - 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActiveIndex((i) => Math.max(i - 1, -1));
          } else if (e.key === "Enter" && results.length > 0) {
            e.preventDefault();
            setSelected(results[activeIndex >= 0 ? activeIndex : 0]);
          }
        }}
        placeholder="Search a professor (e.g. Hamada) or a course (e.g. ENGL C1000)"
        className="mt-6 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-3 text-base outline-none placeholder:text-zinc-500 focus:border-zinc-400"
      />

      {loading && <p className="mt-6 text-sm text-zinc-500">Loading data...</p>}
      {error && <p className="mt-6 text-sm text-red-400">{error}</p>}

      {!selected && results.length > 0 && (
        <ul className="mt-4 divide-y divide-zinc-800 rounded-lg border border-zinc-800">
          {results.map((r, i) => (
            <li key={i}>
              <button
                onClick={() => setSelected(r)}
                className={`flex w-full items-center justify-between px-4 py-3 text-left hover:bg-zinc-900 ${i === activeIndex ? "bg-zinc-900" : ""}`}
              >
                {r.kind === "professor" ? (
                  <>
                    <span>{displayName(r.prof.name)}</span>
                    <span className="text-xs text-zinc-500">
                      {r.prof.dept} - {r.prof.totalStudents.toLocaleString()} students
                    </span>
                  </>
                ) : (
                  <>
                    <span>{r.course.course}</span>
                    <span className="text-xs text-zinc-500">
                      Course - {r.course.totalStudents.toLocaleString()} students
                    </span>
                  </>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}

      {selected?.kind === "professor" && (
        <div className="mt-6">
          <button onClick={() => setSelected(null)} className="text-sm text-zinc-400 underline">
            Back to results
          </button>
          <h2 className="mt-2 text-2xl font-semibold">{displayName(selected.prof.name)}</h2>
          <p className="mt-1 text-sm text-zinc-400">
            {selected.prof.dept} - instructor name as printed in SMC official records,{" "}
            {selected.prof.totalStudents.toLocaleString()} enrolled students in Fall
            2025 (sum of printed section totals).
          </p>
          <a
            href={rmpSearchUrl(selected.prof.name)}
            target="_blank"
            rel="noreferrer"
            className="mt-2 inline-block text-sm text-sky-400 underline"
          >
            Search "{displayName(selected.prof.name)}" on RateMyProfessors (SMC)
          </a>
          <p className="mt-0.5 text-xs text-zinc-500">
            Opens an external search on ratemyprofessors.com - not a verified profile
            match.
          </p>
          <h3 className="mt-6 text-lg font-medium">Grade distribution by course</h3>
          <ul className="mt-2 space-y-4">
            {Object.entries(selected.prof.courses)
              .sort((a, b) => b[1].graded - a[1].graded)
              .map(([cname, counts]) => (
                <li key={cname} className="rounded-lg border border-zinc-800 p-4">
                  <div className="mb-2 flex items-baseline justify-between">
                    <span className="font-medium">{cname}</span>
                    <span className="text-xs text-zinc-500">
                      n={counts.n.toLocaleString()} enrolled
                    </span>
                  </div>
                  <GradeBar counts={counts} />
                </li>
              ))}
          </ul>
        </div>
      )}

      {selected?.kind === "course" && (
        <div className="mt-6">
          <button onClick={() => setSelected(null)} className="text-sm text-zinc-400 underline">
            Back to results
          </button>
          <h2 className="mt-2 text-2xl font-semibold">{selected.course.course}</h2>
          <p className="mt-1 text-sm text-zinc-400">
            {selected.course.totalStudents.toLocaleString()} enrolled students in
            Fall 2025 (sum of printed section totals).
          </p>
          <h3 className="mt-6 text-lg font-medium">Grade distribution by professor</h3>
          <ul className="mt-2 space-y-4">
            {Object.entries(selected.course.profs)
              .sort((a, b) => b[1].graded - a[1].graded)
              .map(([pname, counts]) => (
                <li key={pname} className="rounded-lg border border-zinc-800 p-4">
                  <div className="mb-2 flex items-baseline justify-between">
                    <span className="font-medium">{displayName(pname)}</span>
                    <span className="text-xs text-zinc-500">
                      n={counts.n.toLocaleString()} enrolled
                    </span>
                  </div>
                  <GradeBar counts={counts} />
                </li>
              ))}
          </ul>
        </div>
      )}

      <footer className="mt-12 border-t border-zinc-800 pt-4 text-xs text-zinc-500">
        Source: Santa Monica College Office of Institutional Research, "Grade
        Distribution by Instructor" report, Fall 2025. Sections shown match the
        totals printed in the official report; that check does not guarantee every
        column was read correctly, so verify against the source PDF when it matters.
        Instructor names appear exactly as printed in SMC records. More semesters
        will be added after validation. Professor reviews live on RateMyProfessors
        and open on their site; links are searches, not verified profiles.
      </footer>
    </div>
  );
}

export default App;
