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

# WHAT COMES OFF A PAYSLIP, AND UNDER WHICH RULE.
#
# The two rates the books actually use, plus the two things HR types each month,
# plus one the law provides for and Marbella does not apply. That last one is
# kept and switched OFF rather than left out: a head that is missing looks like
# nobody thought about it, and a head that is off with the rule written on it
# says somebody looked and decided.
HEADS = [
    dict(code='pf', label='P.F.', basis='wagePct', rate=12, employerRate=12,
         wage=15000, personWage=True, ceiling=0, proRate=True, requires='pfOn',
         rounding='nearest', sort=10,
         authority='EPF & MP Act 1952 — 12% of wages, on wages up to 15,000 a month, '
                   'matched by the employer.',
         note='One man is on 12% of his whole salary rather than the capped wage. '
              'That is recorded against him, not here.',
         active=True),
    dict(code='esi', label='E.S.I.', basis='earnedPct', rate=0.75, employerRate=3.25,
         wage=0, personWage=False, ceiling=0, proRate=False, requires='esiOn',
         rounding='nearest', sort=20,
         authority='ESI Act 1948 — 0.75% from the employee and 3.25% from the employer, '
                   'on what was earned. The statutory wage ceiling is 21,000 a month.',
         note='NO CEILING IS SET HERE, deliberately. The August books deduct ESI from '
              'people on 22,500, 23,000, 24,000, 25,000 and 29,000 a month. The software '
              'does what the company does; setting the ceiling would change six people\'s '
              'take-home and that is for the management to decide, not for software.',
         active=True),
    dict(code='tds', label='T.D.S.', basis='entered', rate=0, employerRate=0,
         wage=0, personWage=False, ceiling=0, proRate=False, requires='',
         rounding='nearest', sort=30,
         authority='Income Tax Act 1961 — deducted at source against the person\'s own '
                   'liability. HR enters the figure each month.',
         note='', active=True),
    dict(code='advance', label='Advance recovered', basis='entered', rate=0, employerRate=0,
         wage=0, personWage=False, ceiling=0, proRate=False, requires='',
         rounding='nearest', sort=40,
         authority='Money the company has already paid the person and is taking back. '
                   'HR enters the figure each month.',
         note='', active=True),
    dict(code='pt', label='Professional tax', basis='flat', rate=0, employerRate=0,
         wage=200, personWage=False, ceiling=0, proRate=False, requires='',
         rounding='nearest', sort=50,
         authority='Punjab State Development Tax Act 2018 — 200 a month from salaried '
                   'persons liable to income tax. Chandigarh levies no such tax.',
         note='SWITCHED OFF because no August payslip deducts it. Whether it is due turns '
              'on where each person is employed and taxed; that is a question for the '
              'management and the auditors, and this stays off until they answer it.',
         active=False),
]
for h in HEADS:
    h.update(setBy='Read off the August 2026 salary books', setOn='31 Aug 2026')


def heads_for(company):
    """The heads as THAT company's book actually applies them.

    New Marbella rounds ESI up to the next rupee on all eighteen of its lines
    where the paise matter, which is what the ESI regulation says. The three SRG
    books have one such line between them and it is not rounded up. So the two
    are set differently and both are written down, because assuming either would
    be a rupee a head a month that nobody chose."""
    out = []
    for h in HEADS:
        h = dict(h)
        if h['code'] == 'esi':
            if company == 'newmarb':
                h['rounding'] = 'up'
                h['note'] += (' This book ROUNDS UP to the next rupee, on all eighteen lines '
                              'where the paise matter, which is what the regulation says.')
            else:
                h['note'] += (' This book rounds to the NEAREST rupee. The regulation says round '
                              'up, and New Marbella\'s book does; there is one line in the three '
                              'SRG books where the difference shows and it is not rounded up. It '
                              'is a rupee a head a month and somebody should decide which is right.')
        out.append(h)
    return out

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

/**
 * What comes off a payslip at each company, and under which rule.
 *
 * The same five heads everywhere, because the same four books were read. They
 * are rows rather than code so that a change in the law is an edit somebody
 * makes and signs. `pt` is switched off: no August payslip deducts it.
 */
export const PAY_HEADS = {ts({c: heads_for(c) for c in POLICY})} as const;

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
