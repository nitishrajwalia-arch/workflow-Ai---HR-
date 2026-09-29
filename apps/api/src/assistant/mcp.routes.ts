/*
 * © 2026 Marbella Group. All rights reserved.
 *
 * Proprietary and confidential. Not to be used, copied, modified or
 * distributed without the written permission of the management. See LICENSE.
 */
/**
 * The connector ChatGPT and Claude both speak.
 *
 * There is one of these, not two. ChatGPT and Claude have converged on the same
 * protocol — MCP — so a single endpoint serves both, and anything else that
 * learns to speak it later.
 *
 * HOW SOMEBODY'S ASSISTANT GETS IN
 *
 * It signs in as they do: the same Employee ID and password they type into the
 * app, exchanged for the same token, carried as `Authorization: Bearer`. The
 * assistant therefore holds their role and nothing more — a storeman's Claude
 * sees what the storeman sees. It never has an account of its own, because an
 * account of its own is a way round every gate the rest of this API applies.
 *
 * WHAT IT IS ALLOWED TO DO lives in ./permissions.ts, by itself, readable by
 * somebody who is not a programmer. Today: reading only, and nothing that
 * touches pay or identity documents.
 */

import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import type { Role } from '@marbella/shared';
import { requireUser } from '../plugins/auth.js';
import { append } from '../services/ledger.js';
import { ask as readQuestion } from '@marbella/shared';
import { ASSISTANT_TOOLS, NOT_EXPOSED, mayUse, toolFor, toolsFor } from './permissions.js';
import { TOOL_RUNNERS, register as people_for, type ToolContext } from './tools.js';

/** The JSON-RPC envelope MCP speaks over HTTP. */
const rpc = z.object({
  jsonrpc: z.literal('2.0'),
  id: z.union([z.string(), z.number()]).nullish(),
  method: z.string(),
  params: z.record(z.string(), z.unknown()).optional(),
});

const PROTOCOL = '2024-11-05';

/** What each tool takes. Kept beside the runner it belongs to. */
const SCHEMAS: Record<string, { type: 'object'; properties: Record<string, unknown>; required?: string[] }> = {
  ask: {
    type: 'object',
    properties: {
      question: {
        type: 'string',
        description:
          'The question in plain English, e.g. "everyone over 60 years of age", ' +
          '"how many people in Maintenance", "who reports to Ajay Goel".',
      },
    },
    required: ['question'],
  },
  find_people: {
    type: 'object',
    properties: {
      query: { type: 'string', description: 'A name, an employee ID, or part of a designation.' },
      department: { type: 'string', description: 'Narrow to one department.' },
      min_age: { type: 'number', description: 'Only people this age or older, in completed years.' },
      max_age: { type: 'number', description: 'Only people this age or younger.' },
      limit: { type: 'number', description: 'At most this many (1–100, default 25). Ignored when an age is given.' },
    },
  },
  get_person: {
    type: 'object',
    properties: { employee_id: { type: 'string', description: 'e.g. MB-PRJ-0014' } },
    required: ['employee_id'],
  },
  headcount: {
    type: 'object',
    properties: {
      by: {
        type: 'string',
        enum: ['department', 'company', 'site', 'type'],
        description: 'How to break the count down. Defaults to department.',
      },
    },
  },
  who_reports_to: {
    type: 'object',
    properties: { employee_id: { type: 'string' } },
    required: ['employee_id'],
  },
  list_projects: { type: 'object', properties: {} },
  upcoming_dates: {
    type: 'object',
    properties: { months: { type: 'number', description: 'How far ahead, 1–12. Defaults to 3.' } },
  },
  holidays: { type: 'object', properties: {} },
  attendance_summary: {
    type: 'object',
    properties: { employee_id: { type: 'string' } },
    required: ['employee_id'],
  },
  open_hr_tasks: { type: 'object', properties: {} },
};

export const assistantRoutes: FastifyPluginAsyncZod = async (app) => {
  const { db } = app;

  /**
   * What an assistant may do here, in plain words.
   *
   * Open to anybody signed in, because the honest answer to "what can ChatGPT
   * see about me" should not itself need a privilege.
   */
  app.get(
    '/assistant/permissions',
    {
      preHandler: app.authenticate,
      schema: {
        tags: ['assistant'],
        summary: 'What an assistant connected to this account may do',
        response: { 200: z.any() },
      },
    },
    async (req) => {
      const me = requireUser(req);
      const mine = toolsFor(me.role as Role);
      return {
        connectsAs: { name: me.name, role: me.role },
        readOnly: ASSISTANT_TOOLS.every((t) => !t.writes),
        allowed: mine.map((t) => ({ name: t.name, summary: t.summary })),
        withheldFromYourRole: ASSISTANT_TOOLS.filter((t) => !mayUse(t, me.role as Role)).map(
          (t) => ({ name: t.name, needs: t.minRole }),
        ),
        neverAvailableToAnyAssistant: NOT_EXPOSED,
        note:
          'An assistant acts as you and holds your role. It cannot see or do anything ' +
          'you could not see or do by opening the app yourself.',
      };
    },
  );

  /**
   * The MCP endpoint itself.
   *
   * One POST, JSON-RPC inside. `initialize` and `tools/list` describe what is
   * on offer; `tools/call` runs one.
   */
  app.post(
    '/assistant/mcp',
    {
      preHandler: app.authenticate,
      schema: {
        tags: ['assistant'],
        summary: 'Model Context Protocol endpoint for ChatGPT and Claude',
        description:
          'Speaks MCP over JSON-RPC. Authenticate with the same bearer token the app uses; ' +
          'the assistant then acts as that person, with that person’s role.',
        body: rpc,
        response: { 200: z.any() },
      },
    },
    async (req) => {
      const me = requireUser(req);
      const role = me.role as Role;
      const { id, method, params } = req.body;
      const ok = (result: unknown): unknown => ({ jsonrpc: '2.0', id: id ?? null, result });
      const err = (code: number, message: string): unknown => ({
        jsonrpc: '2.0',
        id: id ?? null,
        error: { code, message },
      });

      if (method === 'initialize') {
        return ok({
          protocolVersion: PROTOCOL,
          capabilities: { tools: {} },
          serverInfo: { name: 'marbella', version: '1.0.0' },
          instructions:
            `You are connected to Marbella Group's people system as ${me.name}. ` +
            'Ask whole questions with the `ask` tool — "everyone over 60 years of age" ' +
            'is a question it answers directly. ' +
            'You can read the staff register, headcount, the org chart, projects, ' +
            'the holiday calendar and attendance. You cannot change anything, and ' +
            'salaries, Aadhaar numbers, PANs and home addresses are not available ' +
            'through this connection at all — say so plainly if you are asked for them.',
        });
      }

      if (method === 'notifications/initialized') return ok({});

      if (method === 'tools/list') {
        return ok({
          tools: toolsFor(role).map((t) => ({
            name: t.name,
            description: t.summary,
            inputSchema: SCHEMAS[t.name] ?? { type: 'object', properties: {} },
          })),
        });
      }

      if (method === 'tools/call') {
        const name = String((params as { name?: unknown } | undefined)?.name ?? '');
        const args = ((params as { arguments?: unknown } | undefined)?.arguments ?? {}) as Record<
          string,
          unknown
        >;
        const tool = toolFor(name);
        if (!tool) return err(-32601, `There is no tool called ${name}.`);
        if (!mayUse(tool, role)) {
          // The same refusal the screens give, for the same reason.
          return ok({
            content: [
              {
                type: 'text',
                text:
                  `That needs ${tool.minRole} access and you have ${me.role}. ` +
                  'An assistant cannot see more than the person using it.',
              },
            ],
            isError: true,
          });
        }
        const runner = TOOL_RUNNERS[name];
        if (!runner) return err(-32601, `${name} is listed but not implemented.`);
        const ctx: ToolContext = { db, me: { name: me.name, role: me.role, personId: me.personId } };
        try {
          const text = await runner(ctx, args);
          return ok({ content: [{ type: 'text', text }] });
        } catch (e) {
          app.log.error({ err: e, tool: name }, 'assistant tool failed');
          return ok({
            content: [{ type: 'text', text: 'That could not be read just now.' }],
            isError: true,
          });
        }
      }

      return err(-32601, `${method} is not supported.`);
    },
  );

  /**
   * THE CO-PILOT IN THE APP.
   *
   * The same question, from the person themselves rather than through their
   * assistant. One endpoint, so a sentence typed into the chat window in the
   * corner of the app and the same sentence typed into ChatGPT are read by the
   * same code and answered the same way.
   *
   * It answers as the caller and holds the caller's role, exactly as the
   * connector does. It cannot reach pay or identity documents, and it says so
   * plainly when asked rather than failing.
   */
  app.post(
    '/assistant/ask',
    {
      preHandler: app.authenticate,
      schema: {
        tags: ['assistant'],
        summary: 'Ask a plain-language question about the staff register',
        body: z.object({
          question: z.string().trim().min(1).max(400),
        }),
        response: {
          200: z.object({
            answer: z.string(),
            understood: z.boolean(),
            matched: z.string(),
          }),
        },
      },
    },
    async (req) => {
      const me = requireUser(req);
      const tool = toolFor('ask');
      if (!tool || !mayUse(tool, me.role as Role)) {
        return {
          answer: 'Your account cannot read the staff register.',
          understood: true,
          matched: 'refused',
        };
      }
      const people = await people_for(db);
      return readQuestion(req.body.question, { people });
    },
  );

  /**
   * Turning it on for yourself.
   *
   * Connecting an assistant to the company's people system is a thing somebody
   * did, on a date, and it belongs in the ledger next to everything else that
   * is a thing somebody did. Individual reads are not sealed — that would bury
   * the ledger in noise — but the act of pointing an assistant at the company
   * is recorded once, with who.
   */
  app.post(
    '/assistant/connect',
    {
      preHandler: app.authenticate,
      schema: {
        tags: ['assistant'],
        summary: 'Record that an assistant was connected to this account',
        body: z.object({
          client: z.string().trim().min(2).max(60).describe('e.g. "Claude" or "ChatGPT"'),
        }),
        response: { 200: z.any() },
      },
    },
    async (req) => {
      const me = requireUser(req);
      await append(db, {
        kind: 'auth',
        subject: me.personId ?? me.sub,
        detail: `${req.body.client} was connected to the people system as ${me.name} (${me.role}), read-only.`,
        who: me.name,
      });
      return {
        ok: true as const,
        tools: toolsFor(me.role as Role).map((t) => t.name),
      };
    },
  );
};
