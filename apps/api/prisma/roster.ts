/**
 * The generated roster: 181 people on top of the 19 named leadership.
 *
 * Ported unchanged from the single-file build, including its linear-congruential
 * generator and its seed, so the same 181 people come out with the same names,
 * dates, postings and reporting lines every time. Deterministic seed data is
 * what makes a seeded environment testable.
 *
 * THE PART THAT MATTERS, AND THAT SHIPPED AS A BUG ONCE
 * -----------------------------------------------------
 * The roster is given a real shape: three ranks, department heads, and labour
 * reporting to THE SITE SUPERVISOR AT THEIR OWN SITE — not to a labour
 * department, which does not exist, and not to the Chairman.
 *
 * Result: Chairman with 16 direct reports, managers with 5-8 each. If a change
 * here ever flattens it back to everyone reporting to MB-ADM-0001, the org board
 * renders as a broken tree and the client will notice. There is a test for it
 * (src/tests/roster.test.ts) precisely because it happened once.
 */

import { DEPT_CODES } from '@marbella/shared';
import { FIRST_F, FIRST_M, OFFICE_IDS, ROLES, SURN } from './seed-data.js';

export interface RosterPerson {
  id: string;
  name: string;
  designation: string;
  dept: string;
  type: string;
  phone?: string;
  email?: string;
  joined: string;
  dob?: string | null;
  status: string;
  exitedOn?: string | null;
  perf: number;
  growth: string;
  notes?: Array<{ when: string; text: string }>;
  office: string;
  employer: string;
  reportsTo: string | null;
  photo?: string | null;
  /** Used by the seed to give generated people a salary structure. */
  _basic?: number;
  _phone?: string;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** Base pay by department, before the deterministic bump. */
const BASE_PAY: Record<string, number> = {
  'Site Engineering': 34000,
  Security: 16000,
  Labour: 14000,
  Store: 22000,
  Purchase: 30000,
  Accounts: 30000,
  Maintenance: 26000,
  'QA / QC': 32000,
  HR: 28000,
  Marketing: 28000,
  Admin: 24000,
};

/** The named leadership each department reports up to. */
const HEADS: Record<string, string> = {
  Purchase: 'MB-PUR-0012',
  Store: 'MB-STR-0004',
  Accounts: 'MB-ACC-0002',
  Maintenance: 'MB-MNT-0006',
  HR: 'MB-HR-0001',
  'Site Engineering': 'MB-SIT-0021',
  Marketing: 'MB-MKT-0001',
  Admin: 'MB-ADM-0001',
};

/** 3 = manager, 2 = supervisor/senior, 1 = everyone else. */
function rankOf(designation: string): 1 | 2 | 3 {
  const t = designation.toLowerCase();
  if (/manager|head|in-charge|incharge/.test(t)) return 3;
  if (/supervisor|senior|project engineer|accountant|store keeper|executive|inspector/.test(t))
    return 2;
  if (
    /engineer|technician|electrician|plumber(?! helper)|surveyor|buyer|receptionist|trainer/.test(t)
  )
    return 2;
  return 1;
}

export function buildRoster(): RosterPerson[] {
  // The exact seed and generator from the original. Changing either renames all
  // 181 people, which would invalidate every ID already printed on a card.
  let seed = 20260829;
  const rnd = () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed / 0x7fffffff;
  };
  const pick = <T>(a: T[]): T => a[Math.floor(rnd() * a.length)] as T;
  const dstr = (y: number, m: number, d: number) =>
    `${String(d).padStart(2, '0')} ${MONTHS[m]} ${y}`;

  const out: Array<RosterPerson & { _rank?: number }> = [];
  const used = new Set<string>();
  const counters: Record<string, number> = {};

  for (const [dept, roles] of Object.entries(ROLES)) {
    for (const [role, n] of roles) {
      for (let i = 0; i < n; i++) {
        const female = rnd() > 0.68;
        let name = '';
        let guard = 0;
        do {
          name = `${pick(female ? FIRST_F : FIRST_M)} ${pick(SURN)}`;
          guard++;
        } while (used.has(name) && guard < 40);
        used.add(name);

        const code = DEPT_CODES[dept as keyof typeof DEPT_CODES] ?? 'GEN';
        counters[code] = (counters[code] ?? 200) + 1;
        const id = `MB-${code}-${String(counters[code]).padStart(4, '0')}`;

        const jy = 2019 + Math.floor(rnd() * 7);
        const jm = Math.floor(rnd() * 12);
        const jd = 1 + Math.floor(rnd() * 28);
        const by = 1972 + Math.floor(rnd() * 34);
        const bm = Math.floor(rnd() * 12);
        const bd = 1 + Math.floor(rnd() * 28);

        // Office staff mostly sit at head office; site staff never do.
        const office =
          dept === 'HR' || dept === 'Purchase' || dept === 'Accounts' || dept === 'Marketing'
            ? rnd() > 0.35
              ? 'hq'
              : pick(OFFICE_IDS)
            : pick(OFFICE_IDS.slice(1));

        // Curo and Royce are D.R. Developers; security and labour sit on SRG;
        // everyone else is Delhi Punjab Real Estates. A project is not an employer.
        const employer =
          office === 'curo' || office === 'royce'
            ? 'drdc'
            : dept === 'Security' || dept === 'Labour'
              ? 'srg'
              : 'dpre';

        const base = BASE_PAY[dept] ?? 22000;
        const bump = 1 + Math.floor(rnd() * 5) * 0.12;

        out.push({
          id,
          name,
          designation: role,
          dept,
          type: dept === 'Labour' ? 'Labour' : dept === 'Security' ? 'Security' : 'Staff',
          phone: '',
          email: '',
          joined: dstr(jy, jm, jd),
          dob: dstr(by, bm, bd),
          status: 'active',
          perf: 62 + Math.floor(rnd() * 36),
          growth: '',
          notes: [],
          office,
          employer,
          photo: null,
          reportsTo: null,
          _basic: Math.round((base * bump) / 1000) * 1000,
          _phone: `9${String(800000000 + Math.floor(rnd() * 99999999)).slice(0, 9)}`,
        });
      }
    }
  }

  /* Give the roster a real shape. */

  for (const p of out) p._rank = rankOf(p.designation);

  /** People of a rank in a department, preferring the same site. */
  const pool = (dept: string, rank: number, office: string) => {
    const same = out.filter((x) => x.dept === dept && x._rank === rank && x.office === office);
    return same.length ? same : out.filter((x) => x.dept === dept && x._rank === rank);
  };

  out.forEach((p, i) => {
    const head = HEADS[p.dept];

    // Labour is run by whoever supervises THAT SITE, not by a labour department.
    if (p.dept === 'Labour') {
      const sup = pool('Site Engineering', 2, p.office);
      p.reportsTo = sup.length ? (sup[i % sup.length] as RosterPerson).id : (head ?? 'MB-SIT-0021');
      return;
    }
    if (p._rank === 3) {
      p.reportsTo = head ?? 'MB-ADM-0001';
      return;
    }
    if (p._rank === 2) {
      const mgr = pool(p.dept, 3, p.office).filter((x) => x.id !== p.id);
      p.reportsTo = mgr.length ? (mgr[i % mgr.length] as RosterPerson).id : (head ?? 'MB-ADM-0001');
      return;
    }
    const up = pool(p.dept, 2, p.office).filter((x) => x.id !== p.id);
    const up3 = pool(p.dept, 3, p.office).filter((x) => x.id !== p.id);
    p.reportsTo = up.length
      ? (up[i % up.length] as RosterPerson).id
      : up3.length
        ? (up3[i % up3.length] as RosterPerson).id
        : (head ?? 'MB-ADM-0001');
  });

  for (const p of out) delete p._rank;
  return out;
}
