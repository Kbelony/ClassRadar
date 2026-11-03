# Grade distribution ETL

Reproduces `frontend/classradar-app/public/data/{professors,courses,coverage}.json`
from the official SMC Office of Institutional Research PDFs.

## Source data

Download the 20 "Grade Distribution by Instructor" PDFs (Fall 2016 - Fall 2025)
from https://admin.smc.edu/administration/institutional-research/grade-distribution.php
and place them in `scripts/pdfs/` using the exact filenames listed in `FILES`
at the top of `parse_smc_pdfs.py`. The PDFs are not committed to this repo.

## Dependencies

- Python 3.10+
- `pip install pdfplumber` (developed against pdfplumber 0.11.10)

## Run

From this `scripts/` directory:

    python3 parse_smc_pdfs.py all     # writes sections_<Semester>.json + problems_<Semester>.json per semester
    python3 aggregate.py              # writes professors_all.json, courses_all.json, coverage.json

Then copy the outputs into the app data dir:

    cp professors_all.json ../frontend/classradar-app/public/data/professors.json
    cp courses_all.json    ../frontend/classradar-app/public/data/courses.json
    cp coverage.json       ../frontend/classradar-app/public/data/coverage.json

## Expected results (verified 2026-11-02 against the live preview)

- 20 semesters, rows per semester as listed in coverage.json `rowsPerSemester` (total 50,672 parsed)
- Quarantined and excluded: 72 rows where printed grades do not sum to the printed total,
  1 row with unresolved course attribution (see coverage.json `rowsQuarantined`)
- Included: 50,599 sections -> 3,959 professor entries, 2,316 courses
- Regenerated JSON parses identical to the files served in `public/data/`

## Notes

- Professors are keyed by instructor name as printed + course subject; the printed
  department column is noisy across semesters, so the modal department is shown.
  Same printed names across subjects are kept separate; collisions within a subject
  are an unresolved association, not two proven people.
- `problems_<Semester>.json` lists per-semester parse anomalies for audit.
