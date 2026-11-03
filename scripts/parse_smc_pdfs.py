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
TEXT_COLS = {'department':'dept','dept':'dept','subject':'subject','course':'course','section':'section','sect':'section',
             'instructor':'instructor','departmentdiscipline':'dept','discipline':'dept'}
GRADE_SET = {'a','b','c','d','f','p','np','rd','ix','w','ew','ip','sp','total','count'}
SKIP_PENALTY = 10.0
MAX_DEV = 18.0  # hard cap: a number may only bind to a column within 18px

SPLIT_TOKENS = {
 'sectioninstructor': ['section','instructor'],
 'coursesection': ['course','section'],
 'coursesectioninstructor': ['course','section','instructor'],
 'subjectcourse': ['subject','course'],
 'sectioninstructora': ['section','instructor','a'],
}
def expand_merged(ws):
    out = []
    for w in ws:
        t = w['text'].lower()
        if t in SPLIT_TOKENS:
            parts = SPLIT_TOKENS[t]
            width = w['x1'] - w['x0']; total_chars = sum(len(p) for p in parts)
            acc = 0
            for p in parts:
                c = w['x0'] + width * (acc + len(p)/2) / total_chars
                out.append({'text': p, 'x0': c - 1, 'x1': c + 1, 'top': w['top']})
                acc += len(p)
        else:
            out.append(w)
    return out

def detect_header(ws):
    ws = expand_merged(ws)
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
        def is_sec_tok(w):
            cx = (w['x0']+w['x1'])/2
            return bool(re.fullmatch(r'\d{4,7}', w['text'])) and abs(cx - sec_center) < 40
        left = [w['text'] for w in ws if (w['x0']+w['x1'])/2 < sec_center - 5 and not is_sec_tok(w)]
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
        dev = abs(cx-col_centers[gi])
        match_cost = (dev if dev <= MAX_DEV else 1e9) + dp(i+1, j+1)
        return min(match_cost, SKIP_PENALTY + dp(i, j+1))
    grades = {n: 0 for _, n in grade_cols}
    i = j = 0
    max_dev = 0.0
    while i < N and j < M:
        gi, gn = gc[j]; cx, v = nums[i]
        dev = abs(cx-col_centers[gi])
        match_cost = (dev if dev <= MAX_DEV else 1e9) + dp(i+1, j+1)
        if dev <= MAX_DEV and match_cost <= SKIP_PENALTY + dp(i, j+1):
            grades[gn] = v
            max_dev = max(max_dev, dev)
            i += 1; j += 1
        else:
            j += 1
    if max_dev > MAX_DEV:
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
            # cluster words into lines by vertical gap (<=4px same line)
            words_by_top = sorted(words, key=lambda w: w['top'])
            lines = defaultdict(list)
            li_idx = -1; last_top = None
            for w in words_by_top:
                if last_top is None or w['top'] - last_top > 4:
                    li_idx += 1
                lines[li_idx].append(w)
                if last_top is None or w['top'] - last_top > 4:
                    last_top = w['top']
            keys = sorted(lines)
            li = 0
            while li < len(keys):
                ws = sorted(lines[keys[li]], key=lambda w: w['x0'])
                texts = [w['text'] for w in ws]
                jl = ' '.join(texts).lower()
                h = detect_header(ws)
                if h:
                    # (c) recalibrate: right-aligned numbers sit systematically right of
                    # centered header letters. Find global shift anchored on the total
                    # column (always populated, rightmost) minimizing alignment error.
                    gc_idx = [k for k, (n, c) in enumerate(h) if n in GRADE_SET]
                    names = [h[k][0] for k in gc_idx]
                    centers = [h[k][1] for k in gc_idx]
                    if gc_idx:
                        lo = min(centers) - 50
                        xs = sorted((w['x0'] + w['x1']) / 2 for w in words
                                    if re.fullmatch(r'\d+', w['text']) and (w['x0'] + w['x1']) / 2 >= lo)
                        clusters = []
                        for x in xs:
                            if clusters and x - clusters[-1][-1] <= 9:
                                clusters[-1].append(x)
                            else:
                                clusters.append([x])
                        means = [sum(c) / len(c) for c in clusters if len(c) >= 2]
                        if len(means) >= 3:
                            if 'total' in names:
                                tc = centers[names.index('total')]
                                s0 = means[-1] - tc
                            else:
                                s0 = max(-40.0, min(45.0, sum(means)/len(means) - sum(centers)/len(centers)))
                            score0 = sum(min(abs(m - c) for c in centers) for m in means)
                            best = None
                            for s_cand in [s0 + d for d in range(-14, 15)]:
                                if abs(s_cand) > 45: continue
                                score = sum(min(abs(m - (c + s_cand)) for c in centers) for m in means)
                                if best is None or score < best[0] or (score == best[0] and abs(s_cand) < abs(best[1])):
                                    best = (score, s_cand)
                            if best and abs(best[1]) >= 6 and best[0] < 0.5 * score0:
                                sh = best[1]
                                h = [(n, c + sh) if n in GRADE_SET else (n, c) for n, c in h]
                    cols = h; li += 1; continue
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

import sys
if len(sys.argv) > 1 and sys.argv[1] != 'all':
    targets = {k: v for k, v in FILES.items() if v == sys.argv[1]}
else:
    targets = FILES
for f, sem in targets.items():
    s, p = parse_pdf(os.path.join('pdfs', f), sem)
    safe = sem.replace(' ', '_')
    json.dump(s, open(f'sections_{safe}.json','w'))
    json.dump(p, open(f'problems_{safe}.json','w'))
    print(f"{sem}: {len(s)} sections, {len(p)} problems -> sections_{safe}.json")
