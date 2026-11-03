import json, re
from collections import defaultdict

rows = json.load(open('sections_clean.json'))
G = ['a','b','c','d','f','p','np','ix','ew','w']
SCOPE = {'Fall 2025'}  # V1: only the fully pixel-validated standard-layout semester

MERGED_DEPT = re.compile(r"^([A-Z][a-z]+(?: [A-Z][a-z]+)*)([A-Z]{2,7})$")

def norm_dept_course(r):
    dept = (r.get('dept') or '').strip()
    c = (r.get('course') or '').strip()
    s = (r.get('subject') or '').strip()
    m = MERGED_DEPT.match(dept)
    if m:
        dept, subj2 = m.group(1), m.group(2)
        if not s:
            s = subj2
    if s and c and not c.upper().startswith(s.upper()):
        c = f"{s} {c}"
    c = ' '.join(c.split()).upper()
    c = re.sub(r'^([A-Z&]+) \1 ', r'\1 ', c)  # 'ENGL ENGL 1' -> 'ENGL 1'
    return dept, c

# key professors by (name, department): name+initials alone can merge different people
profs = defaultdict(lambda: {'courses': defaultdict(lambda: defaultdict(int)), 'semesters': set(), 'total': 0})
courses = defaultdict(lambda: {'dept': None, 'profs': defaultdict(lambda: defaultdict(int)), 'total': 0})
skipped_sem = skipped_attrib = 0
for r in rows:
    if r['semester'] not in SCOPE:
        skipped_sem += 1; continue
    dept, cname = norm_dept_course(r)
    # rows without a reliable course attribution stay out of ALL displayed stats
    if not cname or re.fullmatch(r'\d+', cname):
        skipped_attrib += 1; continue
    instr = r['instructor'].strip()
    if not instr: continue
    dept = dept or 'Unknown'
    sem = r['semester']
    g = r['grades']
    graded = g.get('a',0)+g.get('b',0)+g.get('c',0)+g.get('d',0)+g.get('f',0)
    key = (instr, dept)
    p = profs[key]
    p['semesters'].add(sem)
    p['total'] += g.get('total', 0)
    for k in G:
        p['courses'][cname][k] += g.get(k, 0)
    p['courses'][cname]['graded'] += graded
    p['courses'][cname]['n'] += g.get('total', 0)
    c = courses[(cname, dept)]
    c['dept'] = c['dept'] or dept
    for k in G:
        c['profs'][instr][k] += g.get(k, 0)
    c['profs'][instr]['graded'] += graded
    c['profs'][instr]['n'] += g.get('total', 0)
    c['total'] += g.get('total', 0)

out_profs = []
for (name, dept), p in profs.items():
    out_profs.append({
        'name': name,
        'dept': dept,
        'courses': {c: dict(v) for c, v in p['courses'].items()},
        'semesters': sorted(p['semesters']),
        'totalStudents': p['total'],
    })
out_courses = []
for (cname, dept), c in courses.items():
    out_courses.append({
        'course': cname,
        'dept': dept,
        'profs': {n: dict(v) for n, v in c['profs'].items()},
        'totalStudents': c['total'],
    })
out_profs.sort(key=lambda x: -x['totalStudents'])
out_courses.sort(key=lambda x: -x['totalStudents'])
json.dump(out_profs, open('professors.json','w'))
json.dump(out_courses, open('courses.json','w'))
import os
print('excluded semester rows:', skipped_sem, '| excluded unattributed rows:', skipped_attrib)
print('professor entries (name+dept):', len(out_profs), os.path.getsize('professors.json')//1024, 'KB')
print('course entries (course+dept):', len(out_courses), os.path.getsize('courses.json')//1024, 'KB')
ham = [p for p in out_profs if p['name']=='HAMADA M J']
for h in ham:
    print('HAMADA M J |', h['dept'], '| total', h['totalStudents'], '| courses:', list(h['courses'].keys()))
