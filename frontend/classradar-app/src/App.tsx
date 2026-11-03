import "./App.css";
import { useEffect, useMemo, useState, type CSSProperties } from "react";
import type { Course, Coverage, GradeCounts, Professor } from "./types";
import { coverageRange, displayName, loadCourses, loadCoverage, loadProfessors, rmpSearchUrl } from "./data";
import { ABShareRing, CountUp, GradeRows, OverallRings, StackBar, Tile, sumCounts } from "./components/Grades";
import SplitText from "./components/SplitText";

type Result =
  | { kind: "professor"; prof: Professor }
  | { kind: "course"; course: Course };

function resultCounts(r: Result): GradeCounts {
  return r.kind === "professor" ? sumCounts(r.prof.courses) : sumCounts(r.course.profs);
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

  const go = (r: Result | null) => {
    const d = document as Document & { startViewTransition?: (cb: () => void) => void };
    if (d.startViewTransition) d.startViewTransition(() => setSelected(r));
    else setSelected(r);
  };

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

  /** Every section, summed from course entries; pseudo-instructors named "Total" are ignored (display guard). */
  const allSections = useMemo(() => {
    const out: GradeCounts = { n: 0 };
    for (const c of courses) {
      for (const [pname, g] of Object.entries(c.profs)) {
        if (pname.trim().toUpperCase() === "TOTAL") continue;
        for (const k of Object.keys(g) as (keyof GradeCounts)[]) {
          out[k] = (out[k] ?? 0) + (g[k] ?? 0);
        }
      }
    }
    return out;
  }, [courses]);

  const range = coverageRange(coverage);
  const semesters = coverage?.semestersIncluded.length ?? 0;
  const searching = query.trim().length >= 2;

  if (selected) {
    const isProf = selected.kind === "professor";
    const name = isProf ? displayName(selected.prof.name) : selected.course.course;
    const dept = isProf ? selected.prof.dept : selected.course.dept;
    const groups: [string, GradeCounts][] = isProf
      ? Object.entries(selected.prof.courses).sort((a, b) => (b[1].n ?? 0) - (a[1].n ?? 0))
      : Object.entries(selected.course.profs).sort((a, b) => (b[1].n ?? 0) - (a[1].n ?? 0));
    const all = isProf ? sumCounts(selected.prof.courses) : sumCounts(selected.course.profs);
    const enrollments = isProf ? selected.prof.totalStudents : selected.course.totalStudents;
    const wShare = all.n ? Math.round((100 * (all.w ?? 0)) / all.n) : 0;
    return (
      <div className="wrap detail">
        <div className="topbar">
          <button className="back" onClick={() => go(null)}>
            <svg width="9" height="15" viewBox="0 0 9 15" fill="none" aria-hidden="true">
              <path d="M8 1.5L1.8 7.5 8 13.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Search
          </button>
        </div>
        <div className="dgrid">
          <aside className="aside">
            <div className="kicker">{isProf ? "Instructor" : "Course"}</div>
            <h2 className="dtitle">{name}</h2>
            <p className="dmeta">
              {dept} - {range}
              {isProf && " - instructor name as printed in SMC official records"}
            </p>
            <div className="vitals">
              <ABShareRing counts={all} />
              <div className="tiles3">
                <Tile label="Enrollments" hint="all semesters"><CountUp target={enrollments} /></Tile>
                <Tile label={isProf ? "Courses" : "Instructors"} hint={isProf ? "taught" : "on record"}><CountUp target={groups.length} /></Tile>
                <Tile label="Withdrew" hint="W, not a grade"><CountUp target={wShare} />%</Tile>
              </div>
            </div>
            {isProf && (
              <>
                <a className="rmp" href={rmpSearchUrl(selected.prof.name)} target="_blank" rel="noreferrer">
                  Search "{name}" on RateMyProfessors
                </a>
                <p className="rmpnote">Opens an external search on ratemyprofessors.com - not a verified profile match.</p>
              </>
            )}
          </aside>
          <div className="cards">
            {groups.map(([gname, counts], i) => (
              <section className="card pop" key={gname} style={{ "--i": Math.min(i, 6) } as CSSProperties}>
                <div className="code">{isProf ? gname : displayName(gname)}</div>
                <div className="cn">n = {(counts.n ?? 0).toLocaleString()} enrollments, summed across semesters</div>
                <StackBar counts={counts} />
                <GradeRows counts={counts} />
              </section>
            ))}
          </div>
        </div>
        <Footer coverage={coverage} />
      </div>
    );
  }

  return (
    <div className="wrap home">
      <div className="eyebrow pop" style={{ "--i": 0 } as CSSProperties}>
        <span className="dot" aria-hidden="true" />
        ClassRadar - Santa Monica College
      </div>
      <h1 className="hero">
        <SplitText text="Grades," tag="span" splitType="chars" effect="rise" trigger="load" delay={60} duration={0.9} textAlign="left" />
        <br />
        <SplitText text={"out in the "} tag="span" splitType="chars" effect="rise" trigger="load" delay={45} duration={0.9} textAlign="left" />
        <span className="a"><SplitText text="open." tag="span" splitType="chars" effect="rise" trigger="load" delay={45} duration={0.9} textAlign="left" /></span>
      </h1>
      <p className="lede pop" style={{ "--i": 1 } as CSSProperties}>
        Official SMC grade distributions, {range.toLowerCase()}, searchable in seconds.
      </p>
      <div className="sfield pop" style={{ "--i": 2 } as CSSProperties}>
        <svg width="17" height="17" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <circle cx="7" cy="7" r="5.4" stroke="#86868b" strokeWidth="1.6" />
          <path d="M11.2 11.2L14.5 14.5" stroke="#86868b" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
        <input
          type="search"
          placeholder="Try Hamada or ENGL C1000"
          aria-label="Search professors and courses"
          value={query}
          onChange={(e) => { setQuery(e.target.value); setSelected(null); setActiveIndex(-1); }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") { e.preventDefault(); setActiveIndex((i) => Math.min(i + 1, results.length - 1)); }
            else if (e.key === "ArrowUp") { e.preventDefault(); setActiveIndex((i) => Math.max(i - 1, 0)); }
            else if (e.key === "Enter" && results.length > 0) { e.preventDefault(); go(results[activeIndex >= 0 ? activeIndex : 0]); }
          }}
        />
      </div>
      {loading && <p className="dmeta" style={{ marginTop: 18 }}>Loading data...</p>}
      {error && <p className="dmeta" style={{ marginTop: 18, color: "#FF3B30" }}>{error}</p>}

      {searching ? (
        results.length > 0 ? (
          <div className="rcard pop" style={{ "--i": 1 } as CSSProperties}>
            {results.map((r, i) => {
              const counts = resultCounts(r);
              const rname = r.kind === "professor" ? displayName(r.prof.name) : r.course.course;
              const dept = r.kind === "professor" ? r.prof.dept : r.course.dept;
              return (
                <button
                  key={`${r.kind}-${rname}`}
                  className={`rrow pop-row ${i === activeIndex ? "active" : ""}`}
                  style={{ "--i": i } as CSSProperties}
                  onClick={() => go(r)}
                >
                  <span className="rmain">
                    <span className="rk">{r.kind === "course" ? "Course" : "Instructor"}</span>
                    <span className="nm">{rname}</span>
                    <span className="rm">{dept} - {(counts.n ?? 0).toLocaleString()} enrollments</span>
                    <StackBar counts={counts} thin />
                  </span>
                  <svg className="chev" width="8" height="14" viewBox="0 0 8 14" fill="none" aria-hidden="true">
                    <path d="M1 1.5L6.2 7 1 12.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
              );
            })}
          </div>
        ) : (
          !loading && <p className="empty">No match for "{query.trim()}". Try an instructor's last name or a course code like ENGL C1000.</p>
        )
      ) : (
        <>
          <div className="stats pop" style={{ "--i": 3 } as CSSProperties}>
            <Tile label="Instructors" hint="on record"><CountUp target={profs.length} /></Tile>
            <Tile label="Courses" hint="on record"><CountUp target={courses.length} /></Tile>
            <Tile label="Semesters" hint={range}><CountUp target={semesters} /></Tile>
          </div>
          <section className="overall pop" style={{ "--i": 4 } as CSSProperties}>
            <OverallRings counts={allSections} range={range} />
          </section>
        </>
      )}
      <Footer coverage={coverage} />
    </div>
  );
}

function Footer({ coverage }: { coverage: Coverage | null }) {
  const range = coverageRange(coverage);
  const excluded = coverage ? Object.entries(coverage.rowsQuarantined).map(([reason, n]) => `${n} ${reason}`) : [];
  return (
    <div className="foot">
      Source: <a href="https://admin.smc.edu/administration/institutional-research/grade-distribution.php" target="_blank" rel="noreferrer">SMC Office of Institutional Research</a>, "Grade Distribution by Instructor", {range} ({coverage?.semestersIncluded.length ?? "..."} semesters, {(coverage?.rowsIncluded ?? 0).toLocaleString()} sections).
      <br />
      Shares are computed from counts summed across all semesters (enrollment-weighted), of the printed section total (n). W = withdrawal, not a grade. Enrollments count section seats, not unique students. A-B% is a distribution stat, not a teaching-quality score.
      <br />
      Instructor names appear exactly as printed in SMC records; same names across departments may be different people.
      {excluded.length > 0 && <> Excluded: {excluded.join("; ")}.</>}
      <br />
      Professor reviews open as an external RateMyProfessors search - not a verified profile match.
    </div>
  );
}

export default App;
