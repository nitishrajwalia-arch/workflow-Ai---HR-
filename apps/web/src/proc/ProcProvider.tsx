/**
 * The seam between a live server and a UI that was written against React state.
 *
 * HOW IT WORKS
 * ------------
 * On mount it fetches /api/v1/bootstrap once and puts the result in state, in
 * exactly the shape the existing screens already read. Every action then does
 * two things:
 *
 *   1. Applies the change locally straight away, so the screen responds at once.
 *   2. Sends it to the server, and on failure PUTS THE OLD STATE BACK and says
 *      what went wrong.
 *
 * That second half is the part people skip. An optimistic update that does not
 * roll back is worse than no optimism at all: the screen shows a card issued
 * that was never issued, and the operator finds out weeks later.
 *
 * WHAT THE SERVER OWNS AND THIS FILE DOES NOT GUESS
 * -------------------------------------------------
 * Anything the server decides is re-read from the server's answer, never
 * invented here: card version numbers, employee IDs, ledger seals, exit stage
 * transitions. Where an action creates something with a server-assigned
 * identity, the action is `async` and the caller awaits the real row.
 *
 * WHY NOT TanStack Query
 * ----------------------
 * It is a good library and it is the right answer for a UI built around
 * per-screen queries. This UI is built around one context object that every
 * screen destructures. Wrapping that in a query cache would add a dependency
 * and a second source of truth without removing a single line of the code it
 * is meant to serve. See docs/FRONTEND-INTEGRATION.md for when that changes.
 */

import type { BootstrapPayload } from '@marbella/shared';
import { verifyChainNewestFirst } from '@marbella/shared';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { ApiError, api } from '../lib/api.js';
import { ProcCtx, type ProcValue } from './context.js';

type Toast = (message: string, tone?: string) => void;

interface Props {
  children: ReactNode;
  /** Shown when something fails. Wired to the legacy file's own toaster. */
  toast: Toast;
}

type State = BootstrapPayload;

export function ProcProvider({ children, toast }: Props) {
  const [state, setState] = useState<State | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [scope, setScope] = useState<string>('group');
  const [chainOk, setChainOk] = useState<boolean | null>(null);

  /**
   * The current state, readable synchronously inside an action without adding
   * it to that action's dependency list. Actions that read it would otherwise be
   * rebuilt on every keystroke anywhere in the app.
   */
  const stateRef = useRef<State | null>(null);
  stateRef.current = state;

  const load = useCallback(async () => {
    setError(null);
    try {
      const payload = await api.get<BootstrapPayload>('/bootstrap');
      setState(payload);

      // Re-verify the chain in the browser rather than trusting the server's
      // word for it. A server that has been tampered with would happily report
      // its own ledger as healthy; recomputing the seals here catches that.
      const result = await verifyChainNewestFirst(payload.ledger);
      setChainOk(result.ok);
      if (!result.ok) {
        toast('The ledger does not verify. Do not rely on it until it is investigated.', 'red');
      }
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : 'Could not load. Check the connection.';
      setError(message);
    }
  }, [toast]);

  useEffect(() => {
    void load();
  }, [load]);

  /**
   * Run an action optimistically.
   *
   * `apply` changes local state now; `send` talks to the server. If `send`
   * throws, the state from before `apply` is restored and the server's own
   * message is shown.
   */
  const optimistic = useCallback(
    async <T,>(apply: (s: State) => State, send: () => Promise<T>): Promise<T | null> => {
      const before = stateRef.current;
      if (!before) return null;

      setState(apply(before));
      try {
        return await send();
      } catch (err) {
        setState(before);
        const message = err instanceof ApiError ? err.full : 'That did not save. Nothing changed.';
        toast(message, 'red');
        return null;
      }
    },
    [toast],
  );

  /** For actions where there is nothing sensible to show until the server answers. */
  const pessimistic = useCallback(
    async <T,>(
      send: () => Promise<T>,
      onDone: (result: T, s: State) => State,
    ): Promise<T | null> => {
      try {
        const result = await send();
        setState((s) => (s ? onDone(result, s) : s));
        return result;
      } catch (err) {
        const message = err instanceof ApiError ? err.full : 'That did not save. Nothing changed.';
        toast(message, 'red');
        return null;
      }
    },
    [toast],
  );

  const value = useMemo<ProcValue | null>(() => {
    if (!state) return null;

    /* ---------------------------------------------------------- actions */

    /** Usage counting is fire-and-forget: it must never block or fail a screen. */
    const track = (key: string) => {
      setState((s) => (s ? { ...s, usage: { ...s.usage, [key]: (s.usage[key] ?? 0) + 1 } } : s));
      void api.post('/usage/track', { key, count: 1 }).catch(() => {
        // A lost counter is not worth telling anyone about.
      });
    };

    const updatePerson = (id: string, patch: Record<string, unknown>) =>
      optimistic(
        (s) => ({
          ...s,
          people: s.people.map((p) => (p.id === id ? { ...p, ...patch } : p)),
        }),
        () => api.patch(`/people/${id}`, patch),
      );

    const setEmployer = (pid: string, companyId: string, reason?: string) =>
      optimistic(
        (s) => ({
          ...s,
          people: s.people.map((p) => (p.id === pid ? { ...p, employer: companyId } : p)),
        }),
        () =>
          api.post(`/people/${pid}/employer`, {
            employer: companyId,
            // The API insists on a reason: this decides which letterhead their
            // papers go out on. If the screen did not collect one, say so
            // honestly rather than inventing a justification.
            reason: reason?.trim() || 'Changed from the people screen. No reason was recorded.',
          }),
      );

    /**
     * Issue a card.
     *
     * The version number comes back from the server, never from here: two
     * clerks on two screens must not both be shown "version 3".
     */
    const issueCard = (person: { id: string }, d: Record<string, unknown>) =>
      pessimistic(
        () =>
          api.post<{ card: Record<string, unknown>; pattern: string | null }>('/cards', {
            pid: person.id,
            reason: d.reason,
            recv: d.recv === '—' ? undefined : d.recv,
            killed: Boolean(d.killed),
            note: d.note ?? '',
            circumstances: d.circumstances,
            lastHeld: d.lastHeld,
            toldWho: d.toldWho,
            firNumber: d.firNumber,
            undertakings: Array.isArray(d.undertakings) ? d.undertakings : [],
          }),
        (result, s) => {
          if (result.pattern) toast(result.pattern, 'amber');
          return { ...s, cardLog: [result.card as never, ...s.cardLog] };
        },
      ).then((r) => {
        // The ledger gained an entry; pull the fresh head rather than guessing
        // at a seal the browser is not allowed to compute.
        if (r) void refreshLedger();
        return r;
      });

    const refreshLedger = async () => {
      try {
        const { items } = await api.get<{ items: BootstrapPayload['ledger'] }>(
          '/ledger?pageSize=200',
        );
        setState((s) => (s ? { ...s, ledger: items } : s));
        setChainOk((await verifyChainNewestFirst(items)).ok);
      } catch {
        // Leave the ledger as it was; the next full load will correct it.
      }
    };

    const openExit = async (person: { id: string }) => {
      const created = await pessimistic(
        () => api.post<{ id: string }>('/exits', { pid: person.id, reason: 'Resigned' }),
        (exit, s) => ({ ...s, exits: [exit as never, ...s.exits] }),
      );
      return created?.id ?? null;
    };

    const advanceExit = async (id: string, payload: unknown, summary: string) => {
      const current = stateRef.current?.exits.find((e) => e.id === id);
      return pessimistic(
        () =>
          api.post(`/exits/${id}/advance`, {
            // The server refuses if this does not match what it holds, which is
            // how two people on two screens are stopped from skipping a stage.
            fromStage: current?.stage ?? 'decision',
            payload: (payload as Record<string, unknown>) ?? {},
            summary,
          }),
        (updated, s) => ({
          ...s,
          exits: s.exits.map((e) => (e.id === id ? (updated as never) : e)),
          people: s.people.map((p) =>
            p.id === current?.pid && (updated as { stage: string }).stage === 'dues'
              ? { ...p, status: 'exited' }
              : p,
          ),
        }),
      ).then((r) => {
        if (r) void refreshLedger();
        return r;
      });
    };

    /**
     * Bulk intake.
     *
     * Returns the rows that actually landed, so the summary screen counts what
     * happened rather than what was attempted.
     */
    const bulkAddPeople = async (records: Array<Record<string, unknown>>) => {
      const result = await pessimistic(
        () =>
          api.post<{
            accepted: Array<{ row: number; id: string; name: string }>;
            rejected: Array<{ row: number; name: string; reason: string; field: string }>;
          }>('/imports/people', { rows: records, commit: true }),
        (_r, s) => s,
      );
      if (!result) return [];
      if (result.rejected.length) {
        toast(
          `${result.accepted.length} added. ${result.rejected.length} held back — see the list.`,
          'amber',
        );
      }
      // Re-read rather than reconstruct: the server assigned the IDs, decided
      // the employer from the posting, and normalised the dates.
      await load();
      return result.accepted;
    };

    const saveCompany = (c: Record<string, unknown>) =>
      optimistic(
        (s) => ({
          ...s,
          companies: s.companies.some((x) => x.id === c.id)
            ? s.companies.map((x) => (x.id === c.id ? { ...x, ...c } : x))
            : [...s.companies, c as never],
        }),
        () => api.put(`/companies/${String(c.id)}`, stripId(c)),
      );

    const saveProject = (p: Record<string, unknown>) =>
      optimistic(
        (s) => ({
          ...s,
          projects: s.projects.some((x) => x.id === p.id)
            ? s.projects.map((x) => (x.id === p.id ? { ...x, ...p } : x))
            : [...s.projects, p as never],
        }),
        () => api.put(`/projects/${String(p.id)}`, stripId(p)),
      );

    const setSalary = (pid: string, salary: Record<string, unknown>) =>
      optimistic(
        (s) => ({
          ...s,
          salaries: { ...s.salaries, [pid]: { ...s.salaries[pid], ...salary } as never },
        }),
        () => api.put(`/salaries/${pid}`, { ...state.salaries[pid], ...salary }),
      );

    const setContact = (pid: string, contact: Record<string, unknown>) =>
      optimistic(
        (s) => ({
          ...s,
          contacts: { ...s.contacts, [pid]: { ...s.contacts[pid], ...contact } as never },
        }),
        () =>
          api.put(`/contacts/${pid}`, {
            phone: '',
            email: '',
            vPhone: false,
            vEmail: false,
            ...state.contacts[pid],
            ...contact,
          }),
      );

    const addDevice = (d: Record<string, unknown>) =>
      pessimistic(
        () => api.post<Record<string, unknown>>('/devices', d),
        (device, s) => ({ ...s, devices: [device as never, ...s.devices] }),
      );

    const dropDevice = (id: string) =>
      optimistic(
        (s) => ({ ...s, devices: s.devices.filter((d) => d.id !== id) }),
        () => api.del(`/devices/${id}`),
      );

    const setDeptRule = (dept: string, rule: Record<string, unknown>) =>
      optimistic(
        (s) => ({
          ...s,
          deptRules: { ...s.deptRules, [dept]: { ...s.deptRules[dept], ...rule } as never },
        }),
        () =>
          api.put(`/dept-rules/${encodeURIComponent(dept)}`, { ...state.deptRules[dept], ...rule }),
      );

    const setLeave = (dept: string, policy: Record<string, unknown>) =>
      optimistic(
        (s) => ({
          ...s,
          leavePolicy: { ...s.leavePolicy, [dept]: { ...s.leavePolicy[dept], ...policy } as never },
        }),
        () =>
          api.put(`/leave-policy/${encodeURIComponent(dept)}`, {
            ...state.leavePolicy[dept],
            ...policy,
          }),
      );

    const saveJD = (role: string, jd: string) =>
      optimistic(
        (s) => ({ ...s, jds: { ...s.jds, [role]: jd } }),
        () => api.put('/job-descriptions', { role, jd }),
      );

    const logDoc = (d: Record<string, unknown>) =>
      pessimistic(
        () =>
          api.post<Record<string, unknown> & { warning: string | null; deliveryNote: string }>(
            '/documents',
            {
              tpl: d.tpl,
              pid: d.pid,
              company: d.company,
              via: d.via ?? 'print',
              subject: d.subject ?? '',
              body: d.body ?? '',
            },
          ),
        (doc, s) => {
          // The API says out loud when the letterhead is not the person's
          // employer, and when an "emailed" letter was recorded but not sent.
          if (doc.warning) toast(doc.warning, 'amber');
          else if (String(doc.via) === 'email') toast(doc.deliveryNote, 'amber');
          return { ...s, docLog: [doc as never, ...s.docLog] };
        },
      );

    /**
     * `seal` is a no-op that returns.
     *
     * In the browser-only build this appended a ledger entry directly. It cannot
     * do that any more and it MUST NOT: a client-written ledger entry is worth
     * nothing. Entries are appended by the server, inside the transaction of the
     * operation they describe. This stub exists only so the legacy screens that
     * call it keep working; the entry they wanted has already been written.
     */
    const seal = () => undefined;

    const proc: ProcValue = {
      // ---- the collections, exactly the keys the screens already read
      people: state.people,
      cardLog: state.cardLog,
      ledger: state.ledger,
      salaries: state.salaries,
      devices: state.devices,
      contacts: state.contacts,
      leavePolicy: state.leavePolicy,
      deptRules: state.deptRules,
      companies: state.companies,
      projects: state.projects,
      exits: state.exits,
      usage: state.usage,
      docLog: state.docLog,
      jds: state.jds,
      offices: state.offices,
      hrLog: state.hrLog,
      scope,
      setScope,

      // ---- new, and worth using
      me: state.me,
      ledgerHealth: state.ledgerHealth,
      /** null while it is still being checked in the browser. */
      chainVerified: chainOk,
      reload: load,

      // ---- the actions
      track,
      logDoc,
      saveJD,
      seal,
      setSalary,
      addDevice,
      dropDevice,
      setContact,
      setLeave,
      setDeptRule,
      saveCompany,
      saveProject,
      setEmployer,
      updatePerson,
      issueCard,
      bulkAddPeople,
      openExit,
      advanceExit,
    };
    return proc;
  }, [state, scope, chainOk, optimistic, pessimistic, toast, load]);

  if (error) {
    return (
      <CentredNotice
        title="Could not load"
        body={error}
        action={{ label: 'Try again', onClick: () => void load() }}
      />
    );
  }

  if (!value) return <CentredNotice title="Marbella HR" body="Loading the roster…" />;

  return <ProcCtx.Provider value={value}>{children}</ProcCtx.Provider>;
}

/** The API takes the id in the path, so it must not also be in the body. */
function stripId(o: Record<string, unknown>): Record<string, unknown> {
  const { id: _id, ...rest } = o;
  return rest;
}

function CentredNotice({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action?: { label: string; onClick: () => void };
}) {
  return (
    <div className="mb-centre">
      <div className="mb-centre-card">
        <h1>{title}</h1>
        <p>{body}</p>
        {action && (
          <button type="button" onClick={action.onClick} className="mb-button">
            {action.label}
          </button>
        )}
      </div>
    </div>
  );
}
