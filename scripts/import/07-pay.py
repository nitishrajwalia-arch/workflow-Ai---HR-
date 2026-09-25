"""
Turn the matched August lines into apps/api/prisma/real-pay.ts.

Two things come out of this: what each person is ON (their structure, which is
the same every month), and what each company PAID in August (a closed pay run,
reproduced from the company's own arithmetic rather than recomputed — if this
system's engine disagrees with the books, that has to show, not be papered over).
"""
import json
from datetime import date

SP = '/tmp/claude-0/-home-user/cb0a2051-f78c-52c0-9f1b-2651df4d7e3e/scratchpad/pay'
m = json.load(open(f'{SP}/matched.json'))
R = lambda v: int(round(v or 0))

# company id per book, from real-data.ts
COMPANY = {'grand': 'srg', 'royce': 'garg', 'twin': 'srgmarb', 'newmarbella': 'newmarb'}
POLICY = {
    'srg':     dict(kind='percent', basicPct=70, hraPctOfBasic=30, travelPctOfBasic=10),
    'garg':    dict(kind='percent', basicPct=70, hraPctOfBasic=30, travelPctOfBasic=10),
    'srgmarb': dict(kind='percent', basicPct=70, hraPctOfBasic=30, travelPctOfBasic=10),
    'newmarb': dict(kind='stated',  basicPct=0,  hraPctOfBasic=0,  travelPctOfBasic=0),
}
for p in POLICY.values():
    # esiCeiling 0 = no ceiling applied. The August books deduct ESI from people
    # on up to 29,000 a month; the statutory ceiling is 21,000. Applying it here
    # would change six people's take-home without anybody deciding to.
    p.update(esiEmployeePct=0.75, esiEmployerPct=3.25, esiCeiling=0,
             pfPct=12, pfWageCap=15000, extraDayDivisor=30,
             setBy='Taken from the August 2026 salary books', setOn='31 Aug 2026')

def pf_wage(dpf, days, gross):
    """The FULL-MONTH wage PF was worked out on, recovered from the deduction.

    The books round the deduction to the rupee, so working backwards lands a
    rupee or two off a round figure — 15,001 rather than 15,000. Where the
    answer is within a few rupees of the statutory wage or of the person's own
    salary, it is that; those are the two numbers anybody actually uses."""
    if not dpf or not days:
        return 0
    got = dpf / 0.12 * (31 / days)
    for candidate in (15000, gross):
        if abs(got - candidate) <= 6:
            return candidate
    return int(round(got / 10) * 10)


extra_by = {}
for e in m['extras']:
    extra_by.setdefault((e['book'], e['name'].strip().lower()), []).append(e)

lines, structures = [], {}
for tier, rows in (('confirmed', m['confirmed']), ('shaky', m['shaky']), ('held', m['held'])):
    for l in rows:
        book = l['book']
        ex = extra_by.get((book, l['name'].strip().lower()), [])
        exd = sum(x['days'] or 0 for x in ex)
        exa = sum(x['amount'] or 0 for x in ex)
        rec = {
            'book': book, 'company': COMPANY[book], 'personId': l.get('id'),
            'name': l['name'], 'designation': l['designation'], 'days': l['days'],
            'gross': R(l['a_total']),
            'basic': R(l['a_basic']), 'hra': R(l['a_hra']),
            'travel': R(l.get('a_travel')), 'medical': R(l.get('a_medical')),
            'special': R(l['a_special']),
            'eBasic': R(l['e_basic']), 'eHra': R(l['e_hra']),
            'eTravel': R(l.get('e_travel')), 'eMedical': R(l.get('e_medical')),
            'eSpecial': R(l['e_special']), 'eGross': R(l['e_gross']),
            'dEsi': R(l.get('d_esi')), 'dPf': R(l.get('d_pf')), 'dTds': R(l.get('d_tds')),
            'dAdvance': R(l.get('d_advance')), 'dOther': R(l.get('d_other')),
            'dTotal': R(l.get('d_total')),
            'erEsi': R(l.get('er_esi')), 'erPf': R(l.get('er_pf')),
            'extraDays': exd, 'extraAmount': R(exa), 'arrear': R(l.get('arrear')),
            'pfWages': pf_wage(R(l.get('d_pf')), l['days'], R(l['a_total'])),
            'net': R(l.get('net')), 'match': tier,
        }
        lines.append(rec)
        if l.get('id'):
            structures[l['id']] = {
                'id': l['id'], 'company': COMPANY[book], 'gross': rec['gross'],
                'basic': rec['basic'], 'hra': rec['hra'], 'travel': rec['travel'],
                'medical': rec['medical'], 'special': rec['special'],
                'esiOn': bool(rec['dEsi']) or bool(l.get('er_esi')),
                'pfOn': bool(rec['dPf']),
                'pfWages': pf_wage(rec['dPf'], l['days'], rec['gross']),
            }

runs = {}
for l in lines:
    runs.setdefault(l['company'], {'company': l['company'], 'month': 'Aug 2026',
                                   'monthOn': '2026-08-01', 'monthDays': 31, 'lines': 0})
    runs[l['company']]['lines'] += 1

ts = lambda o: json.dumps(o, ensure_ascii=False, indent=2)
open('apps/api/prisma/real-pay.ts', 'w').write(f'''/**
 * Marbella's payroll, as the company actually runs it.
 *
 * Generated from the four August 2026 salary books — one per company — by
 * scripts/import/07-pay.py. Nothing here is recomputed: every figure is the one
 * on the company's own sheet, so that when this system's engine works the same
 * month out, the two can be compared. `packages/shared/src/pay.ts` holds the
 * rules; `apps/api/src/tests/pay.test.ts` is that comparison.
 *
 * THIRTEEN LINES HAVE NO EMPLOYEE ID. They are people the four books pay who are
 * not on the employee register — together 8.56 lakh a month, two of them Project
 * Heads on 185,000 and 180,000. They are kept, with a null personId, because
 * dropping them to keep a foreign key tidy is how that goes unnoticed.
 *
 * Regenerate with scripts/import/07-pay.py — do not hand-edit.
 */

/** What each company's payslip arithmetic is. Two of them, and they differ. */
export const PAY_POLICIES = {ts(POLICY)} as const;

/** What each person is on per month. The same every month until somebody changes it. */
export const PAY_STRUCTURES = {ts(sorted(structures.values(), key=lambda x: x['id']))} as const;

/** August 2026, as paid. `match` says how firmly the line is tied to a person. */
export const PAY_AUGUST = {ts(lines)} as const;
''')

print(f'{len(structures)} salary structures, {len(lines)} August lines')
for c, r_ in runs.items():
    tot = sum(l['net'] for l in lines if l['company'] == c)
    ex = sum(l['extraAmount'] for l in lines if l['company'] == c)
    print(f'  {c:<9} {r_["lines"]:>3} lines   net {tot:>12,}   extra {ex:>10,}')
print(f'  {"TOTAL":<9} {len(lines):>3} lines   net {sum(l["net"] for l in lines):>12,}'
      f'   extra {sum(l["extraAmount"] for l in lines):>10,}')
print(f'\nlines with no employee ID: {sum(1 for l in lines if not l["personId"])}')
