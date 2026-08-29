/**
 * Errors the API is allowed to show a user.
 *
 * Anything not thrown as an AppError is treated as a bug: it is logged in full
 * with its stack and request id, and the caller is told only that something went
 * wrong. Internal detail never reaches a response body, because a stack trace in
 * a 500 is how an attacker learns what you are running.
 */

export class AppError extends Error {
  readonly statusCode: number;
  readonly code: string;
  readonly details?: Array<{ path: string; message: string }>;

  constructor(
    statusCode: number,
    code: string,
    message: string,
    details?: Array<{ path: string; message: string }>,
  ) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code;
    if (details) this.details = details;
  }
}

export const badRequest = (message: string, details?: AppError['details']) =>
  new AppError(400, 'BAD_REQUEST', message, details);

export const unauthorized = (message = 'Sign in to continue.') =>
  new AppError(401, 'UNAUTHORIZED', message);

export const forbidden = (message = 'Your account cannot do that.') =>
  new AppError(403, 'FORBIDDEN', message);

export const notFound = (what: string) => new AppError(404, 'NOT_FOUND', `${what} was not found.`);

export const conflict = (message: string) => new AppError(409, 'CONFLICT', message);

/** The request was well-formed but the business rules refuse it. */
export const unprocessable = (message: string, details?: AppError['details']) =>
  new AppError(422, 'UNPROCESSABLE', message, details);

export const tooMany = (message = 'Too many attempts. Wait a moment and try again.') =>
  new AppError(429, 'TOO_MANY_REQUESTS', message);
