"""
Prove the shareable preview carries no regulated data.

A preview is a URL, and a URL can be forwarded. So the rule is not "hidden in
the UI" but ABSENT FROM THE FILE: there must be nothing to recover by opening
devtools. This reads every regulated value straight out of the database and
looks for it in what the preview actually ships.

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

bad = 0
for target in TARGETS:
    text = open(target, encoding='utf-8', errors='replace').read()
    hits = sorted({(k, v) for v, k in values.items() if v in text})
    print(f'{target}: {len(values)} regulated values checked, {len(hits)} found')
    for kind, v in hits[:40]:
        print(f'   LEAK  {kind}: {v}')
    bad += len(hits)

if not TARGETS:
    print('nothing to check — build the preview first')
sys.exit(1 if bad else 0)
