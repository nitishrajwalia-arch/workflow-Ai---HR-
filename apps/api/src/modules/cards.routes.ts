/**
 * The card bureau.
 *
 * Re-issuing a card is not a printing job. A card opens doors that are shut to
 * outsiders, so the two paths are deliberately unequal:
 *
 *   Old card handed back  -> pick the fault, confirm it was received and
 *                            destroyed, name the receiver. Seconds.
 *   Unaccounted for       -> the circumstances in the holder's own words (a
 *                            25-character floor: "lost it" will not pass), when
 *                            it was last in hand, who they told, an FIR number
 *                            if it was stolen, and all five undertakings ticked
 *                            individually.
 *
 * THE SERVER ENFORCES THAT, not the browser. In the single-file build those
 * steps were screens, and a modified browser could skip them. Here they are
 * conditions on the request: skip one and the API refuses. That is the whole
 * reason this endpoint is worth having.
 *
 * The version number is also the server's to decide. Two clerks on two screens
 * must not both be handed "version 3" — the unique index on (personId, ver) is
 * the last word, and this transaction is what stops them racing for it.
 */

import {
  CARD_VERSION_CONCERN_THRESHOLD,
  REISSUE_REASONS,
  isFastReissue,
  schemas,
} from '@marbella/shared';
import type { ReissueReason } from '@marbella/shared';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { nowStamp } from '../lib/dates.js';
import { notFound, unprocessable } from '../lib/errors.js';
import { requireUser } from '../plugins/auth.js';
import { appendInTx } from '../services/ledger.js';

const MIN_CIRCUMSTANCES = 25;
const REQUIRED_UNDERTAKINGS = 5;

export const cardsRoutes: FastifyPluginAsyncZod = async (app) => {
  const { db } = app;

  app.get(
    '/cards',
    {
      preHandler: app.authenticate,
      schema: {
        tags: ['cards'],
        summary: 'The card log',
        querystring: schemas.cardsQuery,
        response: { 200: z.any() },
      },
    },
    async (req) => {
      const { pid, page, pageSize } = req.query;
      const where = pid ? { personId: pid } : {};
      const [rows, total] = await Promise.all([
        db.card.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip: (page - 1) * pageSize,
          take: pageSize,
        }),
        db.card.count({ where }),
      ]);
      return {
        items: rows.map((c) => ({
          id: c.id,
          pid: c.personId,
          name: c.name,
          ver: c.ver,
          reason: c.reason,
          at: c.at,
          by: c.by,
          recv: c.recv,
          note: c.note,
          killed: c.killed,
          zonesKilled: c.zonesKilled,
        })),
        page,
        pageSize,
        total,
      };
    },
  );

  app.post(
    '/cards',
    {
      preHandler: app.requireRole('HR'),
      schema: {
        tags: ['cards'],
        summary: 'Issue or re-issue a card',
        description:
          'When the old card did not come back, the long form is mandatory and is checked here, ' +
          'not in the browser. The version number is assigned by the server.',
        body: schemas.issueCardBody,
        response: { 201: z.any(), 404: schemas.errorBody, 422: schemas.errorBody },
      },
    },
    async (req, reply) => {
      const me = requireUser(req);
      const b = req.body;
      const reason = b.reason as ReissueReason;
      const meta = REISSUE_REASONS[reason];

      const person = await db.person.findUnique({ where: { id: b.pid } });
      if (!person) throw notFound(`Employee ${b.pid}`);

      // Refusing to print a card for someone who has left is the entire point of
      // killing a card on exit. Do not weaken this.
      if (person.status === 'exited') {
        throw unprocessable(
          `${person.name} has left the group. A card cannot be issued to someone who is not with Marbella.`,
        );
      }

      const problems: Array<{ path: string; message: string }> = [];

      if (isFastReissue(reason)) {
        // The fast path is only honest if the old card actually came back.
        if (reason !== 'first') {
          if (!b.killed) {
            problems.push({
              path: 'killed',
              message:
                'Confirm the old card was received and destroyed. If it was not handed back, ' +
                'pick Lost, Stolen or Not returned instead — that path exists for a reason.',
            });
          }
          if (!b.recv?.trim()) {
            problems.push({ path: 'recv', message: 'Name the person who took the old card back.' });
          }
        }
      } else {
        const words = (b.circumstances ?? '').trim();
        if (words.length < MIN_CIRCUMSTANCES) {
          problems.push({
            path: 'circumstances',
            message:
              `Write what happened in the holder's own words — at least ${MIN_CIRCUMSTANCES} characters. ` +
              `You wrote ${words.length}. "Lost it" is not a record anyone can act on later.`,
          });
        }
        if (!b.lastHeld?.trim()) {
          problems.push({ path: 'lastHeld', message: 'When was the card last in their hand?' });
        }
        if (!b.toldWho?.trim()) {
          problems.push({ path: 'toldWho', message: 'Who did they report it to, and when?' });
        }
        if (reason === 'stolen' && !b.firNumber?.trim()) {
          problems.push({
            path: 'firNumber',
            message: 'A stolen card means a police report. Enter the FIR number.',
          });
        }
        const ticked = b.undertakings.filter(Boolean).length;
        if (b.undertakings.length !== REQUIRED_UNDERTAKINGS || ticked !== REQUIRED_UNDERTAKINGS) {
          problems.push({
            path: 'undertakings',
            message:
              `All ${REQUIRED_UNDERTAKINGS} undertakings must be accepted individually. ` +
              `${ticked} of ${REQUIRED_UNDERTAKINGS} were.`,
          });
        }
      }

      if (problems.length) {
        throw unprocessable(
          'This re-issue is missing what the record needs. A card opens doors that are shut to outsiders.',
          problems,
        );
      }

      const card = await db.$transaction(async (tx) => {
        // Inside the transaction so a concurrent issue for the same person
        // cannot read the same highest version. If two do race, the unique
        // index on (personId, ver) rejects the loser rather than duplicating.
        const highest = await tx.card.findFirst({
          where: { personId: b.pid },
          orderBy: { ver: 'desc' },
          select: { ver: true },
        });
        const ver = (highest?.ver ?? 0) + 1;
        const at = nowStamp();

        const created = await tx.card.create({
          data: {
            personId: b.pid,
            name: person.name,
            ver,
            reason,
            at,
            by: me.name,
            recv: b.recv?.trim() || '—',
            note: b.note,
            killed: ver > 1 ? `v${ver - 1}` : null,
            // An unaccounted-for card must lose its zone access, not merely be
            // superseded: the old plastic still exists somewhere.
            zonesKilled: !meta.fast && reason !== 'namechg',
            circumstances: b.circumstances ?? null,
            lastHeld: b.lastHeld ?? null,
            toldWho: b.toldWho ?? null,
            firNumber: b.firNumber ?? null,
            issuedById: me.sub,
          },
        });

        await appendInTx(tx, {
          kind: 'card',
          subject: b.pid,
          detail: `Card v${ver} issued — ${person.name} (${meta.label}).`,
          who: me.name,
          at,
        });

        await tx.usageCounter.upsert({
          where: { key: 'card:issue' },
          create: { key: 'card:issue', count: 1 },
          update: { count: { increment: 1 } },
        });

        return created;
      });

      const total = await db.card.count({ where: { personId: b.pid } });

      return reply.status(201).send({
        card: {
          id: card.id,
          pid: card.personId,
          name: card.name,
          ver: card.ver,
          reason: card.reason,
          at: card.at,
          by: card.by,
          recv: card.recv,
          note: card.note,
          killed: card.killed,
          zonesKilled: card.zonesKilled,
        },
        // Not a refusal — a note for the person handing it over. Someone on
        // their third card is a conversation, not a printing problem.
        pattern:
          total >= CARD_VERSION_CONCERN_THRESHOLD
            ? `This is card ${total} for ${person.name}. Worth a conversation rather than another reprint.`
            : null,
      });
    },
  );
};
