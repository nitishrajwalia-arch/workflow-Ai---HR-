"""
The eight tower sheets into one list of units.

Every sheet has a different column layout — Tower B and E carry a 4th applicant,
Tower C has no 3rd, and Tower E's "Address" column actually holds email
addresses. So columns are resolved from each sheet's own header row by name,
never by position.
"""
import openpyxl, json, re, unicodedata

SP = '/tmp/claude-0/-home-user/cb0a2051-f78c-52c0-9f1b-2651df4d7e3e/scratchpad'
SRC = 'fcc499a1-All_Tower_Data_Club_1.xlsx'

def norm(v):
    if v is None: return ''
    s = unicodedata.normalize('NFKC', str(v))
    s = re.sub(r'\s+', ' ', s).strip()
    return '' if s.lower() in ('na', 'n/a', '-', 'none') else s

def find(headers, *musts, avoid=()):
    for i, h in enumerate(headers):
        low = h.lower()
        if all(m in low for m in musts) and not any(a in low for a in avoid):
            return i
    return None

wb = openpyxl.load_workbook(SRC, data_only=True)
units, issues = [], []

for sheet in wb.sheetnames:
    ws = wb[sheet]
    headers = [norm(ws.cell(1, c).value).lower() for c in range(1, ws.max_column + 1)]
    col = {
        'unit':   find(headers, 'unit'),
        'addr':   find(headers, 'address'),
        'mob1':   find(headers, '1st', 'mobile'),
        'mob2':   find(headers, '2nd', 'mobile'),
        'email1': find(headers, '1st', 'email'),
        'email2': find(headers, '2nd', 'email'),
    }
    names = [find(headers, o, 'name') for o in ('1st', '2nd', '3rd', '4th')]
    pans  = [find(headers, o, 'pan') for o in ('1st', '2nd', '3rd', '4th')]

    for r in range(2, ws.max_row + 1):
        get = lambda i: norm(ws.cell(r, i + 1).value) if i is not None else ''
        unit = get(col['unit'])
        if not unit:
            continue
        applicants = []
        for i in range(4):
            nm = get(names[i]) if i < len(names) else ''
            if not nm:
                continue
            applicants.append({'name': nm, 'pan': get(pans[i]) if i < len(pans) else ''})
        if not applicants:
            issues.append({'tower': sheet, 'unit': unit, 'why': 'no applicant named'})
            continue

        addr = get(col['addr'])
        email1 = get(col['email1'])
        # Tower E puts the email in the column headed "Address".
        if '@' in addr and not email1:
            email1, addr = addr, ''
        if '@' in addr:
            addr = ''

        units.append({
            'tower': sheet.replace('Tower ', '').strip(),
            'unit': unit,
            'applicants': applicants,
            'address': addr,
            'phone1': get(col['mob1']),
            'phone2': get(col['mob2']),
            'email1': email1,
            'email2': get(col['email2']),
        })

# Two rows in the source are exact duplicates — same unit, same applicants,
# same phone, same email. Keep the first and record the drop; a unit number is
# the key residents use, so it cannot be held twice.
seen, deduped = {}, []
for u in units:
    if u['unit'] in seen:
        issues.append({'tower': u['tower'], 'unit': u['unit'], 'why': 'duplicate row in source, identical to the first'})
        continue
    seen[u['unit']] = True
    u['id'] = u['unit']
    deduped.append(u)
units = deduped

json.dump({'units': units, 'issues': issues}, open(f'{SP}/real/units.json', 'w'), indent=1)

by = {}
for u in units:
    by[u['tower']] = by.get(u['tower'], 0) + 1
print(f'{len(units)} units across {len(by)} towers')
for t, n in sorted(by.items()):
    print(f'   Tower {t}  {n:>3}')
print(f'\nwith 2+ applicants : {sum(1 for u in units if len(u["applicants"]) > 1)}')
print(f'with an email      : {sum(1 for u in units if u["email1"])}')
print(f'with an address    : {sum(1 for u in units if u["address"])}')
print(f'with a phone       : {sum(1 for u in units if u["phone1"])}')
print(f'rows skipped       : {len(issues)}')
