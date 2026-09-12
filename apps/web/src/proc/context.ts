/**
 * The context object the whole UI reads from.
 *
 * This is deliberately its own tiny module rather than living inside
 * ProcProvider, because the legacy UI file imports it too. Both halves must
 * get the SAME context object — two `createContext()` calls produce two
 * unrelated contexts, and the symptom is a `useProc()` that quietly returns
 * null and a screen that renders blank with no error.
 *
 * If you ever see "Cannot destructure property 'people' of null", this is the
 * first place to look.
 */

import { createContext, useContext } from 'react';

/** Typed loosely on purpose: the legacy file is plain JS and reads it freely. */
export type ProcValue = Record<string, unknown>;

export const ProcCtx = createContext<ProcValue | null>(null);

export function useProc(): ProcValue {
  const value = useContext(ProcCtx);
  if (!value) {
    throw new Error(
      'useProc() was called outside <ProcProvider>. Every screen must be rendered inside it.',
    );
  }
  return value;
}
