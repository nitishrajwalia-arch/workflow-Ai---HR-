"""
Fold HR's filled-in data-gap workbook back into the seed.

`real-data.ts` is what the company's own registers say. This produces
`real-gaps.ts`, which is what HR confirmed on top of them, and the seed applies
the second over the first. Keeping them apart means every field in the database
can still be traced to the sheet it came from, and the next filled workbook is
a re-run of this script rather than a rewrite of a 14,000-line file.

Run from the repository root:

    python3 scripts/import/05-gaps.py "<the filled workbook>.xlsx" ["<the company master>.xlsx"]

The second argument is optional. Give it and the run also recovers the rows the
first import held back — a KYC record and an issued desktop that were filed
under a name the master list did not carry — once the gap sheet has said who
those rows actually belong to.

Nothing is guessed. A cell that reads "Not Given", or is blank, leaves the
field alone. Anything the sheet says that contradicts what is on file is
written to the CONFLICTS list at the bottom of the generated file rather than
silently resolved.
"""
import json, re, subprocess, sys, unicodedata
from datetime import date, datetime

import openpyxl

SRC = sys.argv[1] if len(sys.argv) > 1 else 'Marbella Group - Employee Data Gaps (filled).xlsx'
MASTER = sys.argv[2] if len(sys.argv) > 2 else ''
OUT = 'apps/api/prisma/real-gaps.ts'

# The date HR signed the answers on sheet 3. Stamped on every policy row so the
# screen can say who decided and when instead of presenting a number as fact.
CONFIRMED_ON = '18 Sep 2026'

wb = openpyxl.load_workbook(SRC, data_only=True)
conflicts: list[str] = []
notes: list[str] = []


def txt(v) -> str:
    """A cell as text. Excel hands back datetimes for anything that looks like
    a date or a time, including plain "18:30" typed into a column of strings."""
    if v is None:
        return ''
    if isinstance(v, datetime):
        return v.strftime('%H:%M') if (v.year, v.month, v.day) == (1900, 1, 1) else v.strftime('%d %b %Y')
    if isinstance(v, date):
        return v.strftime('%d %b %Y')
    return re.sub(r'\s+', ' ', unicodedata.normalize('NFKC', str(v))).strip()


# "Not Given" is HR answering the question — they asked and there is no address.
# It is not an email. Same for the dashes people type to mean the same thing.
BLANK = {'', '-', '--', '—', 'n/a', 'na', 'nil', 'none', 'not given', 'not available'}


def val(v) -> str:
    s = txt(v)
    return '' if s.lower() in BLANK else s


def rows(ws, first=4):
    """Every data row, skipping the department banners — a banner carries a
    department name in column A and nothing in column B."""
    for r in range(first, ws.max_row + 1):
        if not txt(ws.cell(r, 2).value):
            continue
        yield r, [ws.cell(r, c).value for c in range(1, ws.max_column + 1)]


# ------------------------------------------------------------------ directors
#
# Four rows point at a director rather than at an employee ID. The directors are
# not on the payroll register and inventing employee records for them would put
# four people on the headcount who are not staff, so the line is kept as text on
# the person and the org chart renders it as text.
DIRECTORS = {
    'managing director(deepak garg)': 'Managing Director (Deepak Garg)',
    'managing director(rajesh walia)': 'Managing Director (Rajesh Walia)',
    'managing director(rajesh walia,deepak garg,girish goel,parveen garg)':
        'Managing Directors (Rajesh Walia, Deepak Garg, Girish Goel, Parveen Garg)',
    'managing director rajesh walia,deepak garg,girish goel, parveen garg)':
        'Managing Directors (Rajesh Walia, Deepak Garg, Girish Goel, Parveen Garg)',
}

GENDERS = {'male': 'male', 'female': 'female', 'other': 'other',
           'prefers not to say': 'undisclosed', 'undisclosed': 'undisclosed'}

# ------------------------------------------------------------ 1. People
ws = wb['1. People']
people, seen_phone, seen_email = [], {}, {}
dept_of, name_of = {}, {}
for r, c in rows(ws):
    pid = txt(c[1])
    rec: dict = {'id': pid}
    name_of[pid] = txt(c[2])
    rec['name'] = txt(c[2])
    rec['designation'] = txt(c[3])
    g = val(c[8]).lower()
    if g:
        if g not in GENDERS:
            conflicts.append(f'{pid}: gender reads "{val(c[8])}", which is not one of the four allowed answers. Left unset.')
        else:
            rec['gender'] = GENDERS[g]
    email = val(c[9])
    if email:
        if not re.fullmatch(r'[^@\s]+@[^@\s]+\.[A-Za-z]{2,}', email):
            conflicts.append(f'{pid} ({rec["name"]}): "{email}" is not a usable email address. Left unset.')
        else:
            rec['email'] = email
            seen_email.setdefault(email.lower(), []).append(pid)
    phone = val(c[7])
    if phone:
        rec['phone'] = phone
        for one in (x.strip() for x in re.split(r'[/,;]+', phone)):
            digits = re.sub(r'\D', '', one)
            if one and not re.fullmatch(r'[6-9]\d{9}', one):
                why = (f'it is {len(digits)} digits' if len(digits) != 10
                       else 'it does not start with 6, 7, 8 or 9')
                conflicts.append(f'{pid} ({rec["name"]}): the mobile on file cannot be dialled — '
                                 f'{why}. It was checked off as correct on the sheet.')
        for one in re.split(r'[/,;]+', phone):
            one = one.strip()
            if one:
                seen_phone.setdefault(one, []).append(pid)
    boss = val(c[10])
    if boss:
        if boss.lower() in DIRECTORS:
            rec['reportsToNote'] = DIRECTORS[boss.lower()]
        elif boss == pid:
            conflicts.append(f'{pid} ({rec["name"]}): sheet 1 has them reporting to themselves. Taken from sheet 2 instead.')
        elif re.fullmatch(r'MB-[A-Z]{2,3}-\d{4}', boss):
            rec['reportsTo'] = boss
        else:
            conflicts.append(f'{pid} ({rec["name"]}): "{boss}" in Reports To is neither an employee ID nor a director. Left unset.')
    flag = val(c[11])
    if flag and flag.lower() not in ('no', 'n'):
        notes.append(f'{pid} ({rec["name"]}): marked "{flag}" in the Anything Wrong? column.')
    people.append(rec)

# ------------------------------------------------- 2. No Manager (authoritative)
#
# Sheet 2 asks only about the twenty people with nobody above them, so where it
# and sheet 1 disagree — the three department heads who were left pointing at
# themselves on sheet 1 — sheet 2 is the answer to the question that was asked.
byid = {p['id']: p for p in people}
for r, c in rows(wb['2. No Manager']):
    pid, boss = txt(c[1]), val(c[4])
    p = byid.get(pid)
    if not p or not boss:
        continue
    if boss.lower() in DIRECTORS:
        p.pop('reportsTo', None)
        p['reportsToNote'] = DIRECTORS[boss.lower()]
    elif re.fullmatch(r'MB-[A-Z]{2,3}-\d{4}', boss) and boss != pid:
        p.pop('reportsToNote', None)
        p['reportsTo'] = boss

# ------------------------------------------------------------ 3. Leave Rules
#
# Keyed on the question, not on the row number, so inserting a row on the sheet
# does not silently shuffle the answers.
answers = {}
for r, c in rows(wb['3. Leave Rules']):
    answers[txt(c[1]).lower()] = val(c[3])


def ask(*words) -> str:
    """The answer to the one question containing all of these words."""
    hits = [v for k, v in answers.items() if all(w in k for w in words)]
    if len(hits) != 1:
        conflicts.append(f'Leave rules: {len(hits)} questions match {words!r}. Left unset.')
        return ''
    return hits[0]


def num(s: str) -> int:
    m = re.search(r'\d+', s)
    return int(m.group()) if m else 0


LEAVE = {
    'casual': num(ask('casual leave')),
    'sick': num(ask('sick leave')),
    'earned': num(ask('earned')),
    'lateAfter': num(ask('late mark after')),
    'lateStrikes': num(ask('late marks equal')),
    'carryForward': ask('carry').lower().startswith('yes'),
    'encashable': ask('encashed').lower().startswith('yes'),
    'probation': ask('probation'),
    'maternityWeeks': num(ask('maternity')),
    'paternityDays': num(ask('paternity')),
    'notice': ask('notice period'),
    # "Do the rules differ by department?" — answered No, so one set covers all.
    'sameEverywhere': ask('differ by department').lower().startswith('no'),
    'setBy': 'HR Department',
    'setOn': CONFIRMED_ON,
}
if not LEAVE['sameEverywhere']:
    conflicts.append('Leave rules: sheet 3 says the rules differ by department but gives only one set. '
                     'Loaded for every department.')

# --------------------------------------------------------------- 4. Holidays
MONTHS = 'Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec'.split()
holidays = []
for r, c in rows(wb['4. Holidays']):
    name, when = txt(c[1]), txt(c[2])
    if not name or not when:
        continue
    m = re.fullmatch(r'(\d{1,2}) ([A-Za-z]{3}) (\d{4})', when)
    if not m:
        conflicts.append(f'Holiday "{name}": the date reads "{when}", which is not a date. Left out.')
        continue
    iso = f'{m.group(3)}-{MONTHS.index(m.group(2).title()) + 1:02d}-{int(m.group(1)):02d}'
    closed = val(c[3]).lower().startswith('y')
    holidays.append({'name': name, 'on': when, 'onDate': iso, 'allSites': closed, 'note': val(c[4])})
if holidays and not any(h['allSites'] for h in holidays):
    conflicts.append(
        f'All {len(holidays)} holidays are marked "NO" under "Every Site Closed?", including the three '
        'national holidays. Loaded as written, but that is almost certainly the column being read the '
        'wrong way round.')

# ---------------------------------------------------------- 5. Working Hours
hours = {}
for r, c in rows(wb['5. Working Hours']):
    dept = txt(c[1])
    if not dept:
        continue
    answer, who = val(c[6]), val(c[7])
    note = ''
    if answer and 'weekly off' in answer.lower():
        note = 'HR confirmed a fixed weekly off. The sheet does not say which day it falls on.'
        notes.append(f'{dept}: the weekly off is confirmed but the sheet does not say which day it falls on.')
    hours[dept] = {
        'days': answer or txt(c[5]),
        'grace': LEAVE['lateAfter'],
        'setBy': who or 'HR Department',
        'setOn': CONFIRMED_ON,
        'note': note,
    }

# ------------------------------------------------------- 6. Job Descriptions
#
# Keyed by department AND title: "Assistant Manager" means three different jobs
# here and the sheet describes each of them separately.
jds, dept = [], ''
ws = wb['6. Job Descriptions']
for r in range(4, ws.max_row + 1):
    a, b = txt(ws.cell(r, 1).value), txt(ws.cell(r, 2).value)
    if a and not b:
        dept = a.replace(' DEPARTMENT', '').title().replace('Crm', 'CRM').replace('Hr', 'HR').replace('It', 'IT')
        continue
    if not b or not val(ws.cell(r, 4).value):
        continue
    jds.append({'dept': dept, 'role': b, 'jd': txt(ws.cell(r, 4).value)})

# ------------------------------------------------------ 7. Laptops & Phones
devices = []
for r, c in rows(wb['7. Laptops & Phones']):
    pid, kind = txt(c[1]), txt(c[3])
    imei, sim, still = val(c[5]), val(c[6]), val(c[7])
    if imei and not re.fullmatch(r'\d{15}', imei):
        conflicts.append(f'{pid}: IMEI "{imei}" is not fifteen digits. Left unset.')
        imei = ''
    devices.append({'id': pid, 'type': kind, 'model': txt(c[4]), 'imei': imei, 'sim': sim,
                    'returned': bool(still) and not still.lower().startswith('y')})

# ------------------------------------------------- what is on file already
#
# Read back real-data.ts so the run can say what actually CHANGES, rather than
# reporting 126 rows as though every one of them were news.
# Read through tsx rather than by parsing the file: real-data.ts is prettier-
# formatted TypeScript, not JSON, and a regex over it would be one reformat away
# from silently matching nothing.
_dump = subprocess.run(
    ['node_modules/.bin/tsx', '-e',
     "import {REAL_PEOPLE, REAL_PENDING} from './apps/api/prisma/real-data.ts';"
     "process.stdout.write(JSON.stringify({REAL_PEOPLE, REAL_PENDING}))"],
    capture_output=True, text=True, check=True).stdout
_real = json.loads(_dump)

ON_FILE = {p['id']: p for p in _real['REAL_PEOPLE']}
PENDING = {p['id']: p for p in _real['REAL_PENDING']}

renames, retitled = [], []
for p in people:
    was = ON_FILE.get(p['id'])
    if not was:
        conflicts.append(f'{p["id"]} ({p["name"]}) is on the sheet but not in the register. Left out.')
        continue
    if p['name'] != was['name']:
        renames.append({'id': p['id'], 'was': was['name'], 'now': p['name']})
    else:
        p.pop('name', None)
    if p['designation'] != was['designation']:
        retitled.append({'id': p['id'], 'was': was['designation'], 'now': p['designation']})
    else:
        p.pop('designation', None)
    # A phone the sheet repeats back unchanged is not a correction.
    if p.get('phone') and p['phone'] == was.get('phone'):
        p.pop('phone')

# Two reserved IDs were held for people who appeared on some sheets of the
# company file and not on the master list. HR has struck both rows off the gap
# sheet. Each one is accounted for by a rename above, on the same serial number
# and the same row of every sheet in the source, so the reserved ID is a second
# copy of somebody already on the payroll rather than a person nobody has
# entered. Resolved by evidence, not by the row having been deleted.
on_sheet = {p['id'] for p in people}
merges = []
for pid, rec in PENDING.items():
    if pid in on_sheet:
        continue
    same = [r for r in renames if r['was'].split()[0].lower() == rec['name'].split()[0].lower()
            or r['now'].lower() == rec['name'].lower()]
    if len(same) == 1:
        merges.append({'id': pid, 'name': rec['name'], 'into': same[0]['id'],
                       'as': same[0]['now'], 'evidence': rec['evidence']})
    else:
        conflicts.append(f'{pid} ({rec["name"]}) was struck off sheet 1 with nothing to say where they went. '
                         'Reserved ID kept, still unconfirmed.')

# The first import held back every row filed under a name the master list did
# not carry. Now that the gap sheet has said who those rows belong to, they can
# be attached — a KYC record and an issued desktop that have been sitting in the
# company file unaccounted for.
if MASTER and merges:
    mwb = openpyxl.load_workbook(MASTER, data_only=True)
    by_reserved = {m['id']: m for m in merges}

    def sheet_rows(name):
        """Rows keyed by column header. Every sheet in the master file has a
        different layout and a different header row, so position is not safe."""
        if name not in mwb.sheetnames:
            return
        ws = mwb[name]
        head, at = {}, 0
        for r in range(1, min(ws.max_row, 6) + 1):
            cells = [txt(ws.cell(r, c).value).lower() for c in range(1, ws.max_column + 1)]
            if 'employee id' in cells:
                head, at = {h: i for i, h in enumerate(cells) if h}, r
                break
        if not head:
            return
        for r in range(at + 1, ws.max_row + 1):
            cells = [txt(ws.cell(r, c).value) for c in range(1, ws.max_column + 1)]
            yield {h: cells[i] for h, i in head.items()}

    def pick(row, *names):
        for n in names:
            for h, v in row.items():
                if h.strip() == n:
                    return v
        return ''

    for row in sheet_rows('Employee KYC Details'):
        m = by_reserved.get(pick(row, 'employee id'))
        if m:
            m['carries'] = {'kind': 'kyc', 'aadhaar': pick(row, 'adhaar card', 'aadhaar card'),
                            'pan': pick(row, 'pancard no.'), 'address': pick(row, 'current address')}
    for row in sheet_rows('Asset List For Employee'):
        m = by_reserved.get(pick(row, 'employee id'))
        kind = pick(row, 'laptop/ desktop')
        if m and kind and kind.lower() not in BLANK:
            m['carries'] = {'kind': 'device', 'type': kind, 'model': pick(row, 'model/series no.'),
                            'issued': pick(row, 'handover date')}
    for m in merges:
        if 'carries' not in m:
            m['carries'] = None

# ---------------------------------------------------------- duplicate scan
# These are read on a screen and can end up in a preview that is a URL, so they
# name the employee ID and never quote the number or the address itself. Whoever
# reads it can open either record; nobody who should not have the number gets it
# from a sentence.
for phone, ids in sorted(seen_phone.items()):
    if len(ids) > 1:
        conflicts.append(f'The same mobile number is on {len(ids)} records: ' +
                         ', '.join(f'{i} ({name_of[i]})' for i in ids) +
                         '. At most one of them can be right.')
for email, ids in sorted(seen_email.items()):
    if len(ids) > 1:
        conflicts.append(f'The same personal email is on {len(ids)} records: ' +
                         ', '.join(f'{i} ({name_of[i]})' for i in ids) +
                         '. A shared address means one of them cannot be reached after they leave.')
# A correction that makes two people in one department share a name. They are
# still two people; it is the screens that key a list on a name which break.
after = {}
for p in people:
    was = ON_FILE.get(p['id'])
    if was:
        after.setdefault((was['dept'], p.get('name', was['name'])), []).append(p['id'])
for (dept, name), ids in after.items():
    if len(ids) > 1 and any(r['id'] in ids for r in renames):
        conflicts.append(f'{dept} now has two people called {name}: ' + ', '.join(ids) +
                         '. Correct if they really are two people; say so if they are not.')

# Two rows that agree on date of birth AND mobile are one person entered twice,
# whatever the spelling of the name says.
fingerprint: dict = {}
for pid, was in ON_FILE.items():
    key = (was.get('dob', ''), was.get('phone', ''))
    if all(key):
        fingerprint.setdefault(key, []).append(pid)
for (dob, phone), ids in fingerprint.items():
    if len(ids) > 1:
        who = ', '.join(f'{i} ({name_of.get(i, ON_FILE[i]["name"])}, {ON_FILE[i]["dept"]}, '
                        f'joined {ON_FILE[i]["joined"]})' for i in ids)
        conflicts.append(f'{len(ids)} records share a date of birth AND a mobile number: {who}. '
                         'Either one person entered twice, or a row copied from the one above it.')

ts = lambda o: json.dumps(o, ensure_ascii=False, indent=2)
open(OUT, 'w').write(f'''/**
 * What HR confirmed on the data-gap workbook, {CONFIRMED_ON}.
 *
 * `real-data.ts` is what the company's own registers say. This file is what HR
 * went and asked, and the seed applies it on top. They are kept apart so that
 * every field in the database can still be traced to the sheet it came from.
 *
 * Nothing here is guessed. A cell that was blank, or read "Not Given", leaves
 * the field alone rather than overwriting it with an empty string. Anything the
 * sheet says that contradicts what is on file is in GAP_CONFLICTS below, for
 * somebody to answer, rather than resolved quietly here.
 *
 * Regenerate with scripts/import/05-gaps.py — do not hand-edit.
 */

/** Per person. Only the keys present were answered; the rest are untouched. */
export const GAP_PEOPLE = {ts(people)} as const;

/** The leave rules, one set for every department — sheet 3 says they do not differ. */
export const GAP_LEAVE = {ts(LEAVE)} as const;

/** The holiday calendar, as supplied. Blank before this; the attendance rules were meaningless without it. */
export const GAP_HOLIDAYS = {ts(holidays)} as const;

/** Working days and the grace period, per department. Hours themselves were already on file. */
export const GAP_HOURS = {ts(hours)} as const;

/** Keyed by department and title, because one title means different jobs in different departments. */
export const GAP_JDS = {ts(jds)} as const;

/** IMEI and SIM against the devices already recorded as issued. */
export const GAP_DEVICES = {ts(devices)} as const;

/** Names the register had wrong. */
export const GAP_RENAMES = {ts(renames)} as const;

/** Titles the register had wrong. */
export const GAP_RETITLED = {ts(retitled)} as const;

/** Reserved IDs that turned out to be a second copy of somebody already on the payroll. */
export const GAP_MERGES = {ts(merges)} as const;

/** Read these. Nothing here was resolved by the importer. */
export const GAP_CONFLICTS = {ts(sorted(set(conflicts)))} as const;

/** Worth knowing, but nothing is blocked on them. */
export const GAP_NOTES = {ts(sorted(set(notes)))} as const;
''')

print(f'{len(people)} people, {len(holidays)} holidays, {len(hours)} departments, '
      f'{len(jds)} job descriptions, {len(devices)} devices -> {OUT}')
print(f'\ngender answered for {sum(1 for p in people if "gender" in p)} of {len(people)}')
print(f'personal email for  {sum(1 for p in people if "email" in p)} of {len(people)}')
print(f'manager or director {sum(1 for p in people if "reportsTo" in p or "reportsToNote" in p)} of {len(people)}')
print(f'renamed            {len(renames)}, retitled {len(retitled)}, merged away {len(merges)}')
for m in merges:
    print(f'   {m["id"]} {m["name"]} -> {m["into"]} {m["as"]}')
print(f'\nCONFLICTS ({len(set(conflicts))}):')
for c in sorted(set(conflicts)):
    print(f'  ! {c}')
print(f'\nNOTES ({len(set(notes))}):')
for n in sorted(set(notes)):
    print(f'  - {n}')
