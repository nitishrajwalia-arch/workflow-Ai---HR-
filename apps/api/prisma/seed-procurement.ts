/**
 * Seed the procurement, gate, accounts and sales side.
 *
 * Called by prisma/seed.ts after the HR half. Idempotent, like the rest.
 *
 * MONEY: the seed data is written in rupees because that is how the UI wrote
 * it. Everything here multiplies by 100 on the way in — the database stores
 * paise as integers. A purchase order for ₹78,00,000 is not a float.
 */

import type { PrismaClient } from '@prisma/client';
import { hashPassword } from '../src/lib/password.js';
import {
  AREA_GROUPS,
  BANKS_SEED,
  CAL_SEED,
  CAPS_SEED,
  CARDS_SEED,
  CATALOG_SEED,
  COMPANIES_SEED,
  EXP_SEED,
  FIRMS,
  GATELOG_SEED,
  GATEPASS_SEED,
  HRANN_SEED,
  HRTASKS_SEED,
  HOLDS_SEED,
  INVENTORY,
  INVOICES_SEED,
  MOVES_SEED,
  POS,
  PKG_SEED,
  PR_SEED,
  POWERS,
  REPORTS_SEED,
  REQUESTS,
  SALES_SEED,
  SUB_SEED,
  USERS,
  VENDORS,
} from './seed-procurement-data.js';

/** Rupees -> paise. Rounded, because a fraction of a paisa is not money. */
const paise = (rupees: unknown): number => Math.round(Number(rupees ?? 0) * 100);

/**
 * Which desk maps to which permission rank.
 *
 * `userKey` drives the NAV the person sees; `role` drives what the API lets
 * them do. They are deliberately separate: a Store Manager and a Purchase
 * Manager see different screens but hold the same authority.
 */
const DESKS: Record<string, { employeeId: string; role: string; email: string }> = {
  admin: { employeeId: 'MB-ADM-0001', role: 'ADMIN', email: 'nitish@marbellagroup.in' },
  purchase: { employeeId: 'MB-PUR-0012', role: 'MANAGER', email: 'khanna@marbellagroup.in' },
  store: { employeeId: 'MB-STR-0004', role: 'MANAGER', email: 'verma@marbellagroup.in' },
  maintenance: { employeeId: 'MB-MNT-0006', role: 'MANAGER', email: 'chauhan@marbellagroup.in' },
  accounts: { employeeId: 'MB-ACC-0002', role: 'MANAGER', email: 'nair@marbellagroup.in' },
  hr: { employeeId: 'MB-HR-0001', role: 'HR', email: 'simran@marbellagroup.in' },
  purchaseAsst: { employeeId: 'MB-PUR-0018', role: 'VIEWER', email: 'sethi@marbellagroup.in' },
  storeAsst: { employeeId: 'MB-STR-0009', role: 'VIEWER', email: 'rana@marbellagroup.in' },
  security: { employeeId: 'MB-SEC-0007', role: 'VIEWER', email: 'gate.grand@marbellagroup.in' },
};

export async function seedProcurement(
  prisma: PrismaClient,
  opts: { defaultPassword: string; announce: (line: string) => void },
): Promise<void> {
  const { announce } = opts;

  /* ------------------------------------------------------------ accounts */

  // One real account per desk. Before this, the Sign in button called
  // onLogin("admin") and handed every visitor the Chairman's screen.
  let created = 0;
  for (const [userKey, desk] of Object.entries(DESKS)) {
    const meta = USERS[userKey] as { name: string } | undefined;
    if (!meta) continue;
    const existing = await prisma.user.findUnique({ where: { email: desk.email } });
    if (existing) {
      // Keep the desk mapping current without touching an existing password.
      await prisma.user.update({
        where: { id: existing.id },
        data: { userKey, employeeId: desk.employeeId },
      });
      continue;
    }
    const person = await prisma.person.findUnique({ where: { id: desk.employeeId } });
    await prisma.user.create({
      data: {
        email: desk.email,
        name: meta.name,
        employeeId: desk.employeeId,
        userKey,
        role: desk.role as never,
        personId: person?.id ?? null,
        passwordHash: await hashPassword(opts.defaultPassword),
        mustChangePassword: true,
      },
    });
    created++;
  }
  announce(`  desks        ${Object.keys(DESKS).length} (${created} accounts created)`);

  /* --------------------------------------------------------------- firms */

  for (const f of FIRMS) {
    await prisma.firm.upsert({
      where: { id: f.id },
      create: { id: f.id, short: f.short, name: f.name, firm: f.firm, gstin: f.gstin ?? '', rera: f.rera ?? '', stage: f.stage ?? 'building', addr: f.addr ?? '' },
      update: { short: f.short, name: f.name, firm: f.firm, gstin: f.gstin ?? '', rera: f.rera ?? '', stage: f.stage ?? 'building', addr: f.addr ?? '' },
    });
  }
  announce(`  firms        ${FIRMS.length}`);

  /* ------------------------------------------------------------- vendors */

  for (const [i, v] of (VENDORS as Array<Record<string, string>>).entries()) {
    const phone = `+91 ${98140 + i * 7} ${String(10000 + i * 373).slice(0, 5)}`;
    const status = i === 0 || i === 4 ? 'verified' : i === 1 ? 'pending' : 'unverified';
    await prisma.vendor.upsert({
      where: { code: v.code as string },
      create: {
        code: v.code as string,
        name: v.name as string,
        cat: v.cat ?? '',
        terms: v.terms ?? '',
        phone,
        whatsapp: phone,
        email: `billing@${String(v.name).toLowerCase().replace(/[^a-z0-9]+/g, '').slice(0, 14)}.in`,
        status: status as never,
        vcode: i === 0 ? 'MB-V-0001' : i === 4 ? 'MB-V-0002' : '',
      },
      update: { name: v.name as string, cat: v.cat ?? '', terms: v.terms ?? '' },
    });
  }
  announce(`  vendors      ${VENDORS.length}`);

  /* ------------------------------------------------- purchase orders / PRs */

  for (const po of POS) {
    const vendorRow = await prisma.vendor.findFirst({
      where: { name: { startsWith: String(po.vendor).split(' — ')[0].slice(0, 12) } },
    });
    await prisma.purchaseOrder.upsert({
      where: { id: po.id },
      create: {
        id: po.id,
        vendorCode: vendorRow?.code ?? null,
        vendorName: po.vendor,
        item: po.item,
        amt: paise(po.amt),
        status: po.status ?? 'Approved',
        del: (po.del ?? null) as never,
      },
      update: { status: po.status ?? 'Approved', amt: paise(po.amt) },
    });
  }
  for (const pr of PR_SEED) {
    await prisma.purchaseRequest.upsert({
      where: { id: pr.id },
      create: { id: pr.id, item: pr.item, qty: pr.qty, when: pr.when ?? '', proj: pr.proj ?? '', by: pr.by ?? '' },
      update: {},
    });
  }
  for (const rq of REQUESTS) {
    await prisma.requisition.upsert({
      where: { id: rq.id },
      create: { id: rq.id, dept: rq.dept, item: rq.item, qty: rq.qty ?? '' },
      update: {},
    });
  }
  announce(`  orders       ${POS.length} POs · ${PR_SEED.length} PRs · ${REQUESTS.length} requisitions`);

  /* ----------------------------------------------------------- inventory */

  for (const row of INVENTORY) {
    await prisma.inventoryItem.upsert({
      where: { item: row.item },
      create: { item: row.item, unit: row.unit, qty: Number(row.qty), reorder: Number(row.reorder), loc: row.loc ?? '', proj: row.proj ?? '' },
      update: { unit: row.unit, reorder: Number(row.reorder), loc: row.loc ?? '', proj: row.proj ?? '' },
    });
  }
  for (const h of HOLDS_SEED) {
    const exists = await prisma.hold.findFirst({ where: { itemName: h.item, by: h.by } });
    if (exists) continue;
    await prisma.hold.create({
      data: { itemName: h.item, qty: Number(h.qty), unit: h.unit ?? '', days: Number(h.days ?? 0), by: h.by, why: h.why ?? '' },
    });
  }
  if ((await prisma.stockMove.count()) === 0) {
    for (const m of MOVES_SEED) {
      await prisma.stockMove.create({
        data: { dir: m.dir, item: m.item, qty: Number(m.qty), unit: m.unit ?? '', ref: m.ref ?? '', bill: m.bill ?? '', who: m.who ?? '', note: m.note ?? '', createdAt: new Date(m.at) },
      });
    }
  }
  for (const c of CAPS_SEED) {
    await prisma.storageCap.upsert({
      where: { item_proj: { item: c.item, proj: c.proj } },
      create: { item: c.item, proj: c.proj, max: Number(c.max), unit: c.unit ?? '', why: c.why ?? '' },
      update: { max: Number(c.max), why: c.why ?? '' },
    });
  }
  announce(`  store        ${INVENTORY.length} items · ${HOLDS_SEED.length} holds · ${MOVES_SEED.length} moves · ${CAPS_SEED.length} caps`);

  /* ---------------------------------------------------------------- gate */

  for (const g of GATEPASS_SEED) {
    await prisma.gatePass.upsert({
      where: { id: g.id },
      create: { id: g.id, poId: null, vendor: g.vendor, items: g.items, total: paise(g.total), by: g.by, status: g.status ?? 'expected', createdAt: new Date(g.at) },
      update: { status: g.status ?? 'expected' },
    });
  }
  if ((await prisma.gateEvent.count()) === 0) {
    for (const e of GATELOG_SEED) {
      await prisma.gateEvent.create({
        data: { outcome: e.outcome, label: e.label, plate: e.plate ?? '', guard: e.guard ?? '', guardId: e.guardId ?? '', post: e.post ?? '', who: e.who ?? '', note: e.note ?? '', at: new Date(e.at) },
      });
    }
  }
  announce(`  gate         ${GATEPASS_SEED.length} passes · ${GATELOG_SEED.length} decisions`);

  /* --------------------------------------------------------- submittals */

  for (const s of SUB_SEED) {
    await prisma.submittal.upsert({
      where: { id: s.id },
      create: { id: s.id, title: s.title, fromName: s.fromName, fromDept: s.fromDept, to: s.to, status: s.status ?? 'sent' },
      update: { status: s.status ?? 'sent' },
    });
    for (const v of s.versions ?? []) {
      await prisma.submittalVersion.upsert({
        where: { submittalId_v: { submittalId: s.id, v: v.v } },
        create: { submittalId: s.id, v: v.v, fileName: v.fileName, by: v.by, note: v.note ?? '', at: new Date(v.at) },
        update: {},
      });
    }
  }
  announce(`  submittals   ${SUB_SEED.length}`);

  /* ------------------------------------------------------------ accounts */

  for (const v of INVOICES_SEED) {
    await prisma.vendorInvoice.upsert({
      where: { id: v.id },
      create: { id: v.id, from: v.from ?? '', vendor: v.vendor, subj: v.subj ?? '', amt: paise(v.amt), po: v.po ?? '', gstin: !!v.gstin, age: v.age ?? '', state: v.state ?? 'toclear' },
      update: { state: v.state ?? 'toclear' },
    });
  }
  for (const e of EXP_SEED) {
    await prisma.expense.upsert({
      where: { id: e.id },
      create: { id: e.id, cat: e.cat, dept: e.dept, amt: paise(e.amt), party: e.party ?? '', date: e.date ?? '', src: e.src ?? '', how: e.how ?? '', ok: e.ok !== false },
      update: {},
    });
  }
  for (const s of SALES_SEED) {
    await prisma.sale.upsert({
      where: { id: s.id },
      create: {
        id: s.id, unit: s.unit, tower: s.tower ?? '', proj: s.proj ?? '', firm: s.firm ?? '',
        plan: s.plan ?? '', price: paise(s.price), booked: s.booked ?? '', buyer: s.buyer,
        phone: s.phone ?? '', email: s.email ?? '', received: (s.received ?? []) as never,
      },
      update: {},
    });
  }
  for (const b of BANKS_SEED) {
    await prisma.bankAccount.upsert({
      where: { id: b.id },
      create: { id: b.id, bank: b.bank, acc: b.acc, type: b.type ?? '', firm: b.firm ?? '', till: b.till ?? '', gaps: (b.gaps ?? []) as never, bal: paise(b.bal) },
      update: { bal: paise(b.bal), gaps: (b.gaps ?? []) as never, till: b.till ?? '' },
    });
  }
  for (const c of CARDS_SEED) {
    await prisma.creditCard.upsert({
      where: { id: c.id },
      create: { id: c.id, bank: c.bank, last: c.last, holder: c.holder, limit: paise(c.limit), used: paise(c.used), cycle: c.cycle ?? '', due: c.due ?? '', firm: c.firm ?? '' },
      update: { used: paise(c.used) },
    });
  }
  for (const co of COMPANIES_SEED) {
    await prisma.masterCompany.upsert({
      where: { id: co.id },
      create: { id: co.id, name: co.name, kind: co.kind ?? '', gstin: co.gstin ?? '', pan: co.pan ?? '', city: co.city ?? '' },
      update: { name: co.name, gstin: co.gstin ?? '', pan: co.pan ?? '' },
    });
  }
  announce(`  accounts     ${INVOICES_SEED.length} invoices · ${EXP_SEED.length} expenses · ${SALES_SEED.length} sales · ${BANKS_SEED.length} banks · ${CARDS_SEED.length} cards`);

  /* ------------------------------------------------ catalog, reports, misc */

  for (const c of CATALOG_SEED) {
    await prisma.catalogItem.upsert({
      where: { name: c.name },
      create: { name: c.name, unit: c.unit ?? '', rate: paise(c.rate), vendor: c.vendor ?? '' },
      update: { rate: paise(c.rate), vendor: c.vendor ?? '' },
    });
  }
  if ((await prisma.siteReport.count()) === 0) {
    for (const r of REPORTS_SEED) {
      await prisma.siteReport.create({
        data: { cat: r.cat, by: r.by, proj: r.proj ?? '', text: r.text ?? '', severity: r.sev ?? 'low', media: (r.voice ? [{ kind: 'voice', dur: r.voice.dur }] : []) as never },
      });
    }
  }
  for (const e of CAL_SEED) {
    const exists = await prisma.calendarEvent.findFirst({ where: { title: e.title, date: e.date } });
    if (exists) continue;
    await prisma.calendarEvent.create({
      data: { title: e.title, date: e.date, time: e.time ?? '', kind: e.kind ?? 'task', priority: e.priority ?? 'normal', audience: (e.audience ?? { type: 'all' }) as never, by: e.by ?? '', note: e.note ?? '' },
    });
  }
  for (const p of PKG_SEED) {
    const exists = await prisma.incentivePackage.findFirst({ where: { name: p.name } });
    if (exists) continue;
    await prisma.incentivePackage.create({
      data: { name: p.name, amount: paise(p.amount), threshold: Number(p.threshold ?? 0), scale: Number(p.scale ?? 10), dept: p.dept ?? '', period: p.period ?? '', how: p.how ?? '', status: p.status ?? 'proposed' },
    });
  }
  for (const t of HRTASKS_SEED) {
    const exists = await prisma.hrTask.findFirst({ where: { text: t.text } });
    if (exists) continue;
    await prisma.hrTask.create({ data: { text: t.text, who: t.who ?? '', due: t.due ?? '', done: !!t.done } });
  }
  for (const a of HRANN_SEED) {
    const exists = await prisma.announcement.findFirst({ where: { text: a.text } });
    if (exists) continue;
    await prisma.announcement.create({ data: { text: a.text, by: a.by ?? '' } });
  }
  for (const key of ['google', 'meta', 'claude']) {
    await prisma.connection.upsert({ where: { key }, create: { key, connected: false }, update: {} });
  }
  announce(`  catalog      ${CATALOG_SEED.length} rates · ${CAL_SEED.length} events · ${PKG_SEED.length} incentive schemes`);

  /* -------------------------------------------------------- access grants */

  // The Access console used to announce "Access updated for X" and forget it.
  // The grants are rows now, so the announcement is true.
  if ((await prisma.accessGrant.count()) === 0) {
    // AREA_GROUPS is [groupLabel, [[areaKey, areaLabel], ...]] tuples.
    const areas: string[] = (AREA_GROUPS as Array<[string, Array<[string, string]>]>)
      .flatMap(([, items]) => items.map(([key]) => key));
    const powers: string[] = (POWERS as Array<[string, string]>).map((p) => p[0]);
    const rows: Array<{ userKey: string; area: string; power: string; granted: boolean }> = [];
    for (const userKey of Object.keys(USERS)) {
      for (const area of areas) {
        for (const power of powers) {
          // The Chairman starts with everything; every other desk starts with
          // read-only on its own areas and nothing else. Widening is a
          // deliberate act by an administrator, recorded against their name.
          const granted = userKey === 'admin' ? true : power === 'view';
          rows.push({ userKey, area, power, granted });
        }
      }
    }
    await prisma.accessGrant.createMany({ data: rows, skipDuplicates: true });
    announce(`  access       ${rows.length} grants across ${Object.keys(USERS).length} desks`);
  }
}
