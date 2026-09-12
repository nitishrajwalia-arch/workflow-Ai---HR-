"""
Turn the two uploaded workbooks into one clean JSON payload for the seed.

The join key is the person's NAME, because the source has no employee IDs. That
is fragile in exactly the way you would expect: names carry trailing spaces,
appear with and without a middle name, and two different people are both called
Gurpreet Singh. So the key is (name, department) and, where a department holds
two people of the same name, their position within that department's block.

Nothing is guessed. A row that will not join is reported, not merged.
"""
import json, re, unicodedata

SP = '/tmp/claude-0/-home-user/cb0a2051-f78c-52c0-9f1b-2651df4d7e3e/scratchpad'
raw = json.load(open(f'{SP}/real/raw.json'))

# Department names as the source spells them -> the name we store, and the
# infix used in employee IDs. Department names are structural (code branches on
# them), so they are normalised. Designations are NOT — see below.
DEPTS = {
    'sales': ('Sales', 'SAL'),
    'crm': ('CRM', 'CRM'),
    'account': ('Accounts', 'ACC'),
    'it': ('IT', 'IT'),
    'admin': ('Admin', 'ADM'),
    'pantry': ('Pantry', 'PAN'),
    'hr': ('HR', 'HR'),
    'marketing': ('Marketing', 'MKT'),
    'project': ('Project', 'PRJ'),
    'purchase': ('Purchase', 'PUR'),
    'maintainance': ('Maintenance', 'MNT'),   # spelled "Maintainance" in source
    'maintenance': ('Maintenance', 'MNT'),
    'horticulture': ('Horticulture', 'HRT'),
}

# Same person, spelled two ways across sheets. Confirmed by department and
# designation matching on both sides.
ALIASES = {
    'rohit birdi': 'rohit madanmohan birdi',
    'asha singh': 'assa singh',
}

def norm(s):
    s = unicodedata.normalize('NFKC', str(s or ''))
    return re.sub(r'\s+', ' ', s).strip()

def nkey(s):
    k = norm(s).lower()
    return ALIASES.get(k, k)

def dkey(s):
    k = re.sub(r'[^a-z]', '', norm(s).lower())
    return DEPTS.get(k, (norm(s), 'GEN'))

def cell(cells, i):
    return norm(cells[i]) if i < len(cells) else ''

# ---------------------------------------------------------------- master list
master = []
counts = {}
for row in raw['Employee Details']:
    c = row['cells']
    name = norm(c[1])
    if not name or name.lower() in ('na', 'n/a', '-'):
        continue
    dept, code = dkey(c[2] or row['banner'])
    k = (nkey(name), dept)
    counts[k] = counts.get(k, 0) + 1
    master.append({
        'name': name,
        'dept': dept,
        'code': code,
        'designation': norm(c[3]),   # verbatim, typos and all
        'dob': cell(c, 4),
        'doj': cell(c, 5),
        'occurrence': counts[k],
    })

# Employee IDs: department infix, then a sequence in the order the company
# listed them. Deterministic, so re-running the seed does not renumber anyone.
seq = {}
for p in master:
    seq[p['code']] = seq.get(p['code'], 0) + 1
    p['id'] = f"MB-{p['code']}-{seq[p['code']]:04d}"

index = {}
for p in master:
    index[(nkey(p['name']), p['dept'], p['occurrence'])] = p

def attach(sheet, namecol, deptcol, fields, banner_fallback=True):
    """Join a sheet onto the master roster. Returns the rows that would not join."""
    seen = {}
    orphans = []
    for row in raw[sheet]:
        c = row['cells']
        name = norm(c[namecol])
        if not name or name.lower() in ('na', 'n/a', '-'):
            continue
        dsrc = c[deptcol] if deptcol is not None and deptcol < len(c) else ''
        if not dsrc and banner_fallback:
            dsrc = row['banner'] or ''
        dept, _ = dkey(dsrc)
        k2 = (nkey(name), dept)
        seen[k2] = seen.get(k2, 0) + 1
        p = index.get((nkey(name), dept, seen[k2]))
        if p is None:
            orphans.append({'sheet': sheet, 'name': name, 'dept': dept})
            continue
        for target, col in fields.items():
            v = cell(c, col)
            if v and v.lower() not in ('na', 'n/a', '-'):
                p[target] = v
    return orphans

orphans = []
orphans += attach('Employee KYC Details', 1, 2,
                  {'phone': 4, 'officePhone': 5, 'aadhaar': 6, 'pan': 7, 'address': 8})
orphans += attach('Department Wise Timings', 1, 2, {'shiftIn': 4, 'shiftOut': 5})
# This sheet's headers read "Designation | Department" but the DATA is the
# other way round: column 3 holds "Sales", column 4 holds "Senior Manager".
# Joining on the header rather than the content matched nothing at all.
orphans += attach('Companies Wise Employee Salary ', 1, 2, {'company': 4})
orphans += attach('Department Wise List', 1, 2, {'project': 9})
orphans += attach('Asset List For Employee', 0, 1,
                  {'assetPhone': 3, 'phoneModel': 4, 'computerType': 5,
                   'computerModel': 6, 'assetHandover': 7})

json.dump({'people': master, 'orphans': orphans}, open(f'{SP}/real/people.json', 'w'), indent=1)

print(f'master roster: {len(master)} people')
by = {}
for p in master:
    by[p['dept']] = by.get(p['dept'], 0) + 1
for d, n in sorted(by.items(), key=lambda x: -x[1]):
    print(f'   {d:<14} {n:>3}')
filled = lambda f: sum(1 for p in master if p.get(f))
print('\nenrichment coverage')
for f in ['phone', 'aadhaar', 'pan', 'address', 'shiftIn', 'company', 'project', 'computerType', 'dob', 'doj']:
    print(f'   {f:<14} {filled(f):>3} / {len(master)}')
print(f'\nrows that would not join: {len(orphans)}')
for o in orphans:
    print(f'   {o["sheet"]:<32} {o["name"]} ({o["dept"]})')
