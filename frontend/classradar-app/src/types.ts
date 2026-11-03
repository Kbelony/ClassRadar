export interface GradeCounts {
  a: number; b: number; c: number; d: number; f: number;
  p: number; np: number; ix: number; ew: number; w: number;
  /** A-F letter grades only */
  graded: number;
  /** Sum of the section totals printed in the official report */
  n: number;
}

export interface Professor {
  name: string;
  dept: string;
  courses: Record<string, GradeCounts>;
  semesters: string[];
  totalStudents: number;
}

export interface Course {
  course: string;
  dept: string | null;
  profs: Record<string, GradeCounts>;
  totalStudents: number;
}
