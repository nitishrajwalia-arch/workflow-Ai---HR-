/**
 * Bulk intake.
 *
 * Paste a sheet, every row is validated, and failures are held back WITH A
 * REASON rather than the whole import being refused. Twenty good rows should not
 * be lost because row eleven has a typo.
 *
 * `commit: false` validates and reports without writing anything. The UI calls
 * it that way first so the operator sees exactly what will and will not land
 * before they commit — the preview and the real thing run identical code, so the
 * preview cannot be wrong.
 *
 * The whole commit is one transaction. A half-imported sheet is worse than a
 * refused one: nobody can tell which half.
 */

import { emailCheck, imeiCheck, normDate, phoneCheck, readGender, schemas } from '@marbella/shared';
import type { ImportRow, ImportUpdateRow } from '@marbella/shared';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { bothForms } from '../lib/dates.js';
import { deptCode } from '../lib/ids.js';
import { requireUser } from '../plugins/auth.js';
import { appendInTx } from '../services/ledger.js';

interface Rejection {
  row: number;
  name: string;
  reason: string;
  field: string;
}

export const importsRoutes: FastifyPluginAsyncZod = async (app) => {
  const { db } = app;

  app.post(
    '/imports/people',
    {
      preHandler: app.requireRole('HR'),
      schema: {
        tags: ['imports'],
        summary: 'Import people from a pasted sheet',
        description:
          'Send commit:false to validate only. Nothing is written and the response tells you ' +
          'exactly which rows would land and which would not, and why.',
        body: schemas.bulkImportBody,
        response: { 200: schemas.bulkImportResult },
      },
    },
    async (req) => {
      const me = requireUser(req);
      const { rows, commit } = req.body;

      const [offices, companies, projects, existing] = await Promise.all([
        db.office.findMany(),
        db.company.findMany({ select: { id: true } }),
        db.project.findMany({ select: { id: true, companyId: true } }),
        db.person.findMany({ select: { id: true } }),
      ]);

      const companyIds = new Set(companies.map((c) => c.id));
      const takenIds = new Set(existing.map((p) => p.id));
      const projectCompany = new Map(projects.map((p) => [p.id, p.companyId]));
      const defaultCompany = companyIds.has('dpre') ? 'dpre' : (companies[0]?.id ?? '');

      const rejected: Rejection[] = [];
      const staged: Array<{ row: number; data: ReturnType<typeof prepare>; source: ImportRow }> =
        [];

      /** Resolve a free-text office ("Grand", "twin towers") to an office id. */
      const resolveOffice = (raw: string | undefined): string | null => {
        if (!raw?.trim()) return offices[0]?.id ?? null;
        const needle = raw.trim().toLowerCase();
        const hit =
          offices.find((o) => o.id.toLowerCase() === needle) ??
          offices.find((o) => o.short.toLowerCase() === needle) ??
          offices.find((o) => needle.includes(o.short.toLowerCase())) ??
          offices.find((o) => o.name.toLowerCase().includes(needle));
        return hit?.id ?? null;
      };

      function prepare(r: ImportRow, officeId: string, id: string) {
        const joined = bothForms(r.joined);
        // A date of birth that will not parse is dropped rather than guessed:
        // the person simply shows "no date of birth" until somebody fixes it.
        let dob: { display: string; on: Date } | null = null;
        if (r.dob?.trim()) {
          const parsed = bothForms(r.dob);
          if (parsed.on && /^\d{2} [A-Z][a-z]{2} \d{4}$/.test(parsed.display)) {
            dob = { display: parsed.display, on: parsed.on };
          }
        }
        // Who pays them follows the PROJECT behind the office, not the office.
        // The Head Office has no project, so it falls back to the group's
        // default entity — which is why `employer` is editable afterwards.
        const projectId = offices.find((o) => o.id === officeId)?.projectId ?? null;
        const employerId = (projectId && projectCompany.get(projectId)) || defaultCompany;
        return {
          id,
          name: r.name.trim(),
          designation: r.desig.trim(),
          dept: r.dept.trim(),
          type: 'Staff',
          joined: joined.display,
          joinedOn: joined.on,
          dob: dob?.display ?? null,
          dobOn: dob?.on ?? null,
          gender: readGender(r.gender),
          officeId,
          employerId,
          imported: true,
          reportsToId: null as string | null,
        };
      }

      // Counters per department so two rows in the same sheet do not collide.
      const nextByDept = new Map<string, number>();
      for (const id of takenIds) {
        const m = id.match(/^MB-([A-Z]{2,3})-(\d{4})$/);
        if (!m) continue;
        const n = Number(m[2]);
        if (n > (nextByDept.get(m[1]!) ?? 0)) nextByDept.set(m[1]!, n);
      }
      const allocateId = (dept: string): string => {
        const code = deptCode(dept);
        const next = (nextByDept.get(code) ?? 0) + 1;
        nextByDept.set(code, next);
        return `MB-${code}-${String(next).padStart(4, '0')}`;
      };

      rows.forEach((r, i) => {
        const rowNo = i + 1;
        const name = r.name?.trim() ?? '';
        const reject = (field: string, reason: string) =>
          rejected.push({ row: rowNo, name: name || '(no name)', reason, field });

        if (!name || name.length < 2) return reject('name', 'No name, or too short to be one.');
        if (!r.desig?.trim()) return reject('desig', 'No designation.');
        if (!r.dept?.trim()) return reject('dept', 'No department.');

        const joinedDisplay = normDate(r.joined);
        if (!/^\d{2} [A-Z][a-z]{2} \d{4}$/.test(joinedDisplay)) {
          return reject(
            'joined',
            `"${r.joined}" is not a date I can read. Try 05/06/2020 or 2020-06-05.`,
          );
        }

        const officeId = resolveOffice(r.office);
        if (!officeId) {
          return reject(
            'office',
            `"${r.office}" is not a place we have. Known: ${offices.map((o) => o.short).join(', ')}.`,
          );
        }

        if (r.phone) {
          const p = phoneCheck(r.phone);
          if (p.level === 'error') return reject('phone', p.msg ?? 'Bad mobile number.');
        }
        if (r.email) {
          const e = emailCheck(r.email, { mustBePersonal: true });
          if (e.level === 'error') return reject('email', e.msg ?? 'Bad email.');
        }
        if (r.imei) {
          const m = imeiCheck(r.imei);
          if (m.level === 'error') return reject('imei', m.msg ?? 'Bad IMEI.');
        }

        let id = r.id?.trim().toUpperCase() ?? '';
        if (id) {
          if (!/^MB-[A-Z]{2,3}-\d{4}$/.test(id)) {
            return reject('id', `"${id}" is not an employee ID. They look like MB-PUR-0012.`);
          }
          if (takenIds.has(id)) {
            return reject(
              'id',
              `${id} already belongs to someone. Leave it blank to be given a new one.`,
            );
          }
        } else {
          id = allocateId(r.dept);
        }
        takenIds.add(id);

        staged.push({ row: rowNo, data: prepare(r, officeId, id), source: r });
      });

      if (!commit) {
        return {
          accepted: staged.map((s) => ({ row: s.row, id: s.data.id, name: s.data.name })),
          rejected,
          committed: false,
        };
      }

      // One transaction for the lot. Either the whole accepted set lands or none
      // of it does, so a failure halfway leaves nothing to reconcile by hand.
      await db.$transaction(async (tx) => {
        for (const s of staged) {
          await tx.person.create({ data: s.data });

          const money = [s.source.basic, s.source.hra, s.source.special].some(
            (v) => v != null && v !== '',
          );
          if (money) {
            await tx.salary.create({
              data: {
                personId: s.data.id,
                basic: Number(s.source.basic) || 0,
                hra: Number(s.source.hra) || 0,
                special: Number(s.source.special) || 0,
                pf: 1800,
                pt: 200,
                note: 'imported',
              },
            });
          }
          if (s.source.phone || s.source.email) {
            await tx.contact.create({
              data: {
                personId: s.data.id,
                phone: s.source.phone ?? '',
                email: s.source.email ?? '',
              },
            });
          }
          if (s.source.imei) {
            await tx.device.create({
              data: {
                personId: s.data.id,
                type: 'Phone',
                model: 'imported',
                imei: s.source.imei,
                sim: s.source.sim ?? '—',
                issued: s.data.joined,
              },
            });
          }
        }

        if (staged.length) {
          await appendInTx(
            tx,
            staged.map((s) => ({
              kind: 'join',
              subject: s.data.id,
              detail: `${s.data.name} imported as ${s.data.designation}.`,
              who: me.name,
            })),
          );
        }

        await tx.usageCounter.upsert({
          where: { key: 'import:run' },
          create: { key: 'import:run', count: 1 },
          update: { count: { increment: 1 } },
        });
      });

      req.log.info({ accepted: staged.length, rejected: rejected.length }, 'bulk import committed');

      return {
        accepted: staged.map((s) => ({ row: s.row, id: s.data.id, name: s.data.name })),
        rejected,
        committed: true,
      };
    },
  );

  /**
   * Update people who are ALREADY on the roster, from a sheet.
   *
   * The importer above only creates. That is right for new joiners and wrong for
   * the job HR actually has first: a hundred-odd records already loaded from the
   * company's own files, each missing the handful of things nobody wrote down —
   * a personal email, a gender, who somebody reports to. Re-importing them would
   * be refused as duplicates, and doing it by hand is a hundred-odd screens.
   *
   * Matched on the employee ID, which is the only required column. A BLANK CELL
   * LEAVES THE FIELD ALONE rather than clearing it, so a sheet filled in one
   * column at a time never wipes the columns somebody else filled in.
   *
   * What it will NOT change: designation, department, posting or employer. Those
   * are promotions and transfers. They belong on their own routes, with a reason
   * recorded, not in a spreadsheet paste.
   */
  app.post(
    '/imports/people/update',
    {
      preHandler: app.requireRole('HR'),
      schema: {
        tags: ['imports'],
        summary: 'Fill in missing fields on people already on the roster',
        body: schemas.bulkUpdateBody,
        response: { 200: z.any() },
      },
    },
    async (req) => {
      const me = requireUser(req);
      const { rows, commit } = req.body;

      const ids = rows.map((r) => r.id);
      const existing = await db.person.findMany({
        where: { id: { in: ids } },
        select: {
          id: true,
          name: true,
          joined: true,
          dob: true,
          gender: true,
          reportsToId: true,
          contact: { select: { phone: true, email: true } },
          salary: { select: { basic: true, hra: true, special: true } },
        },
      });
      const known = new Map(existing.map((p) => [p.id, p]));

      const rejected: Rejection[] = [];
      const staged: Array<{ row: number; id: string; name: string; source: ImportUpdateRow }> = [];
      const seen = new Set<string>();

      rows.forEach((r, i) => {
        const rowNo = i + 1;
        const who = known.get(r.id);
        const label = who?.name ?? r.id;
        const reject = (field: string, reason: string) =>
          rejected.push({ row: rowNo, name: label, reason, field });

        if (!who) {
          return reject('id', `Nobody on the roster has the ID ${r.id}.`);
        }
        if (seen.has(r.id)) {
          return reject('id', `${r.id} appears more than once in this sheet.`);
        }
        seen.add(r.id);

        if (r.dob?.trim()) {
          const d = normDate(r.dob);
          if (!/^\d{2} [A-Z][a-z]{2} \d{4}$/.test(d)) {
            return reject('dob', `"${r.dob}" is not a date I can read. Try 15/08/1995.`);
          }
        }
        if (r.gender?.trim() && !readGender(r.gender)) {
          return reject(
            'gender',
            `"${r.gender}" is not something I can place. Use Female, Male, Other, or Prefers not to say.`,
          );
        }
        if (r.reportsTo?.trim()) {
          if (r.reportsTo.trim() === r.id) {
            return reject('reportsTo', 'Somebody cannot report to themselves.');
          }
          if (!known.has(r.reportsTo.trim())) {
            // The manager may be outside this sheet, so check the roster too.
            // Resolved below; flagged here only if it is not an employee ID.
            if (!/^MB-[A-Z]{2,3}-\d{4}$/.test(r.reportsTo.trim())) {
              return reject('reportsTo', `"${r.reportsTo}" is not an employee ID.`);
            }
          }
        }
        if (r.phone?.trim()) {
          const p = phoneCheck(r.phone);
          if (p.level === 'error') return reject('phone', p.msg ?? 'Bad mobile number.');
        }
        if (r.email?.trim()) {
          const e = emailCheck(r.email, { mustBePersonal: true });
          if (e.level === 'error') return reject('email', e.msg ?? 'Bad email.');
        }
        if (r.imei?.trim()) {
          const m = imeiCheck(r.imei);
          if (m.level === 'error') return reject('imei', m.msg ?? 'Bad IMEI.');
        }

        staged.push({ row: rowNo, id: r.id, name: who.name, source: r });
      });

      // Managers named in the sheet but not listed in it have to exist too.
      const bosses = [
        ...new Set(
          staged.map((s) => s.source.reportsTo?.trim()).filter((b): b is string => Boolean(b)),
        ),
      ].filter((b) => !known.has(b));
      if (bosses.length) {
        const found = new Set(
          (await db.person.findMany({ where: { id: { in: bosses } }, select: { id: true } })).map(
            (p) => p.id,
          ),
        );
        for (let i = staged.length - 1; i >= 0; i -= 1) {
          const boss = staged[i]!.source.reportsTo?.trim();
          if (boss && !known.has(boss) && !found.has(boss)) {
            rejected.push({
              row: staged[i]!.row,
              name: staged[i]!.name,
              reason: `Nobody on the roster has the ID ${boss}, so they cannot be the manager.`,
              field: 'reportsTo',
            });
            staged.splice(i, 1);
          }
        }
      }

      /**
       * Which fields this row actually CHANGES.
       *
       * A cell repeating what is already on file is not a change, and saying so
       * matters: the collection sheet is pre-filled with what we hold, and HR
       * uploads it more than once as they gather more. Counting a repeat as a
       * change would seal a ledger entry on every re-upload, and a ledger full
       * of entries that record nothing is a ledger nobody reads.
       */
      const touched = (r: ImportUpdateRow) => {
        const was = known.get(r.id);
        const given = (v: unknown) => (v == null ? '' : String(v).trim());
        const unchanged: Partial<Record<string, () => boolean>> = {
          dob: () => normDate(given(r.dob)) === (was?.dob ?? ''),
          gender: () => readGender(given(r.gender)) === (was?.gender ?? null),
          reportsTo: () => given(r.reportsTo) === (was?.reportsToId ?? ''),
          phone: () => given(r.phone) === (was?.contact?.phone ?? ''),
          email: () => given(r.email) === (was?.contact?.email ?? ''),
          basic: () => Number(given(r.basic)) === (was?.salary?.basic ?? 0),
          hra: () => Number(given(r.hra)) === (was?.salary?.hra ?? 0),
          special: () => Number(given(r.special)) === (was?.salary?.special ?? 0),
        };
        return (
          [
            'dob',
            'gender',
            'reportsTo',
            'phone',
            'email',
            'imei',
            'sim',
            'basic',
            'hra',
            'special',
          ] as const
        ).filter((k) => given(r[k]) !== '' && !(unchanged[k]?.() ?? false));
      };

      // A row that only repeats what we already hold is dropped here, not
      // written — so uploading the same sheet twice is a no-op the second time.
      const preview = staged
        .map((s) => ({ row: s.row, id: s.id, name: s.name, fields: touched(s.source) }))
        .filter((p) => p.fields.length > 0);
      const changing = new Set(preview.map((p) => p.id));
      const toWrite = staged.filter((s) => changing.has(s.id));
      const unchangedCount = staged.length - toWrite.length;

      if (!commit) {
        return { accepted: preview, rejected, committed: false, unchanged: unchangedCount };
      }

      await db.$transaction(async (tx) => {
        for (const s of toWrite) {
          const r = s.source;
          const person: Record<string, unknown> = {};
          if (r.dob?.trim()) {
            const d = bothForms(r.dob);
            if (d.on) {
              person.dob = d.display;
              person.dobOn = d.on;
            }
          }
          if (r.gender?.trim()) person.gender = readGender(r.gender);
          if (r.reportsTo?.trim()) person.reportsToId = r.reportsTo.trim();
          if (Object.keys(person).length) {
            await tx.person.update({ where: { id: s.id }, data: person });
          }

          if (r.phone?.trim() || r.email?.trim()) {
            // Upsert, and only over the columns this row actually carries, so a
            // sheet of emails does not blank out the phone numbers on file.
            const current = await tx.contact.findUnique({ where: { personId: s.id } });
            const phone = r.phone?.trim() || current?.phone || '';
            const email = r.email?.trim() || current?.email || '';
            await tx.contact.upsert({
              where: { personId: s.id },
              create: { personId: s.id, phone, email },
              update: { phone, email },
            });
          }

          const money = [r.basic, r.hra, r.special].some(
            (v) => v != null && String(v).trim() !== '',
          );
          if (money) {
            const current = await tx.salary.findUnique({ where: { personId: s.id } });
            const pick = (v: unknown, was: number) =>
              v != null && String(v).trim() !== '' ? Number(v) || 0 : was;
            const data = {
              basic: pick(r.basic, current?.basic ?? 0),
              hra: pick(r.hra, current?.hra ?? 0),
              special: pick(r.special, current?.special ?? 0),
            };
            await tx.salary.upsert({
              where: { personId: s.id },
              create: { personId: s.id, ...data, pf: 1800, pt: 200, note: 'imported' },
              update: data,
            });
          }

          if (r.imei?.trim()) {
            const already = await tx.device.findFirst({
              where: { personId: s.id, imei: r.imei.trim() },
            });
            if (!already) {
              await tx.device.create({
                data: {
                  personId: s.id,
                  type: 'Phone',
                  model: 'imported',
                  imei: r.imei.trim(),
                  sim: r.sim?.trim() || '—',
                  issued: known.get(s.id)?.joined ?? '',
                },
              });
            }
          }
        }

        if (toWrite.length) {
          await appendInTx(
            tx,
            toWrite.map((s) => ({
              kind: 'import' as const,
              subject: s.id,
              detail: `${s.name} — ${touched(s.source).join(', ')} filled in from a sheet.`,
              who: me.name,
            })),
          );
        }

        await tx.usageCounter.upsert({
          where: { key: 'import:update' },
          create: { key: 'import:update', count: 1 },
          update: { count: { increment: 1 } },
        });
      });

      req.log.info(
        { updated: toWrite.length, rejected: rejected.length, unchanged: unchangedCount },
        'bulk update committed',
      );
      return { accepted: preview, rejected, committed: true, unchanged: unchangedCount };
    },
  );

  app.get(
    '/imports/fields',
    {
      preHandler: app.authenticate,
      schema: {
        tags: ['imports'],
        summary: 'Column names the importer recognises',
        description: 'The UI uses these to auto-match pasted headers.',
        response: { 200: z.any() },
      },
    },
    async () => IMPORT_FIELDS,
  );
};

/** Header aliases, including the ones people actually type. */
const IMPORT_FIELDS = [
  {
    key: 'name',
    label: 'Full name',
    required: true,
    aliases: ['name', 'employee name', 'full name', 'staff name', 'emp name'],
  },
  {
    key: 'id',
    label: 'Employee ID',
    required: false,
    aliases: ['id', 'employee id', 'emp id', 'code', 'empcode', 'employee code', 'emp no'],
  },
  {
    key: 'desig',
    label: 'Designation',
    required: true,
    aliases: ['designation', 'role', 'post', 'title', 'job title', 'position'],
  },
  {
    key: 'dept',
    label: 'Department',
    required: true,
    aliases: ['department', 'dept', 'division', 'section'],
  },
  {
    key: 'office',
    label: 'Office / site',
    required: false,
    aliases: ['office', 'site', 'location', 'posting', 'branch', 'place'],
  },
  {
    key: 'joined',
    label: 'Date of joining',
    required: true,
    aliases: ['doj', 'date of joining', 'joining date', 'joined', 'start date', 'date joined'],
  },
  {
    key: 'dob',
    label: 'Date of birth',
    required: false,
    aliases: ['dob', 'date of birth', 'birth date', 'birthday', 'born'],
  },
  {
    key: 'gender',
    label: 'Gender',
    required: false,
    aliases: ['gender', 'sex', 'm/f', 'male/female'],
  },
  {
    key: 'phone',
    label: 'Personal mobile',
    required: false,
    aliases: [
      'mobile',
      'phone',
      'personal mobile',
      'contact',
      'cell',
      'personal number',
      'mobile no',
    ],
  },
  {
    key: 'email',
    label: 'Personal email',
    required: false,
    aliases: ['email', 'personal email', 'e-mail', 'mail id', 'email id'],
  },
  {
    key: 'imei',
    label: 'Phone IMEI',
    required: false,
    aliases: ['imei', 'imei no', 'device imei'],
  },
  {
    key: 'sim',
    label: 'SIM number',
    required: false,
    aliases: ['sim', 'sim no', 'company number'],
  },
  {
    key: 'basic',
    label: 'Basic',
    required: false,
    aliases: ['basic', 'basic pay', 'basic salary'],
  },
  { key: 'hra', label: 'HRA', required: false, aliases: ['hra', 'house rent allowance'] },
  {
    key: 'special',
    label: 'Special allowance',
    required: false,
    aliases: ['special', 'special allowance', 'other allowance'],
  },
];
