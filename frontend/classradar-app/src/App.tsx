import "./App.css";
import { useEffect, useMemo, useState } from "react";
import type { Course, Coverage, GradeCounts, Professor } from "./types";
import { coverageRange, displayName, loadCourses, loadCoverage, loadProfessors, rmpSearchUrl } from "./data";
import { ABShareRing, CountUp, GradeRows } from "./components/Grades";

type Result =
  | { kind: "professor"; prof: Professor }
  | { kind: "course"; course: Course };

function sumCounts(courses: Record<string, GradeCounts>): GradeCounts {
  const out: GradeCounts = { n: 0 };
  for (const g of Object.values(courses)) {
    for (const k of Object.keys(g) as (keyof GradeCounts)[]) {
      out[k] = (out[k] ?? 0) + (g[k] ?? 0);
    }
  }
  return out;
}

function App() {
  const [profs, setProfs] = useState<Professor[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [coverage, setCoverage] = useState<Coverage | null>(null);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Result | null>(null);
  const [activeIndex, setActiveIndex] = useState(-1);

  useEffect(() => {
    Promise.all([loadProfessors(), loadCourses(), loadCoverage()])
      .then(([p, c, cov]) => {
        setProfs(p);
        setCourses(c);
        setCoverage(cov);
        setLoading(false);
      })
      .catch(() => {
        setError("Could not load the grade data. Please try again later.");
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [selected]);

  const results = useMemo<Result[]>(() => {
    const q = query.trim().toUpperCase();
    if (q.length < 2) return [];
    const profHits: Result[] = profs
      .filter((p) => p.name.includes(q))
      .slice(0, 8)
      .map((prof) => ({ kind: "professor", prof }));
    const courseHits: Result[] = courses
      .filter((c) => c.course.includes(q))
      .slice(0, 8)
      .map((course) => ({ kind: "course", course }));
    return [...courseHits, ...profHits].slice(0, 10);
  }, [query, profs, courses]);

  const range = coverageRange(coverage);
  const semesters = coverage?.semestersIncluded.length ?? 0;

  if (selected?.kind === "professor") {
    const p = selected.prof;
    const all = sumCounts(p.courses);
    const courseList = Object.entries(p.courses).sort((a, b) => (b[1].n ?? 0) - (a[1].n ?? 0));
    return (
      <div className="wrap">
        <button className="back" onClick={() => setSelected(null)}>&lsaquo; Search</button>
        <h2 className="dtitle">{displayName(p.name)}</h2>
        <p className="dmeta">
          {p.dept} - {range} - instructor name as printed in SMC official records
        </p>
        <div className="vitals">
          <ABShareRing counts={all} />
          <div className="minitiles">
            <div className="mtile"><b><CountUp target={p.totalStudents} /></b><span>enrollments, all semesters</span></div>
            <div className="mtile"><b><CountUp target={courseList.length} /></b><span>courses</span></div>
          </div>
        </div>
        <a className="rmp" href={rmpSearchUrl(p.name)} target="_blank" rel="noreferrer">
          Search "{displayName(p.name)}" on RateMyProfessors
        </a>
        <p className="rmpnote">Opens an external search on ratemyprofessors.com - not a verified profile match.</p>
        {courseList.map(([cname, counts], i) => (
          <section className="sec" key={cname} style={{ animationDelay: `${i * 90}ms` }}>
            <div className="code">{cname}</div>
            <div className="cn">n = {(counts.n ?? 0).toLocaleString()} enrollments, summed across semesters</div>
            <GradeRows counts={counts} />
          </section>
        ))}
        <Footer coverage={coverage} />
      </div>
    );
  }

  if (selected?.kind === "course") {
    const c = selected.course;
    const all = sumCounts(c.profs);
    const profList = Object.entries(c.profs).sort((a, b) => (b[1].n ?? 0) - (a[1].n ?? 0));
    return (
      <div className="wrap">
        <button className="back" onClick={() => setSelected(null)}>&lsaquo; Search</button>
        <h2 className="dtitle">{c.course}</h2>
        <p className="dmeta">{c.dept} - {range}</p>
        <div className="vitals">
          <ABShareRing counts={all} />
          <div className="minitiles">
            <div className="mtile"><b><CountUp target={c.totalStudents} /></b><span>enrollments, all semesters</span></div>
            <div className="mtile"><b><CountUp target={profList.length} /></b><span>instructors</span></div>
          </div>
        </div>
        {profList.map(([pname, counts], i) => (
          <section className="sec" key={pname} style={{ animationDelay: `${i * 90}ms` }}>
            <div className="code">{displayName(pname)}</div>
            <div className="cn">n = {(counts.n ?? 0).toLocaleString()} enrollments, summed across semesters</div>
            <GradeRows counts={counts} />
          </section>
        ))}
        <Footer coverage={coverage} />
      </div>
    );
  }

  return (
    <div className="wrap">
      <div className="eyebrow">ClassRadar - Santa Monica College</div>
      <h1 className="hero">Grades,<br />out in the <span className="a">open.</span></h1>
      <p className="lede">
        Official SMC grade distributions, {range.toLowerCase()}, searchable in seconds.
      </p>
      <div className="sfield">
        <svg width="17" height="17" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <circle cx="7" cy="7" r="5.4" stroke="#86868b" strokeWidth="1.6" />
          <path d="M11.2 11.2L14.5 14.5" stroke="#86868b" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
        <input
          type="search"
          value={query}
          role="combobox"
          aria-expanded={results.length > 0}
          aria-label="Search professors and courses"
          autoComplete="off"
          onChange={(e) => { setQuery(e.target.value); setSelected(null); setActiveIndex(-1); }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") { e.preventDefault(); setActiveIndex((i) => Math.min(i + 1, results.length - 1)); }
            else if (e.key === "ArrowUp") { e.preventDefault(); setActiveIndex((i) => Math.max(i - 1, -1)); }
            else if (e.key === "Enter" && results.length > 0) { e.preventDefault(); setSelected(results[activeIndex >= 0 ? activeIndex : 0]); }
          }}
          placeholder="Try Hamada or ENGL C1000"
        />
      </div>
      {!query && (
        <div className="stats">
          <div className="stat"><b><CountUp target={profs.length} /></b><span>instructors</span></div>
          <div className="stat"><b><CountUp target={courses.length} /></b><span>courses</span></div>
          <div className="stat"><b><CountUp target={semesters} /></b><span>semesters</span></div>
        </div>
      )}
      {loading && <p className="dmeta" style={{ marginTop: 18 }}>Loading data...</p>}
      {error && <p className="dmeta" style={{ marginTop: 18, color: "#FF3B30" }}>{error}</p>}
      <div className="rlist">
        {results.map((r, i) => (
          <button
            key={i}
            className={`rrow ${i === activeIndex ? "active" : ""}`}
            style={{ animationDelay: `${i * 55}ms` }}
            onClick={() => setSelected(r)}
          >
            {r.kind === "professor" ? (
              <>
                <span className="nm">{displayName(r.prof.name)}</span>
                <span className="mt">{r.prof.dept} - {r.prof.totalStudents.toLocaleString()} enrollments</span>
              </>
            ) : (
              <>
                <span className="nm">{r.course.course}</span>
                <span className="mt">{r.course.dept} - {r.course.totalStudents.toLocaleString()} enrollments</span>
              </>
            )}
          </button>
        ))}
      </div>
      <Footer coverage={coverage} />
    </div>
  );
}

function Footer({ coverage }: { coverage: Coverage | null }) {
  const range = coverageRange(coverage);
  const quarantined = coverage ? Object.values(coverage.rowsQuarantined).reduce((a, b) => a + b, 0) : 0;
  return (
    <div className="foot">
      Source: <a href="https://admin.smc.edu/administration/institutional-research/grade-distribution.php" target="_blank" rel="noreferrer" style={{ color: "#0A84FF" }}>SMC Office of Institutional Research</a>, "Grade Distribution by Instructor", {range} ({coverage?.semestersIncluded.length ?? "..."} semesters, {(coverage?.rowsIncluded ?? 0).toLocaleString()} sections).
      <br />
      Shares are computed from counts summed across all semesters (enrollment-weighted), of the printed section total (n). W = withdrawal, not a grade. Enrollments count section seats, not unique students. A-B% is a distribution stat, not a teaching-quality score.
      <br />
      Instructor names appear exactly as printed in SMC records; same names across departments may be different people.
      {quarantined > 0 && <> {quarantined} section(s) with unreadable attribution were excluded.</>}
      <br />
      Professor reviews open as an external RateMyProfessors search - not a verified profile match.
    </div>
  );
}

export default App;
