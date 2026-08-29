/**
 * Turning database rows into the shapes the browser already expects.
 *
 * The existing UI reads `person.office`, `person.employer`, `person.notes[]` and
 * a nested `shift` object. Rather than rewrite forty screens, the API hands back
 * exactly that. The relational model underneath is normal and correct; this file
 * is the seam between the two, and it is the ONLY place that seam exists.
 *
 * If you add a column, add it here too or the browser will never see it.
 */

import type { BootstrapPerson } from '@marbella/shared';
import type { Prisma } from '@prisma/client';

export const personInclude = {
  notes: { orderBy: { createdAt: 'desc' } },
  contact: true,
  employer: { select: { id: true, name: true } },
  office: { select: { id: true, name: true, short: true, tint: true } },
} satisfies Prisma.PersonInclude;

type PersonWithRelations = Prisma.PersonGetPayload<{ include: typeof personInclude }>;

export function serialisePerson(p: PersonWithRelations): BootstrapPerson {
  return {
    id: p.id,
    name: p.name,
    designation: p.designation,
    dept: p.dept,
    type: p.type,
    // The UI's `phone` and `email` on a person are the CONTACT fields. Personal,
    // never the company address — see the Contact model.
    phone: p.contact?.phone ?? '',
    email: p.contact?.email ?? '',
    joined: p.joined,
    dob: p.dob,
    status: p.status,
    exitedOn: p.exitedOn,
    perf: p.perf,
    growth: p.growth,
    notes: p.notes.map((n) => ({ when: n.when, text: n.text })),
    office: p.officeId,
    employer: p.employerId,
    reportsTo: p.reportsToId,
    photo: p.photo,
    shift: { in: p.shiftIn, out: p.shiftOut, hours: p.shiftHours },
    imported: p.imported,
  };
}
