# ClassRadar data

Grade distributions for Santa Monica College.

Source: Santa Monica College Office of Institutional Research,
"Grade Distribution by Instructor" reports
(https://admin.smc.edu/administration/institutional-research/grade-distribution.php).

## Scope (V1)

Fall 2025 only - the most recent official semester, and the layout that has been
validated row-by-row against the source PDF. Older semesters are added only after
per-layout re-parsing and validation.

- professors.json: one entry per (instructor as printed, department), with
  per-course grade counts. Names are exactly as printed by SMC (LAST + initials);
  no cross-department identity merging is performed.
- courses.json: one entry per (course, department), with per-instructor counts.
- Only rows whose grade columns sum exactly to the printed section total are
  included.
- Grade buckets: a, b, c, d, f, p (pass), np (no pass), w (withdrawal);
  "graded" = a+b+c+d+f.

Regenerate with `scripts/aggregate.py` from `sections_clean.json`
(produced by `scripts/parse_smc_pdfs.py`).
