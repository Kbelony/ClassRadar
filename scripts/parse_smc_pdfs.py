import pdfplumber, json, re, os
from collections import defaultdict
from functools import lru_cache

FILES = {
 'grade-distribution-fall-2016.pdf':'Fall 2016','grade-distribution-spring-2016.pdf':'Spring 2016',
 'grade-distribution-fall-2017.pdf':'Fall 2017','grade-distribution-spring-2017.pdf':'Spring 2017',
 'grade-distribution-fall-2018.pdf':'Fall 2018','grade-distribution-spring-2018.pdf':'Spring 2018',
 'grade-distribution-fall-2019.pdf':'Fall 2019','grade-distribution-spring-2019.pdf':'Spring 2019',
 'Fall_2020_Grade_Distribution.pdf':'Fall 2020','Spring_2020_Grade_Distribution.pdf':'Spring 2020',
 'Grade-Distribution-Fall-2021.pdf':'Fall 2021','GradeDistribution_Spring2021.pdf':'Spring 2021',
 'spring-2022-grade-distribution.pdf':'Spring 2022','Fall202GD2.pdf':'Fall 2022',
 'Grade-distribution-Fall-2023.pdf':'Fall 2023','spring-2023-rot.pdf':'Spring 2023',
 'Spring2024GradeDistribution.pdf':'Spring 2024','Fall-2024-Grade-Distribution.pdf':'Fall 2024',
 'Spring2025GradeDistribution.pdf':'Spring 2025','grade-distribution-fall-2025.pdf':'Fall 2025',
}
TEXT_COLS = {'department':'dept','dept':'dept','subject':'subject','course':'course','section':'section',
             'instructor':'instructor','departmentdiscipline':'dept','discipline':'dept'}
GRADE_SET = {'a','b','c','d','f','p','np','rd','ix','w','ew','ip','sp','total','count'}
SKIP_PENALTY = 25.0

def detect_header(ws):
    low = [w['text'].lower() for w in ws]
    if 'instructor' in low and ('section' in low or 'course' in low) and any(t in GRADE_SET for t in low):
        cols = []
        for w, t in zip(ws, low):
            name = TEXT_COLS.get(t, t if t in GRADE_SET else None)
            if name: cols.append((name, (w['x0']+w['x1'])/2))
        seen=set(); ded=[]
        for n,c in cols:
            if n not in seen: seen.add(n); ded.append((n,c))
        return ded
    return None

def row_from(ws, cols, cur, semester, pno, joined, problems):
    col_names = [c[0] for c in cols]; col_centers = [c[1] for c in cols]
    grade_cols = [(i,n) for i,n in enumerate(col_names) if n in GRADE_SET]
    first_grade_i = grade_cols[0][0]
    instr_i = col_names.index('instructor')
    boundary = (col_centers[instr_i] + col_centers[first_grade_i]) / 2
    merged_mode = 'course' not in col_names
    assign = {n: [] for n in ('dept','subject','course','section','instructor') if n in col_names}
    nums = []
    text_zone = [i for i,n in enumerate(col_names) if n not in GRADE_SET]
    if merged_mode:
        sec_center = col_centers[col_names.index('section')] if 'section' in col_names else col_centers[instr_i]
        left_texts, right_texts, sec_tok = [], [], ''
        for w in ws:
            cx = (w['x0']+w['x1'])/2; t = w['text']
            if cx >= boundary and re.fullmatch(r'\d+', t):
                nums.append((cx, int(t)))
            elif cx >= boundary:
                right_texts.append(t)
            elif re.fullmatch(r'\d{4,7}', t) and abs(cx - sec_center) < 25:
                sec_tok += t
            elif cx < sec_center - 10:
                left_texts.append(t)
            else:
                right_texts.append(t)
        assign['instructor'] = right_texts
        num_i = None
        for i in range(len(left_texts)-1, -1, -1):
            if re.fullmatch(r'[A-Z]*\d+[A-Z]?', left_texts[i]):
                num_i = i; break
        if num_i is not None:
            subj = None
            for i in range(num_i-1, -1, -1):
                if re.fullmatch(r"[A-Za-z&']+", left_texts[i]):
                    subj = left_texts[i]; break
            assign['course'] = [f"{subj} {left_texts[num_i]}" if subj else left_texts[num_i]]
            if left_texts[0] != subj:
                assign.setdefault('dept', []).append(left_texts[0])
        assign['section'] = [sec_tok] if sec_tok else []
    else:
        for w in ws:
            cx = (w['x0']+w['x1'])/2; t = w['text']
            if cx >= boundary and re.fullmatch(r'\d+', t):
                nums.append((cx, int(t)))
            elif cx >= boundary:
                assign['instructor'].append(t)
            else:
                best = min(text_zone, key=lambda i: abs(col_centers[i]-cx))
                assign[col_names[best]].append(t)
    has_section_col = 'section' in col_names
    section_tok = ''.join(assign.get('section', [])).lstrip('0') or '0'
    if has_section_col and not re.fullmatch(r'\d{3,5}', section_tok): return None
    for k in ('dept','subject','course'):
        v = ' '.join(assign.get(k, []))
        if v: cur[k] = v
    # fallback: merged header (e.g. 'DepartmDiscipliCourse') -> parse course info positionally
    if 'course' not in col_names or 'dept' not in col_names:
        if has_section_col:
            sec_center = col_centers[col_names.index('section')]
        else:
            sec_center = col_centers[instr_i]
        left = [w['text'] for w in ws if (w['x0']+w['x1'])/2 < sec_center - 5 and not re.fullmatch(r'\d{5,7}', w['text'])]
        if left:
            num_i = None
            for i in range(len(left)-1, -1, -1):
                if re.fullmatch(r'[A-Z]*\d+[A-Z]?', left[i]):
                    num_i = i; break
            if num_i is not None:
                subj = None
                for i in range(num_i-1, -1, -1):
                    if re.fullmatch(r"[A-Za-z&']+", left[i]):
                        subj = left[i]; break
                course = f"{subj} {left[num_i]}" if subj else left[num_i]
                dept = left[0] if left[0] != subj else None
                if course: cur['course'] = course
                if dept and not cur['dept']: cur['dept'] = dept
    instr = re.sub(r'^\d+\s+', '', ' '.join(assign.get('instructor', [])))
    if not instr: return None
    nums.sort()
    # right-anchor: last token to 'total' if close
    anchored_total = None
    if any(n=='total' for _,n in grade_cols) and nums:
        total_center = [c for n,c in cols if n=='total'][0]
        cx, v = nums[-1]
        if abs(cx - total_center) < 60:
            anchored_total = v; nums = nums[:-1]
    N = len(nums); gc = [(i,n) for i,n in grade_cols if n != 'total']; M = len(gc)
    @lru_cache(maxsize=None)
    def dp(i, j):
        if i == N: return 0.0
        if j == M: return 1e9
        cx, v = nums[i]; gi, gn = gc[j]
        return min(abs(cx-col_centers[gi]) + dp(i+1, j+1), SKIP_PENALTY + dp(i, j+1))
    grades = {n: 0 for _, n in grade_cols}
    i = j = 0
    max_dev = 0.0
    while i < N and j < M:
        gi, gn = gc[j]; cx, v = nums[i]
        if abs(cx-col_centers[gi]) + dp(i+1, j+1) <= SKIP_PENALTY + dp(i, j+1):
            grades[gn] = v
            max_dev = max(max_dev, abs(cx-col_centers[gi]))
            i += 1; j += 1
        else:
            j += 1
    if max_dev > 15.0:
        problems.append((semester, pno, f'column deviation {max_dev:.0f}px', joined))
        return None
    if i < N:
        problems.append((semester, pno, 'unassigned nums', joined)); return None
    if anchored_total is not None: grades['total'] = anchored_total
    gsum = sum(v for n, v in grades.items() if n not in ('total','count'))
    if grades.get('total', 0) == 0 and gsum == 0: return None
    if 'total' in grades and gsum != grades['total']:
        problems.append((semester, pno, f'sum {gsum} != total {grades["total"]}', joined))
    return dict(semester=semester, dept=cur['dept'], subject=cur['subject'], course=cur['course'],
                section=section_tok if has_section_col else None, instructor=instr, grades=grades)

def parse_pdf(path, semester):
    sections, problems = [], []
    cols = None
    cur = {'dept':None,'subject':None,'course':None}
    with pdfplumber.open(path) as pdf:
        for pno, page in enumerate(pdf.pages, 1):
            words = page.extract_words(x_tolerance=2)
            lines = defaultdict(list)
            for w in words: lines[round(w['top']/3)].append(w)
            keys = sorted(lines)
            li = 0
            while li < len(keys):
                ws = sorted(lines[keys[li]], key=lambda w: w['x0'])
                texts = [w['text'] for w in ws]
                jl = ' '.join(texts).lower()
                h = detect_header(ws)
                if h: cols = h; li += 1; continue
                if cols is None or 'santa monica college' in jl or 'grade distribution' in jl or 'grand' in jl or jl.startswith('page '):
                    li += 1; continue
                # merge following lines that are numeric-only within the grade zone (max 3 extra)
                col_names0 = [c[0] for c in cols]; col_centers0 = [c[1] for c in cols]
                fg = [c for n,c in cols if n in GRADE_SET][0]
                bnd = (dict(cols)['instructor'] + fg) / 2
                merged = list(ws)
                look = li + 1
                extra = 0
                while look < len(keys) and extra < 3:
                    nws = sorted(lines[keys[look]], key=lambda w: w['x0'])
                    if not nws: look += 1; continue
                    ntexts = [w['text'] for w in nws]
                    all_num_gradezone = all(re.fullmatch(r'\d+', t) for t in ntexts) and \
                        all((w['x0']+w['x1'])/2 >= bnd for w in nws)
                    if all_num_gradezone and ntexts:
                        merged += nws; look += 1; extra += 1
                    else:
                        break
                if not any(re.fullmatch(r'\d+', w['text']) for w in merged):
                    li += 1; continue
                joined = ' '.join(w['text'] for w in sorted(merged, key=lambda w: (round(w['top']/3), w['x0'])))
                r = row_from(merged, cols, cur, semester, pno, joined, problems)
                if r: sections.append(r)
                li = look if extra > 0 else li + 1
    return sections, problems

all_s, all_p = [], []
for f, sem in FILES.items():
    s, p = parse_pdf(os.path.join('pdfs', f), sem)
    all_s += s; all_p += p
    print(f"{sem}: {len(s)} sections, {len(p)} problems")
print('TOTAL rows:', len(all_s))
print('instructors:', len(set(s['instructor'] for s in all_s)))
print('courses:', len(set((s['dept'], s['course']) for s in all_s)))
print('problems:', len(all_p))
json.dump(all_s, open('sections.json','w'))
for p in all_p[:6]: print('PROB:', p[0], p[1], p[2], '|', p[3][:110])
