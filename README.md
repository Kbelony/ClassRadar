# ClassRadar

A web app that visualizes official grade distributions and professor ratings to help Santa Monica College students make smarter course decisions.

- Search a professor or a course
- See official SMC grade distributions (A-F + withdrawals) from the Office of Institutional Research
- Jump to RateMyProfessors search results for the printed instructor name

## Status

V1 prototype lives on branch `feat/v1-search-distributions`: professor/course search over the validated Fall 2025 semester only. More semesters will be added after per-semester validation.

## Structure

- `frontend/classradar-app/` - Vite + React + TypeScript + Tailwind app
- `scripts/` - ETL for the official SMC grade-distribution PDFs (parse + aggregate)
- `frontend/classradar-app/public/data/` - aggregated, validated datasets (see README there)

## Develop

```bash
cd frontend/classradar-app
npm install
npm run dev
```
