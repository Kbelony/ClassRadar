import json, re, os
from collections import defaultdict, Counter

SEMS = ['Fall 2016','Spring 2016','Fall 2017','Spring 2017','Fall 2018','Spring 2018',
        'Spring 2019','Fall 2019','Spring 2020','Fall 2020','Spring 2021','Fall 2021',
        'Spring 2022','Fall 2022','Spring 2023','Fall 2023','Spring 2024','Fall 2024',
        'Spring 2025','Fall 2025']
G = ['a','b','c','d','f','p','np','ix','ew','w','rd','ip','sp']
MERGED_DEPT = re.compile(r"^([A-Z][a-z]+(?: [A-Z][a-z]+)*)([A-Z]{2,7})$")

def norm_dept_course(r):
    dept = (r.get('dept') or '').strip()
    c = (r.get('course') or '').strip()
    s = (r.get('subject') or '').strip()
    m = MERGED_DEPT.match(dept)
    if m:
        dept, subj2 = m.group(1), m.group(2)
        if not s: s = subj2
    if s and c and not c.upper().startswith(s.upper()):
        c = f"{s} {c}"
    c = ' '.join(c.split()).upper()
    c = re.sub(r'^([A-Z&]+) \1 ', r'\1 ', c)
    return dept, c

# pass 1: collect rows per (name, subject) and (course) for modal-dept resolution
prof_groups = defaultdict(list)   # (name, subject) -> [(dept, sem, course, grades)]
course_groups = defaultdict(list) # course -> [(dept, name, grades)]
q = defaultdict(int)
rows_per_sem = {}
for sem in SEMS:
    rows = json.load(open(f"sections_{sem.replace(' ','_')}.json"))
    rows_per_sem[sem] = len(rows)
    for r in rows:
        dept, cname = norm_dept_course(r)
        if not cname or re.fullmatch(r'\d+', cname):
            q['unresolved course attribution'] += 1; continue
        if dept and re.search(r'\d', dept):
            q['implausible department label'] += 1; continue
        instr = (r['instructor'] or '').strip()
        if not instr:
            q['missing instructor'] += 1; continue
        g = r['grades']
        if sum(v for k, v in g.items() if k != 'total') != g.get('total', -1):
            q['grade sum != printed total'] += 1; continue
        subj = (cname.split() or [''])[0]
        prof_groups[(instr, subj)].append((dept or 'Unknown', sem, cname, r['grades']))
        course_groups[cname].append((dept or 'Unknown', instr, r['grades']))

def nz(d):
    return {k: int(v) for k, v in d.items() if v}

out_profs = []
for (name, subj), lst in prof_groups.items():
    dept = Counter(d for d, *_ in lst).most_common(1)[0][0]
    courses = defaultdict(lambda: defaultdict(int))
    sems = set(); sem_totals = defaultdict(int); total = 0
    for d, sem, cname, g in lst:
        sems.add(sem)
        for k in G: courses[cname][k] += g.get(k, 0)
        n = g.get('total', 0)
        courses[cname]['n'] += n
        sem_totals[sem] += n; total += n
    out_profs.append({'name': name, 'dept': dept, 'subject': subj,
        'courses': {c: nz(v) for c, v in courses.items()},
        'semesters': sorted(sems), 'semesterTotals': dict(sem_totals),
        'totalStudents': total})
out_courses = []
for cname, lst in course_groups.items():
    dept = Counter(d for d, *_ in lst).most_common(1)[0][0]
    pcounts = defaultdict(lambda: defaultdict(int)); total = 0
    for d, instr, g in lst:
        for k in G: pcounts[instr][k] += g.get(k, 0)
        n = g.get('total', 0)
        pcounts[instr]['n'] += n; total += n
    out_courses.append({'course': cname, 'dept': dept,
        'profs': {nm: nz(v) for nm, v in pcounts.items()}, 'totalStudents': total})
out_profs.sort(key=lambda x: -x['totalStudents'])
out_courses.sort(key=lambda x: -x['totalStudents'])
json.dump(out_profs, open('professors_all.json','w'), separators=(',',':'))
json.dump(out_courses, open('courses_all.json','w'), separators=(',',':'))
coverage = {
  'source': 'SMC Office of Institutional Research - official grade distribution PDFs',
  'sourceUrl': 'https://admin.smc.edu/administration/institutional-research/grade-distribution.php',
  'semestersIncluded': SEMS,
  'rowsPerSemester': rows_per_sem,
  'rowsIncluded': sum(rows_per_sem.values()) - sum(q.values()),
  'rowsQuarantined': dict(q),
  'aggregation': 'Counts summed across semesters per professor/course; shares computed from summed counts (enrollment-weighted), never an average of per-section percentages. n = printed section total. A-F and W shares are of n; P/NP/IX/EW/RD/IP/SP excluded from letter bars.',
  'identity': 'Professors keyed by instructor name as printed + course subject; department shown is the modal printed department for that group. Same printed names across subjects are kept separate; collisions within a subject are an unresolved association, not two proven people.',
}
json.dump(coverage, open('coverage.json','w'), indent=1)
print('prof entries:', len(out_profs), os.path.getsize('professors_all.json')//1024, 'KB')
print('course entries:', len(out_courses), os.path.getsize('courses_all.json')//1024, 'KB')
print('quarantine:', dict(q))
for h in [p for p in out_profs if p['name']=='HAMADA M J']:
    print('HAMADA |', h['dept'], '| subj', h['subject'], '| total', h['totalStudents'], '| sems', len(h['semesters']), '|', list(h['courses'].keys())[:6])
