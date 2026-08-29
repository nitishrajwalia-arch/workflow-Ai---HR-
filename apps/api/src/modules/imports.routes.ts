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

import { emailCheck, imeiCheck, normDate, phoneCheck, schemas } from '@marbella/shared';
import type { ImportRow } from '@marbella/shared';
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
