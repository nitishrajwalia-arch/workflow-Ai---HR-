/**
 * One error shape for the whole API.
 *
 * Every failure — validation, business rule, missing row, bug — comes back as:
 *
 *   { "error": { "code", "message", "details"?, "requestId" } }
 *
 * so the browser has exactly one thing to parse. `message` is written for a
 * person to read; `code` is what client code should branch on.
 *
 * A bug (anything that is not an AppError) is logged in full and answered with a
 * generic message plus the request id. The id is the bridge: the user can quote
 * it, and it finds the stack trace in the logs. The stack itself never leaves
 * the server.
 */

import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import fp from 'fastify-plugin';
import { ZodError } from 'zod';
import { AppError } from '../lib/errors.js';

/** Prisma error codes we can turn into something a person can act on. */
function fromPrisma(err: { code?: string; meta?: Record<string, unknown> }): AppError | null {
  const target = Array.isArray(err.meta?.target)
    ? (err.meta.target as string[]).join(', ')
    : String(err.meta?.target ?? 'a unique field');

  switch (err.code) {
    case 'P2002':
      return new AppError(409, 'CONFLICT', `That ${target} is already in use.`);
    case 'P2003':
      return new AppError(
        409,
        'CONFLICT',
        'Something this record points at does not exist, or something still points at this record.',
      );
    case 'P2025':
      return new AppError(404, 'NOT_FOUND', 'That record no longer exists.');
    default:
      return null;
  }
}

/**
 * The database itself refuses to change the ledger. Turn that raw exception into
 * an answer that explains the rule instead of reading like a crash.
 */
export function fromLedgerTrigger(message: string): AppError | null {
  if (!message.includes('ledger_entry is append-only')) return null;
  return new AppError(
    409,
    'LEDGER_APPEND_ONLY',
    'The ledger cannot be edited or deleted — the database refuses it. ' +
      'Correct a wrong entry by appending a correcting one.',
  );
}

export const errorsPlugin = fp(async function errorsPlugin(app: FastifyInstance) {
  app.setNotFoundHandler((req: FastifyRequest, reply: FastifyReply) => {
    void reply.status(404).send({
      error: {
        code: 'NOT_FOUND',
        message: `No route for ${req.method} ${req.url}.`,
        requestId: req.id,
      },
    });
  });

  app.setErrorHandler((error, req, reply) => {
    const requestId = req.id;

    if (error instanceof AppError) {
      req.log.info({ code: error.code, statusCode: error.statusCode }, 'handled error');
      return reply.status(error.statusCode).send({
        error: {
          code: error.code,
          message: error.message,
          ...(error.details ? { details: error.details } : {}),
          requestId,
        },
      });
    }

    // Body/query failed its schema. Report every bad field at once, not the first.
    if (error instanceof ZodError) {
      return reply.status(400).send({
        error: {
          code: 'VALIDATION_FAILED',
          message: 'Some of what you sent could not be accepted.',
          details: error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
          requestId,
        },
      });
    }

    const raw = error as unknown as {
      code?: string;
      meta?: Record<string, unknown>;
      message: string;
    };

    const ledger = fromLedgerTrigger(raw.message ?? '');
    if (ledger) {
      req.log.warn({ requestId }, 'ledger mutation refused by the database');
      return reply.status(ledger.statusCode).send({
        error: { code: ledger.code, message: ledger.message, requestId },
      });
    }

    const prisma = fromPrisma(raw);
    if (prisma) {
      req.log.info({ code: prisma.code, prismaCode: raw.code }, 'database constraint');
      return reply.status(prisma.statusCode).send({
        error: { code: prisma.code, message: prisma.message, requestId },
      });
    }

    // Fastify's own errors (bad JSON, payload too large) carry a usable status.
    const status = (error as { statusCode?: number }).statusCode;
    if (typeof status === 'number' && status >= 400 && status < 500) {
      return reply.status(status).send({
        error: {
          code: (error as { code?: string }).code ?? 'BAD_REQUEST',
          message: raw.message,
          requestId,
        },
      });
    }

    // Anything left is a bug. Full detail to the log, nothing to the caller.
    req.log.error({ err: error, requestId }, 'unhandled error');
    return reply.status(500).send({
      error: {
        code: 'INTERNAL',
        message: `Something went wrong at our end. Quote ${requestId} and it can be traced.`,
        requestId,
      },
    });
  });
});
