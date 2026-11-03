import type { Course, Professor } from "./types";

let profsPromise: Promise<Professor[]> | null = null;
let coursesPromise: Promise<Course[]> | null = null;

export function loadProfessors(): Promise<Professor[]> {
  if (!profsPromise) {
    profsPromise = fetch("/data/professors.json").then((r) => r.json());
  }
  return profsPromise;
}

export function loadCourses(): Promise<Course[]> {
  if (!coursesPromise) {
    coursesPromise = fetch("/data/courses.json").then((r) => r.json());
  }
  return coursesPromise;
}

/** RateMyProfessors search URL for a name at Santa Monica College (school 1371). External link, no data copied. */
export function rmpSearchUrl(name: string): string {
  return `https://www.ratemyprofessors.com/search/professors/1371?q=${encodeURIComponent(name)}`;
}

/** "HAMADA M J" -> "Hamada M J" (best-effort display casing) */
export function displayName(raw: string): string {
  return raw
    .toLowerCase()
    .split(" ")
    .map((w) => (w.length > 1 ? w[0].toUpperCase() + w.slice(1) : w.toUpperCase()))
    .join(" ");
}
