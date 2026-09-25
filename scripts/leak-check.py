"""
Prove the shareable preview carries no regulated data.

A preview is a URL, and a URL can be forwarded. So the rule is not "hidden in
the UI" but ABSENT FROM THE FILE: there must be nothing to recover by opening
devtools. This reads every regulated value straight out of the database and
looks for it in what the preview actually ships. Salaries are checked as whole
breakups rather than single figures, and the collections that carry them are
checked for being empty at all.

    python3 scripts/leak-check.py [apps/web/src/preview/data.ts ...]

With no arguments it checks the generated preview payload and, if it has been
built, the published bundle. Exit status is 1 if anything is found.
"""
import json, os, re, subprocess, sys

TARGETS = sys.argv[1:] or [
    p for p in ('apps/web/src/preview/data.ts', 'dist/marbella-preview.html')
    if os.path.exists(p)
]

SQL = r"""
select 'aadhaar', replace(aadhaar,' ','') from kyc where aadhaar <> ''
union all select 'aadhaar', aadhaar from kyc where aadhaar <> ''
union all select 'pan', pan from kyc where pan <> ''
union all select 'address', address from kyc where length(address) > 12
union all select 'mobile', phone from contact where length(regexp_replace(phone,'\D','','g')) >= 10
union all select 'personal email', email from contact where email <> ''
union all select 'salary', basic::text from salary where basic > 0
union all select 'salary', hra::text from salary where hra > 0
union all select 'device imei', imei from device where imei <> ''
union all select 'device sim', sim from device where length(regexp_replace(sim,'\D','','g')) >= 10
union all select 'biometric number', "biometricId" from person where "biometricId" is not null
union all select 'resident address', address from unit where length(address) > 12
union all select 'resident mobile', phone1 from unit where length(regexp_replace(phone1,'\D','','g')) >= 10
union all select 'resident mobile', phone2 from unit where length(regexp_replace(phone2,'\D','','g')) >= 10
union all select 'resident email', email1 from unit where email1 <> ''
union all select 'resident email', email2 from unit where email2 <> ''
union all select 'applicant name', name from applicant where length(name) > 7
union all select 'company gstin', gstin from company where gstin <> ''
"""

url = os.environ.get('DATABASE_URL') or ''
if not url:
    for line in open('apps/api/.env'):
        if line.startswith('DATABASE_URL'):
            url = line.split('=', 1)[1].strip().strip('"')
# Prisma writes ?schema=public on the end; psql refuses a query parameter it
# does not know, and the refusal reads like a connection failure.
url = url.split('?')[0]

rows = subprocess.run(['psql', url, '-At', '-F', '\t', '-c', SQL],
                      capture_output=True, text=True, check=True).stdout.splitlines()

values = {}
for line in rows:
    if '\t' not in line:
        continue
    kind, v = line.split('\t', 1)
    v = v.strip()
    # Short values match by coincidence — a four-digit salary is a substring of
    # half the timestamps in the file. Only check what is long enough to be a
    # real identifier, and check a phone number by its digits alone, since the
    # file may write it with spaces or a country code.
    if len(v) >= 8:
        values.setdefault(v, kind)
        if kind in ('mobile', 'device sim'):
            for one in re.split(r'[/,;\s]+', v):
                d = re.sub(r'\D', '', one)
                if len(d) >= 10:
                    values.setdefault(d, kind)

# --------------------------------------------------------------- salary
# A salary is four or five digits, and the substring search above deliberately
# skips anything that short: 21500 is inside half the timestamps in the file.
# So salaries get their own test — the whole BREAKUP at once. Five figures that
# all appear in one file by coincidence does not happen, and a pay run carries
# every one of them for every person, which is how a payroll leak would look.
BREAKUP = """
select "personId", basic, hra, special, travel, medical, gross from salary
"""
breakups = []
for line in subprocess.run(['psql', url, '-At', '-F', '\t', '-c', BREAKUP],
                           capture_output=True, text=True, check=True).stdout.splitlines():
    cells = line.split('\t')
    if len(cells) < 7:
        continue
    figures = sorted({int(c) for c in cells[1:] if c.isdigit() and int(c) > 999})
    if len(figures) >= 3:
        breakups.append((cells[0], figures))


def salary_hits(text):
    """People whose every salary figure is present in the file as a bare number."""
    out = []
    for pid, figures in breakups:
        if all(re.search(rf'(?<![0-9.]){n}(?![0-9.])', text) for n in figures):
            out.append((pid, figures))
    return out


# --------------------------------------------------------------- shape
# Belt and braces. The searches above prove particular values are absent; this
# proves the COLLECTIONS that carry them are empty, so a new money-bearing key
# added to the payload cannot ride out to the preview unnoticed.
MUST_BE_EMPTY = ('salaries', 'payRuns')


def shape_problems(text):
    out = []
    try:
        start = text.index('{"people"')
        world = json.loads(text[start:text.rindex('}') + 1])
    except (ValueError, json.JSONDecodeError):
        return out          # the built bundle is minified; the payload check covers it
    for k in MUST_BE_EMPTY:
        if world.get(k):
            out.append(f'{k} is not empty — it carries {len(world[k])} entries')
    for p in world.get('people', []):
        for k in ('aadhaar', 'pan', 'address', 'kyc'):
            if p.get(k):
                out.append(f'person {p.get("id")} still carries {k}')
    for d in world.get('devices', []):
        if d.get('imei'):
            out.append(f'device {d.get("id")} still carries an IMEI')
    return out


bad = 0
for target in TARGETS:
    text = open(target, encoding='utf-8', errors='replace').read()
    hits = sorted({(k, v) for v, k in values.items() if v in text})
    sal = salary_hits(text)
    shape = shape_problems(text)
    print(f'{target}: {len(values)} regulated values, {len(breakups)} salary breakups '
          f'and {len(MUST_BE_EMPTY)} collections checked — '
          f'{len(hits) + len(sal) + len(shape)} found')
    for kind, v in hits[:40]:
        print(f'   LEAK  {kind}: {v}')
    for pid, figures in sal[:20]:
        print(f'   LEAK  salary breakup for {pid}: {figures}')
    for problem in shape[:20]:
        print(f'   LEAK  {problem}')
    bad += len(hits) + len(sal) + len(shape)

if not TARGETS:
    print('nothing to check — build the preview first')
sys.exit(1 if bad else 0)
