export interface GradeCounts {
  a?: number; b?: number; c?: number; d?: number; f?: number;
  p?: number; np?: number; ix?: number; ew?: number; w?: number;
  rd?: number; ip?: number; sp?: number;
  /** Sum of the section totals printed in the official report */
  n?: number;
}

export interface Professor {
  name: string;
  dept: string;
  subject: string;
  courses: Record<string, GradeCounts>;
  semesters: string[];
  semesterTotals: Record<string, number>;
  totalStudents: number;
}

export interface Course {
  course: string;
  dept: string | null;
  profs: Record<string, GradeCounts>;
  totalStudents: number;
}

export interface Coverage {
  source: string;
  sourceUrl: string;
  semestersIncluded: string[];
  rowsPerSemester: Record<string, number>;
  rowsIncluded: number;
  rowsQuarantined: Record<string, number>;
  aggregation: string;
  identity: string;
}
