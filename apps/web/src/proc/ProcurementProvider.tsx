/**
 * The seam between MarbellaProcurementOS.jsx and a live server.
 *
 * Same shape as the HR provider and the same rules:
 *
 *   1. Fetch the whole world once from /bootstrap, in exactly the keys the
 *      screens already destructure out of ProcCtx.
 *   2. Apply each change locally so the screen responds at once.
 *   3. On failure, PUT THE OLD STATE BACK and show the server's own message.
 *
 * Step 3 is the one people skip, and skipping it is worse than not being
 * optimistic at all: the screen shows a purchase order that was never raised.
 *
 * ANYTHING THE SERVER DECIDES IS NEVER GUESSED AT HERE — purchase order
 * numbers, vendor codes, card versions, ledger seals, stock levels after a
 * move. Those actions await the server and use what comes back.
 */

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { verifyChainNewestFirst } from '@marbella/shared';
import { ApiError, api } from '../lib/api.js';
import { ProcCtx, type ProcValue } from './context.js';

type Toast = (message: string, tone?: string) => void;

/** The bootstrap payload. Loosely typed: the legacy screens read it freely. */
type World = Record<string, any>;

interface Props {
  children: ReactNode;
  toast: Toast;
}

export function ProcurementProvider({ children, toast }: Props) {
  const [world, setWorld] = useState<World | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [chainOk, setChainOk] = useState<boolean | null>(null);

  // Screen-local state: these were never persisted and should not be. Which
  // firm you are looking at, which vendor card is open, whether the coach is
  // running — none of that is anyone else's business or worth a round trip.
  const [firmId, setFirmId] = useState<string>('grand');
  const [openVendor, setOpenVendor] = useState<string | null>(null);
  const [scope, setScope] = useState<string>('group');
  const [coachOn, setCoachOn] = useState(true);
  const [coachRun, setCoachRun] = useState<string | null>(null);

  const ref = useRef<World | null>(null);
  ref.current = world;

  const load = useCallback(async () => {
    setError(null);
    try {
      const payload = await api.get<World>('/bootstrap');
      setWorld(payload);
      // Recompute every ledger seal in the browser rather than trusting the
      // server's word: a tampered server would report its own ledger healthy.
      const r = await verifyChainNewestFirst(payload.ledger ?? []);
      setChainOk(r.ok);
      if (!r.ok) toast('The ledger does not verify. Do not rely on it until it is looked at.', 'red');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not load. Check the connection.');
    }
  }, [toast]);

  useEffect(() => {
    void load();
  }, [load]);

  /** Change locally, then send. On failure, restore and say why. */
  const optimistic = useCallback(
    async <T,>(apply: (w: World) => World, send: () => Promise<T>): Promise<T | null> => {
      const before = ref.current;
      if (!before) return null;
      setWorld(apply(before));
      try {
        return await send();
      } catch (err) {
        setWorld(before);
        toast(err instanceof ApiError ? err.full : 'That did not save. Nothing changed.', 'red');
        return null;
      }
    },
    [toast],
  );

  /** For anything whose result the server decides. Nothing is shown until it answers. */
  const server = useCallback(
    async <T,>(send: () => Promise<T>, onDone?: (r: T, w: World) => World): Promise<T | null> => {
      try {
        const r = await send();
        if (onDone) setWorld((w) => (w ? onDone(r, w) : w));
        return r;
      } catch (err) {
        toast(err instanceof ApiError ? err.full : 'That did not save. Nothing changed.', 'red');
        return null;
      }
    },
    [toast],
  );

  const value = useMemo<ProcValue | null>(() => {
    if (!world) return null;
    const w = world;

    /** Re-read one collection after the server changed it in a way we cannot mirror. */
    const refetch = async (key: string, path: string) => {
      try {
        const rows = await api.get<unknown>(path);
        setWorld((x) => (x ? { ...x, [key]: rows } : x));
      } catch {
        // Leave it; the next full load corrects it.
      }
    };
    const refreshLedger = async () => {
      try {
        const { items } = await api.get<{ items: unknown[] }>('/ledger?pageSize=200');
        setWorld((x) => (x ? { ...x, ledger: items } : x));
        setChainOk((await verifyChainNewestFirst(items as never)).ok);
      } catch {
        /* the next load corrects it */
      }
    };

    const proc: ProcValue = {
      /* ---------------------------------------------- the collections ---- */
      people: w.people, cardLog: w.cardLog, ledger: w.ledger, salaries: w.salaries,
      devices: w.devices, contacts: w.contacts, leavePolicy: w.leavePolicy,
      deptRules: w.deptRules, companies: w.companies, projects: w.projects,
      exits: w.exits, usage: w.usage, docLog: w.docLog, jds: w.jds,
      offices: w.offices, hrLog: w.hrLog, hrTasks: w.hrTasks, hrAnn: w.hrAnn,
      att: w.att, packages: w.packages, events: w.events, catalog: w.catalog,
      vendors: w.vendors, subs: w.subs, gatepasses: w.gatepasses, gateLog: w.gateLog,
      holds: w.holds, moves: w.moves, inv: w.inv, caps: w.caps, pos: w.pos,
      prs: w.prs, reqs: w.reqs, invoices: w.invoices, reports: w.reports,
      drafts: w.drafts, conns: w.conns, reminders: w.reminders, exports: w.exports ?? [],
      expenses: w.expenses, sales: w.sales, banks: w.banks, creditCards: w.creditCards,
      masters: w.masters, grants: w.grants,

      /* --------------------------------------------------- screen-local ---- */
      firms: w.firms,
      activeFirm: (w.firms ?? []).find((f: any) => f.id === firmId) ?? w.firms?.[0],
      setFirm: setFirmId,
      openVendor, setOpenVendor,
      scope, setScope,
      coachOn, setCoachOn,
      coachRun, startCoach: (id: string) => setCoachRun(id), stopCoach: () => setCoachRun(null),

      /* ------------------------------------------------------- new keys ---- */
      me: w.me,
      ledgerHealth: w.ledgerHealth,
      /** The browser's own verdict on the chain. null while it is computing. */
      chainVerified: chainOk,
      reload: load,

      /* -------------------------------------------------------- actions ---- */

      // Usage counting is fire-and-forget. It must never block a screen.
      track: (k: string) => {
        setWorld((x) => (x ? { ...x, usage: { ...x.usage, [k]: (x.usage?.[k] ?? 0) + 1 } } : x));
        void api.post('/usage/track', { key: k, count: 1 }).catch(() => undefined);
      },

      /* ---- buying ---- */
      addPO: (po: any) =>
        server(
          () => api.post<any>('/purchase-orders', {
            vendor: po.vendor, item: po.item, amt: Number(po.amt) || 0, lines: po.lines ?? [],
          }),
          (r, x) => {
            // The server warns when the vendor has never been verified. Nobody
            // has checked their GSTIN, and that is how a fake supplier gets paid.
            if (r?.warning) toast(r.warning, 'amber');
            return { ...x, pos: [r, ...x.pos] };
          },
        ).then((r) => { if (r) void refreshLedger(); return r; }),

      addPR: (pr: any) =>
        server(() => api.post<any>('/purchase-requests', { item: pr.item, qty: pr.qty, when: pr.when ?? '', proj: pr.proj ?? '' }),
          (r, x) => ({ ...x, prs: [r, ...x.prs] })),
      fulfillPR: (id: string) =>
        optimistic((x) => ({ ...x, prs: x.prs.filter((p: any) => p.id !== id) }),
          () => api.post(`/purchase-requests/${id}/close`, { state: 'fulfilled' })),

      addReq: (r: any) =>
        server(() => api.post<any>('/requisitions', { dept: r.dept, item: r.item, qty: r.qty ?? '' }),
          (row, x) => ({ ...x, reqs: [row, ...x.reqs] })),
      fulfillReq: (id: string) =>
        optimistic((x) => ({ ...x, reqs: x.reqs.filter((r: any) => r.id !== id) }),
          () => api.post(`/requisitions/${id}/close`)),

      /* ---- vendors ---- */
      addVendor: (v: any) =>
        server(() => api.post<any>('/vendors', v), (r, x) => ({ ...x, vendors: [r, ...x.vendors] })),
      addVendors: (list: any[]) =>
        server(() => api.post<any>('/vendors/import', { rows: list, commit: true }))
          .then(async (r) => { if (r) await refetch('vendors', '/vendors'); return r; }),
      verifyVendor: (code: string, patch: any) =>
        server(() => api.post<any>(`/vendors/${code}/verify`, patch),
          (r, x) => ({ ...x, vendors: x.vendors.map((v: any) => (v.code === code ? r : v)) })),

      /* ---- store ---- */
      addItem: (it: any) =>
        server(() => api.post<any>('/inventory', it), (r, x) => ({ ...x, inv: [{ ...r, held: 0, available: r.qty }, ...x.inv] })),
      // `adjustItem` used to add a delta straight into local state. It goes
      // through the server now, because the server is what knows about holds
      // and caps — and what refuses when the shelf cannot take it.
      adjustItem: (name: string, delta: number, meta: any = {}) =>
        server(
          () => api.post<any>('/inventory/move', {
            dir: delta >= 0 ? 'in' : 'out', item: name, qty: Math.abs(delta),
            ref: meta.ref ?? '', bill: meta.bill ?? '', note: meta.note ?? '', override: meta.override,
          }),
          (r, x) => ({
            ...x,
            inv: x.inv.map((i: any) => (i.item === name ? { ...i, qty: r.newQty, available: Math.max(0, r.newQty - (i.held ?? 0)) } : i)),
            moves: [r, ...x.moves],
          }),
        ),
      placeHold: (h: any) =>
        server(() => api.post<any>('/holds', { item: h.item, qty: Number(h.qty), unit: h.unit ?? '', days: Number(h.days) || 0, why: h.why ?? 'No reason given.' }),
          (r, x) => ({
            ...x, holds: [r, ...x.holds],
            inv: x.inv.map((i: any) => (i.item === r.item ? { ...i, held: (i.held ?? 0) + r.qty, available: Math.max(0, i.qty - ((i.held ?? 0) + r.qty)) } : i)),
          })),
      releaseHold: (id: string) =>
        optimistic((x) => {
          const gone = x.holds.find((h: any) => h.id === id);
          return {
            ...x, holds: x.holds.filter((h: any) => h.id !== id),
            inv: gone ? x.inv.map((i: any) => (i.item === gone.item ? { ...i, held: Math.max(0, (i.held ?? 0) - gone.qty), available: Math.min(i.qty, (i.available ?? 0) + gone.qty) } : i)) : x.inv,
          };
        }, () => api.del(`/holds/${id}`)),
      addMove: (m: any) =>
        server(() => api.post<any>('/inventory/move', { dir: m.dir, item: m.item, qty: Number(m.qty), unit: m.unit ?? '', ref: m.ref ?? '', bill: m.bill ?? '', note: m.note ?? '' }),
          (r, x) => ({ ...x, moves: [r, ...x.moves] })),
      setCap: (c: any) =>
        optimistic((x) => ({ ...x, caps: [c, ...x.caps.filter((y: any) => !(y.item === c.item && y.proj === c.proj))] }),
          () => api.put('/caps', c)),
      learnItem: (name: string, unit: string, rate: any, vendor: string) => {
        if (!name?.trim()) return Promise.resolve(null);
        return optimistic(
          (x) => ({ ...x, catalog: [{ name: name.trim(), unit, rate: Number(rate) || 0, vendor }, ...x.catalog.filter((c: any) => c.name.toLowerCase() !== name.trim().toLowerCase())] }),
          () => api.put('/catalog', { name: name.trim(), unit: unit || '', rate: Number(rate) || 0, vendor: vendor || '' }),
        );
      },

      /* ---- gate ---- */
      issueGatePass: (g: any) =>
        server(() => api.post<any>('/gate-passes', { id: g.id, po: g.po, vendor: g.vendor, items: g.items, total: Number(g.total) || 0 }),
          (r, x) => ({ ...x, gatepasses: [r, ...x.gatepasses.filter((p: any) => p.id !== r.id)] })),
      markPass: (id: string, patch: any) =>
        optimistic((x) => ({ ...x, gatepasses: x.gatepasses.map((p: any) => (p.id === id ? { ...p, ...patch } : p)) }),
          () => api.patch(`/gate-passes/${id}`, { status: patch.status ?? 'arrived' })),
      logGate: (e: any) =>
        server(
          () => api.post<any>('/gate-events', {
            outcome: e.outcome, label: e.label ?? '', plate: e.plate ?? '', post: e.post ?? '',
            who: e.who ?? '', note: e.note ?? '', evidence: e.evidence ?? [], passId: e.passId,
          }),
          (r, x) => {
            // A plate that does not look like a plate is worth saying, but never
            // worth refusing: a guard who cannot log a real truck writes it on
            // paper instead, and then there is no record at all.
            if (r?.plateWarning) toast(r.plateWarning, 'amber');
            return { ...x, gateLog: [r, ...x.gateLog] };
          },
        ),

      /* ---- submittals ---- */
      sendSub: (s: any) =>
        server(() => api.post<any>('/submittals', { title: s.title, to: s.to, fileName: s.fileName, note: s.note ?? '' }),
          (r, x) => ({ ...x, subs: [r, ...x.subs] })),
      reviseSub: (id: string, patch: any) =>
        server(() => api.post<any>(`/submittals/${id}/revise`, { fileName: patch.fileName, note: patch.note ?? '' }),
          (r, x) => ({ ...x, subs: x.subs.map((s: any) => (s.id === id ? r : s)) })),

      /* ---- money ---- */
      clearInvoice: (id: string) =>
        optimistic((x) => ({ ...x, invoices: x.invoices.map((v: any) => (v.id === id ? { ...v, state: 'cleared' } : v)) }),
          () => api.post(`/invoices/${id}/clear`, {})),
      queueReminder: (r: any) =>
        server(() => api.post<any>('/reminders', { saleId: r.saleId, buyer: r.buyer ?? '', channel: r.channel ?? '', subject: r.subject ?? '', body: r.body ?? '' }),
          (row, x) => {
            // Honest: drafted and queued, not sent. There is no gateway.
            if (row?.deliveryNote) toast(row.deliveryNote, 'amber');
            return { ...x, reminders: [row, ...x.reminders] };
          }),
      approveReminder: (idx: number) => {
        const rem = w.reminders?.[idx];
        if (!rem) return Promise.resolve(null);
        return optimistic((x) => ({ ...x, reminders: x.reminders.map((r: any, i: number) => (i === idx ? { ...r, approved: true } : r)) }),
          () => api.post(`/reminders/${rem.id}/approve`));
      },
      registerExport: (e: any) =>
        optimistic((x) => ({ ...x, exports: [e, ...(x.exports ?? []).filter((y: any) => y.key !== e.key)] }),
          () => api.post('/exports', { key: e.key, title: e.title ?? '', rows: Number(e.rows) || 0, period: e.period ?? '' })),

      /* ---- platform ---- */
      addEvent: (e: any) =>
        server(() => api.post<any>('/events', { title: e.title, date: e.date, time: e.time ?? '', kind: e.kind ?? 'task', priority: e.priority ?? 'normal', audience: e.audience ?? { type: 'all' }, note: e.note ?? '' }),
          (r, x) => ({ ...x, events: [r, ...x.events] })),
      delEvent: (id: string) =>
        optimistic((x) => ({ ...x, events: x.events.filter((e: any) => e.id !== id) }), () => api.del(`/events/${id}`)),

      addPackage: (pk: any) =>
        server(() => api.post<any>('/incentives', { name: pk.name, amount: Number(pk.amount) || 0, threshold: Number(pk.threshold) || 0, scale: Number(pk.scale) || 10, dept: pk.dept ?? '', period: pk.period ?? '', how: pk.how ?? '' }),
          (r, x) => ({ ...x, packages: [r, ...x.packages] })),
      approvePackage: (id: string) =>
        server(() => api.post<any>(`/incentives/${id}/decide`, { action: 'approve' }),
          (r, x) => ({ ...x, packages: x.packages.map((p: any) => (p.id === id ? r : p)) })),
      declinePackage: (id: string) =>
        server(() => api.post<any>(`/incentives/${id}/decide`, { action: 'decline' }),
          (r, x) => ({ ...x, packages: x.packages.map((p: any) => (p.id === id ? r : p)) })),
      issueBonus: (id: string, who: string) =>
        server(() => api.post<any>(`/incentives/${id}/decide`, { action: 'issue', who }),
          (r, x) => ({ ...x, packages: x.packages.map((p: any) => (p.id === id ? r : p)) })),

      importAtt: (rows: any[], source: string) =>
        server(() => api.post<any>('/attendance/import', { source, rows }))
          .then(async (r) => {
            // Rows for people who are not on the roster are the usual sign that
            // the wrong export was picked. Say so rather than swallowing it.
            if (r?.note) toast(r.note, 'amber');
            if (r) await refetch('att', '/attendance');
            return r;
          }),

      addHrTask: (t: any) =>
        server(() => api.post<any>('/hr-tasks', { text: t.text, who: t.who ?? '', due: t.due ?? '' }),
          (r, x) => ({ ...x, hrTasks: [r, ...x.hrTasks] })),
      toggleHrTask: (id: string) =>
        optimistic((x) => ({ ...x, hrTasks: x.hrTasks.map((t: any) => (t.id === id ? { ...t, done: !t.done } : t)) }),
          () => api.post(`/hr-tasks/${id}/toggle`)),
      addAnn: (a: any) =>
        server(() => api.post<any>('/announcements', { text: a.text }), (r, x) => ({ ...x, hrAnn: [r, ...x.hrAnn] })),

      addReport: (r: any) =>
        server(() => api.post<any>('/site-reports', { cat: r.cat, proj: r.proj ?? '', text: r.text ?? '', severity: r.sev ?? 'low', media: r.media ?? [] }),
          (row, x) => ({ ...x, reports: [row, ...x.reports] })),

      connect: (k: string) =>
        optimistic((x) => ({ ...x, conns: { ...x.conns, [k]: true } }), () => api.post(`/connections/${k}`, { connected: true })),
      disconnect: (k: string) =>
        optimistic((x) => ({ ...x, conns: { ...x.conns, [k]: false } }), () => api.post(`/connections/${k}`, { connected: false })),

      saveDraft: (type: string, label: string, data: any) =>
        optimistic((x) => ({ ...x, drafts: [{ type, label, data, when: 'just now' }, ...(x.drafts ?? []).filter((d: any) => d.type !== type)] }),
          () => api.put(`/drafts/${type}`, { label, data })),
      dropDraft: (type: string) =>
        optimistic((x) => ({ ...x, drafts: (x.drafts ?? []).filter((d: any) => d.type !== type) }), () => api.del(`/drafts/${type}`)),

      /**
       * Save access grants.
       *
       * The console used to announce "Access updated for {name}" and change
       * nothing. This actually writes, and the announcement is now true.
       */
      saveGrants: (userKey: string, changes: any[]) =>
        server(() => api.post<any>('/access', { userKey, changes }),
          (r, x) => ({ ...x, grants: { ...x.grants, [userKey]: r.grants } })),

      /**
       * Raise a withdrawal against an account.
       *
       * The button for this used to say "Withdrawal request raised to bank" and
       * do nothing whatsoever. RERA escrow money is not the developer's to move:
       * the server refuses without all three certifications, and refuses an
       * amount the account does not hold. What it does NOT do is talk to a bank
       * — the response says so, and the screen shows that.
       */
      raiseWithdrawal: (accountId: string, purpose: string, amount = 0, certifications = { engineer: true, architect: true, ca: true }) =>
        server(() => api.post<any>(`/banks/${accountId}/withdrawal`, { amount, purpose, certifications })),

      /** Check the Chairman's override code. Server-side, rate-limited, sealed. */
      checkOverride: (code: string, what: string) =>
        api.post<{ ok: true; authorisedBy: string }>('/override/verify', { code, what })
          .then((r) => r.authorisedBy)
          .catch((err) => { toast(err instanceof ApiError ? err.message : 'Override refused.', 'red'); return null; }),

      /* ---- HR, unchanged from the HR build ---- */
      logDoc: (d: any) =>
        server(() => api.post<any>('/documents', { tpl: d.tpl, pid: d.pid, company: d.company, via: d.via ?? 'print', subject: d.subject ?? '', body: d.body ?? '' }),
          (r, x) => {
            if (r?.warning) toast(r.warning, 'amber');
            else if (String(d.via) === 'email') toast(r.deliveryNote, 'amber');
            return { ...x, docLog: [r, ...x.docLog] };
          }),
      saveJD: (role: string, jd: string) =>
        optimistic((x) => ({ ...x, jds: { ...x.jds, [role]: jd } }), () => api.put('/job-descriptions', { role, jd })),
      setSalary: (pid: string, sal: any) =>
        optimistic((x) => ({ ...x, salaries: { ...x.salaries, [pid]: { ...x.salaries[pid], ...sal } } }),
          () => api.put(`/salaries/${pid}`, { ...w.salaries[pid], ...sal })),
      setContact: (pid: string, c: any) =>
        optimistic((x) => ({ ...x, contacts: { ...x.contacts, [pid]: { ...x.contacts[pid], ...c } } }),
          () => api.put(`/contacts/${pid}`, { phone: '', email: '', vPhone: false, vEmail: false, ...w.contacts[pid], ...c })),
      addDevice: (d: any) =>
        server(() => api.post<any>('/devices', d), (r, x) => ({ ...x, devices: [r, ...x.devices] })),
      dropDevice: (id: string) =>
        optimistic((x) => ({ ...x, devices: x.devices.filter((d: any) => d.id !== id) }), () => api.del(`/devices/${id}`)),
      setLeave: (dept: string, v: any) =>
        optimistic((x) => ({ ...x, leavePolicy: { ...x.leavePolicy, [dept]: { ...x.leavePolicy[dept], ...v } } }),
          () => api.put(`/leave-policy/${encodeURIComponent(dept)}`, { ...w.leavePolicy[dept], ...v })),
      setDeptRule: (d: string, r: any) =>
        optimistic((x) => ({ ...x, deptRules: { ...x.deptRules, [d]: { ...x.deptRules[d], ...r } } }),
          () => api.put(`/dept-rules/${encodeURIComponent(d)}`, { ...w.deptRules[d], ...r })),
      saveCompany: (c: any) =>
        optimistic((x) => ({ ...x, companies: x.companies.some((y: any) => y.id === c.id) ? x.companies.map((y: any) => (y.id === c.id ? { ...y, ...c } : y)) : [...x.companies, c] }),
          () => { const { id, ...rest } = c; return api.put(`/companies/${id}`, rest); }),
      saveProject: (p: any) =>
        optimistic((x) => ({ ...x, projects: x.projects.some((y: any) => y.id === p.id) ? x.projects.map((y: any) => (y.id === p.id ? { ...y, ...p } : y)) : [...x.projects, p] }),
          () => { const { id, ...rest } = p; return api.put(`/projects/${id}`, rest); }),
      setEmployer: (pid: string, cid: string, reason?: string) =>
        optimistic((x) => ({ ...x, people: x.people.map((p: any) => (p.id === pid ? { ...p, employer: cid } : p)) }),
          () => api.post(`/people/${pid}/employer`, { employer: cid, reason: reason?.trim() || 'Changed from the people screen. No reason was recorded.' })),
      updatePerson: (id: string, patch: any) =>
        optimistic((x) => ({ ...x, people: x.people.map((p: any) => (p.id === id ? { ...p, ...patch } : p)) }),
          () => api.patch(`/people/${id}`, patch)),
      addNote: (id: string, text: string) => {
        const person = w.people.find((p: any) => p.id === id);
        const notes = [{ when: 'just now', text }, ...(person?.notes ?? [])];
        return optimistic((x) => ({ ...x, people: x.people.map((p: any) => (p.id === id ? { ...p, notes } : p)) }),
          () => api.patch(`/people/${id}`, { notes }));
      },
      addPerson: (p: any) =>
        server(() => api.post<any>('/people', p), (r, x) => ({ ...x, people: [r, ...x.people] })),
      issueCard: (p: any, d: any) =>
        server(
          () => api.post<any>('/cards', {
            pid: p.id, reason: d.reason, recv: d.recv === '—' ? undefined : d.recv,
            killed: Boolean(d.killed), note: d.note ?? '', circumstances: d.circumstances,
            lastHeld: d.lastHeld, toldWho: d.toldWho, firNumber: d.firNumber,
            undertakings: Array.isArray(d.undertakings) ? d.undertakings : [],
          }),
          (r, x) => {
            if (r?.pattern) toast(r.pattern, 'amber');
            return { ...x, cardLog: [r.card, ...x.cardLog] };
          },
        ).then((r) => { if (r) void refreshLedger(); return r; }),
      bulkAddPeople: async (recs: any[]) => {
        const r = await server(() => api.post<any>('/imports/people', { rows: recs, commit: true }));
        if (!r) return [];
        if (r.rejected?.length) toast(`${r.accepted.length} added. ${r.rejected.length} held back — see the list.`, 'amber');
        await load();
        return r.accepted;
      },
      openExit: async (p: any) => {
        const r = await server(() => api.post<any>('/exits', { pid: p.id, reason: 'Resigned' }),
          (row, x) => ({ ...x, exits: [row, ...x.exits] }));
        return r?.id ?? null;
      },
      advanceExit: (id: string, payload: any, summary: string) => {
        const cur = ref.current?.exits.find((e: any) => e.id === id);
        return server(
          () => api.post<any>(`/exits/${id}/advance`, { fromStage: cur?.stage ?? 'decision', payload: payload ?? {}, summary }),
          (r, x) => ({ ...x, exits: x.exits.map((e: any) => (e.id === id ? r : e)) }),
        ).then((r) => { if (r) void refreshLedger(); return r; });
      },
      logHR: (text: string) =>
        setWorld((x) => (x ? { ...x, hrLog: [{ at: new Date().toISOString(), who: w.me?.name ?? '', what: text }, ...x.hrLog] } : x)),

      /**
       * A no-op, deliberately.
       *
       * This used to append a ledger entry from the browser. A ledger entry
       * written by a client is worth nothing. Entries are appended by the
       * server inside the transaction of the operation they describe — so by
       * the time a screen calls this, the entry it wanted already exists.
       */
      seal: () => undefined,
    };
    return proc;
  }, [world, firmId, openVendor, scope, coachOn, coachRun, chainOk, optimistic, server, toast, load]);

  if (error) {
    return (
      <div className="mb-centre">
        <div className="mb-centre-card">
          <h1>Could not load</h1>
          <p>{error}</p>
          <button type="button" className="mb-button" onClick={() => void load()}>Try again</button>
        </div>
      </div>
    );
  }
  if (!value) {
    return (
      <div className="mb-centre">
        <div className="mb-centre-card">
          <h1>Marbella</h1>
          <p>Loading…</p>
        </div>
      </div>
    );
  }
  return <ProcCtx.Provider value={value}>{children}</ProcCtx.Provider>;
}
