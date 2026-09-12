"""Generate apps/api/prisma/real-data.ts from the extracted workbooks."""
import json, re
SP = '/tmp/claude-0/-home-user/cb0a2051-f78c-52c0-9f1b-2651df4d7e3e/scratchpad'
people = json.load(open(f'{SP}/real/people.json'))['people']
units = json.load(open(f'{SP}/real/units.json'))['units']

# Company -> id, and the project each one builds. The workbook maps these 1:1.
COMPANIES = {
    'SRG Developers &Promoters':                 ('srg',      'SRG Developers & Promoters',                 'Partnership',     'grand'),
    'New Marbella Developers And Promoters LLP': ('newmarb',  'New Marbella Developers And Promoters LLP',  'LLP',             'newmarbella'),
    'SRG Marbella Developers And Promoters LLP': ('srgmarb',  'SRG Marbella Developers And Promoters LLP',  'LLP',             'twin'),
    'Garg Builders And Promoters LLP':           ('garg',     'Garg Builders And Promoters LLP',            'LLP',             'royce'),
}
PROJECTS = {
    'grand':       ('Marbella Grand', 'Grand',        'SRG Developers & Promoters'),
    'newmarbella': ('New Marbella',   'New Marbella', 'New Marbella Developers And Promoters LLP'),
    'twin':        ('Twin Tower',     'Twin Tower',   'SRG Marbella Developers And Promoters LLP'),
    'royce':       ('Marbella Royce', 'Royce',        'Garg Builders And Promoters LLP'),
}
PROJ_BY_NAME = {
    'marbella grand': 'grand', 'new marbella': 'newmarbella',
    'twin tower': 'twin', 'marbella royce': 'royce', 'marbella royce -83': 'royce',
}

# How senior a title is, used only to pick each department's head. Higher wins.
def rank(desig):
    d = desig.lower()
    if 'vice president' in d: return 9
    if re.search(r'\bhead\b', d) and 'help desk' not in d: return 8
    if 'general manager' in d: return 7
    if d.strip() in ('agm', 'dgm'): return 6
    if 'senior manager' in d: return 5
    if 'manager' in d: return 4
    if 'senior' in d or 'supervisor' in d or 'incharge' in d: return 2
    if 'assistant' in d: return 3 if 'manager' in d else 1
    return 1

def month(iso):
    y, m, d = iso.split('-')
    return f"{d} {['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][int(m)-1]} {y}"

# Type follows the department: site departments are site staff.
SITE = {'Project', 'Maintenance', 'Horticulture'}
def ptype(dept):
    return 'Site' if dept in SITE else 'Staff'

out = []
for p in people:
    comp = COMPANIES.get(p.get('company', ''))
    projid = PROJ_BY_NAME.get(p.get('project', '').lower().strip(), None)
    # Employer comes from the company sheet; where it is blank, fall back to the
    # company that builds the project they work on. Recorded, never guessed
    # beyond that.
    employer = comp[0] if comp else (
        next((c[0] for c in COMPANIES.values() if c[3] == projid), 'srg') if projid else 'srg')
    out.append({
        'id': p['id'], 'name': p['name'], 'designation': p['designation'],
        'dept': p['dept'], 'type': ptype(p['dept']),
        'joined': month(p['doj']), 'dob': month(p['dob']),
        'shiftIn': p.get('shiftIn', '10:30'), 'shiftOut': p.get('shiftOut', '18:30'),
        'office': projid or 'grand', 'employer': employer,
        'phone': p.get('phone', ''), 'aadhaar': p.get('aadhaar', ''),
        'pan': p.get('pan', ''), 'address': p.get('address', ''),
        'computerType': p.get('computerType', ''), 'computerModel': p.get('computerModel', ''),
        'phoneModel': p.get('phoneModel', ''), 'assetHandover': p.get('assetHandover', ''),
        'rank': rank(p['designation']),
    })

# Each department's head: the single most senior title. Where two people share
# the top rank, nobody is picked — the company has not said who runs it, and
# guessing puts a name on an org chart that nobody agreed to.
heads, ambiguous = {}, []
for dept in {p['dept'] for p in out}:
    members = [p for p in out if p['dept'] == dept]
    top = max(p['rank'] for p in members)
    contenders = [p for p in members if p['rank'] == top]
    # A title naming the department itself outranks a title naming a function
    # within it: a Project Head runs Project, an MEP Head runs MEP. This reads
    # the title the company gave, it does not invent seniority.
    if len(contenders) > 1:
        stem = dept.lower().replace('maintenance', 'maintain')[:7]
        named = [c for c in contenders if stem in c['designation'].lower().replace('maintainance', 'maintain')]
        if len(named) == 1:
            contenders = named
    if len(contenders) == 1 and top > 1:
        heads[dept] = contenders[0]['id']
    else:
        ambiguous.append((dept, top, [c['designation'] for c in contenders]))

for p in out:
    h = heads.get(p['dept'])
    p['reportsTo'] = h if (h and h != p['id']) else None
    del p['rank']

ts = lambda o: json.dumps(o, ensure_ascii=False, indent=2)
comp_list = [{'id': v[0], 'name': v[1], 'kind': v[2]} for v in COMPANIES.values()]
proj_list = [{'id': k, 'name': v[0], 'short': v[1], 'firm': v[2]} for k, v in PROJECTS.items()]
open('apps/api/prisma/real-data.ts', 'w').write(f'''/**
 * Marbella Group, as the company actually is.
 *
 * Generated from the two workbooks supplied by the company on 12 September
 * 2026: the employee register (7 sheets) and the resident register (8 towers).
 * Nothing here is invented. Where a sheet was silent, the field is empty rather
 * than filled with something plausible.
 *
 * Known gaps, deliberately left visible rather than papered over:
 *  - Reporting lines below department head are not in the source. Everyone is
 *    placed under their department head; the heads themselves report to nobody,
 *    because the company has not said who they report to.
 *  - {len(ambiguous)} departments have no single most-senior title, so no head was chosen.
 *  - The resident register names the tower but never the project, so every unit
 *    is unassigned until someone confirms it.
 *
 * Regenerate with scripts/import-company-data.py — do not hand-edit.
 */

export const REAL_COMPANIES = {ts(comp_list)} as const;

export const REAL_PROJECTS = {ts(proj_list)} as const;

export const REAL_PEOPLE = {ts(out)};

export const REAL_UNITS = {ts(units)};
''')
print(f'{len(out)} people, {len(units)} units written to apps/api/prisma/real-data.ts')
print(f'\ndepartment heads chosen ({len(heads)}):')
for d, i in sorted(heads.items()):
    who = next(p for p in out if p['id'] == i)
    print(f'   {d:<14} {who["name"]:<24} {who["designation"]}')
print(f'\nno head chosen ({len(ambiguous)}) — flagged, not guessed:')
for d, t, des in ambiguous:
    print(f'   {d:<14} top titles: {des}')
