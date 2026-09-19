"""
Turn a month's biometric export into apps/api/prisma/real-attendance.ts.

Run from the repository root, after 05-gaps.py so the roster carries the names
HR corrected:

    python3 scripts/import/06-attendance.py "<the machine's export>.xls"

WHICH MONTH. The report's own header says "For Period : 1-Jan-2026 To
30-Jun-2026", which is the filter somebody typed, not the month on the page. The
grid has thirty day-columns and the footer says it was printed on 01/07/2026. Of
the months in that range only April and June have thirty days, and a monthly
report printed on the 1st of July is the month that just ended. So: June 2026.
Stated here rather than inferred silently, because if it is wrong every row is
filed under the wrong month.

DATES CARRY THE YEAR. The column is a display string and the key is (person,
date), so "01 Jun" would collide with next June. "01 Jun 2026".

MATCHING. The machine keeps its own numbering and its own spelling of people's
names. Neither is an employee ID, so the first import has to join on the name —
and a loose fuzzy match is exactly the wrong tool: run carelessly it pairs
"Rohit" with "Mohit" while the real Mohit sits three rows down. The rules below
are narrow and stated in order, and anything they do not cover is HELD BACK for
somebody who knows these people to settle. Once matched, the machine's number is
written to Person.biometricId and every export after this one joins on the
number instead.
"""
import json, re, subprocess, sys, unicodedata

import xlrd

SRC = sys.argv[1] if len(sys.argv) > 1 else 'Admin in out - attendance sheet.xls'
OUT = 'apps/api/prisma/real-attendance.ts'
MONTH, YEAR = 'Jun', 2026
SOURCE = f'Secureye ONtime — {MONTH} {YEAR}'

# The roster as it stands AFTER the gap workbook, so the machine's "Ravinder"
# is matched against the name HR confirmed rather than the one the register had.
_dump = subprocess.run(
    ['node_modules/.bin/tsx', '-e',
     "import {REAL_PEOPLE} from './apps/api/prisma/real-data.ts';"
     "import {GAP_PEOPLE} from './apps/api/prisma/real-gaps.ts';"
     "const fix = new Map(GAP_PEOPLE.filter(g => g.name).map(g => [g.id, g.name]));"
     "process.stdout.write(JSON.stringify(REAL_PEOPLE.map(p => "
     "({id: p.id, name: fix.get(p.id) ?? p.name, dept: p.dept,"
     " shiftIn: p.shiftIn || '09:30', shiftOut: p.shiftOut || '18:30'}))))"],
    capture_output=True, text=True, check=True).stdout
roster = json.loads(_dump)


def norm(s):
    s = unicodedata.normalize('NFKC', str(s or '')).lower()
    return re.sub(r'\s+', ' ', re.sub(r'[^a-z ]', ' ', s)).strip()


def squash(s):
    """Spacing, doubled letters and order removed — for 'same person?' tests."""
    return ''.join(sorted(re.sub(r'(.)\1+', r'\1', norm(s)).replace(' ', '')))


def dist(a, b):
    """Edit distance, but it gives up past 1 — nothing here wants a loose match."""
    if abs(len(a) - len(b)) > 1:
        return 2
    prev = list(range(len(b) + 1))
    for i, ca in enumerate(a, 1):
        cur = [i]
        for j, cb in enumerate(b, 1):
            cur.append(min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (ca != cb)))
        prev = cur
    return prev[-1]


first = {}
for p in roster:
    first.setdefault(norm(p['name']).split(' ')[0], []).append(p)

sh = xlrd.open_workbook(SRC).sheet_by_index(0)
machine = [(str(sh.cell_value(r, 0)).strip(), str(sh.cell_value(r, 1)).strip())
           for r in range(9, sh.nrows)
           if str(sh.cell_value(r, 0)).strip().isdigit() and str(sh.cell_value(r, 1)).strip()]

matched, held = [], []
for code, name in machine:
    nk, sk = norm(name), squash(name)
    hit, why = next((p for p in roster if norm(p['name']) == nk), None), 'name matches exactly'

    if not hit:
        # Same letters once spacing, doubling and order are taken out.
        cands = [p for p in roster if squash(p['name']) == sk]
        if len(cands) == 1:
            hit, why = cands[0], 'same name, spelled differently'

    if not hit:
        # The machine drops a middle name: first and last both match, uniquely.
        parts = nk.split(' ')
        if len(parts) >= 2:
            cands = [p for p in roster
                     if norm(p['name']).split(' ')[0] == parts[0]
                     and norm(p['name']).split(' ')[-1] == parts[-1]]
            if len(cands) == 1:
                hit, why = cands[0], 'first and last name match; middle name dropped'

    if not hit:
        # One side has no surname at all, and the first name is unique.
        cands = first.get(nk.split(' ')[0], [])
        if len(cands) == 1:
            a, b = nk.split(' '), norm(cands[0]['name']).split(' ')
            if len(a) == 1 or len(b) == 1:
                hit, why = cands[0], 'only a first name given, and it is unique on the roster'

    if not hit and len(nk.split(' ')) >= 2:
        # Last resort, and last on purpose: a single typo somewhere in a full
        # name. On its own this rule would pair "Rohit" with "Mohit" — one letter
        # apart, two different people — so it runs only after the others have
        # failed, both sides must carry a surname, and exactly one person on the
        # roster may be that close.
        cands = [p for p in roster
                 if len(norm(p['name']).split(' ')) >= 2 and dist(nk, norm(p['name'])) <= 1]
        if len(cands) == 1:
            hit, why = cands[0], 'one letter apart, and nobody else is close'

    if hit:
        matched.append({'code': code, 'machineName': name, 'id': hit['id'],
                        'rosterName': hit['name'], 'dept': hit['dept'], 'why': why})
    else:
        near = [p['name'] for p in first.get(nk.split(' ')[0], [])]
        held.append({'code': code, 'machineName': name, 'candidates': near,
                     'why': 'nobody on the roster by that name' if not near
                            else 'more than one possible person, or the surnames disagree'})

# ---------------------------------------------------------------- the grid
by_code = {m['code']: m for m in matched}
shift = {p['id']: (p['shiftIn'], p['shiftOut']) for p in roster}
mins = lambda t: int(t[:2]) * 60 + int(t[3:])

rows, stats = [], {'full': 0, 'absent': 0, 'inferredIn': 0, 'inferredOut': 0}
for r in range(9, sh.nrows):
    code = str(sh.cell_value(r, 0)).strip()
    if code not in by_code:
        continue
    pid = by_code[code]['id']
    si, so = shift.get(pid, ('09:30', '18:30'))
    for c in range(2, sh.ncols):
        day, v = str(sh.cell_value(8, c)).strip(), str(sh.cell_value(r, c)).strip()
        if not day.isdigit() or not v:
            continue
        date = f'{int(day):02d} {MONTH} {YEAR}'
        if v == 'A':
            rows.append({'personId': pid, 'date': date, 'in': None, 'out': None})
            stats['absent'] += 1
        elif '\n' in v:
            a, b = v.split('\n')[:2]
            rows.append({'personId': pid, 'date': date, 'in': a, 'out': b})
            stats['full'] += 1
        else:
            # One punch where the machine expected two. The export does not say
            # which end went unrecorded, so it is decided by which end of that
            # person's own shift the time is nearer — worked out, not read.
            near_in = abs(mins(v) - mins(si)) <= abs(mins(v) - mins(so))
            rows.append({'personId': pid, 'date': date,
                         'in': v if near_in else None, 'out': None if near_in else v})
            stats['inferredIn' if near_in else 'inferredOut'] += 1

ts = lambda o: json.dumps(o, ensure_ascii=False, indent=2)
open(OUT, 'w').write(f'''/**
 * {SOURCE}, from the attendance machine's own export.
 *
 * Every row is a day the machine recorded. Nothing is filled in for a day it
 * did not: a person who is not on the machine has no rows here rather than
 * thirty blank ones.
 *
 * Regenerate with scripts/import/06-attendance.py — do not hand-edit.
 */

export const ATTENDANCE_SOURCE = {json.dumps(SOURCE)};

/** The machine's own roll number against the employee ID, matched once by name. */
export const REAL_BIOMETRIC = {ts([{'code': m['code'], 'id': m['id'],
                                    'machineName': m['machineName'], 'why': m['why']}
                                   for m in matched])} as const;

/** `in` and `out` are null where the machine recorded nothing. */
export const REAL_ATTENDANCE = {ts(rows)} as const;

/**
 * On the machine, not matched to anybody. Held back rather than guessed — one of
 * these is present on 28 of 30 days, so somebody is working and not being paid
 * against a record.
 */
export const ATTENDANCE_HELD = {ts(held)} as const;
''')

print(f'{len(machine)} on the machine  ·  {len(matched)} matched  ·  {len(held)} held back')
print(f'{len(rows)} rows, {MONTH} {YEAR} -> {OUT}')
for k, v in stats.items():
    print(f'   {k:<12} {v}')
print('\nHELD BACK — for somebody who knows them to settle')
for h in held:
    c = ', '.join(h['candidates']) if h['candidates'] else '—'
    print(f'   {h["code"]:>3}  {h["machineName"]:<22} {h["why"]}   [{c}]')
