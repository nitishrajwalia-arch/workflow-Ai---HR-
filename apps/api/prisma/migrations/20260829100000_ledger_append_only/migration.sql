-- Make the ledger append-only in the DATABASE, not merely in application code.
--
-- The original browser-only build was honest that its ledger was tamper-EVIDENT
-- and not tamper-PROOF, and named the three things real immutability needs. This
-- migration supplies the second of them: append-only permissions at the database
-- level. A bug in a route handler, a stray `prisma.ledgerEntry.update`, or someone
-- with a psql prompt and the application role all hit the same wall.
--
-- What is still true, and belongs in the client conversation: a superuser, or
-- anyone who can restore a backup or drop this trigger, can still rewrite history.
-- What they cannot do is rewrite it QUIETLY — dropping the trigger is itself a
-- schema change, and the hash chain still has to be recomputed end to end.

CREATE OR REPLACE FUNCTION ledger_entry_is_append_only()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION
    'ledger_entry is append-only: % on row % was refused by the database',
    TG_OP, COALESCE(OLD.id, '(unknown)')
    USING HINT  = 'Correct a wrong entry by appending a correcting entry. History is not edited.',
          ERRCODE = 'check_violation';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS ledger_entry_no_update ON "ledger_entry";
CREATE TRIGGER ledger_entry_no_update
  BEFORE UPDATE ON "ledger_entry"
  FOR EACH ROW EXECUTE FUNCTION ledger_entry_is_append_only();

DROP TRIGGER IF EXISTS ledger_entry_no_delete ON "ledger_entry";
CREATE TRIGGER ledger_entry_no_delete
  BEFORE DELETE ON "ledger_entry"
  FOR EACH ROW EXECUTE FUNCTION ledger_entry_is_append_only();

-- TRUNCATE bypasses row triggers entirely, so it needs its own statement trigger.
CREATE OR REPLACE FUNCTION ledger_entry_no_truncate()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'ledger_entry is append-only: TRUNCATE was refused by the database'
    USING ERRCODE = 'check_violation';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS ledger_entry_no_truncate ON "ledger_entry";
CREATE TRIGGER ledger_entry_no_truncate
  BEFORE TRUNCATE ON "ledger_entry"
  EXECUTE FUNCTION ledger_entry_no_truncate();

-- Two entries must not claim the same predecessor: that is a forked chain, and a
-- fork is how you would splice a rewritten tail in beside the real one.
CREATE UNIQUE INDEX IF NOT EXISTS "ledger_entry_prev_key" ON "ledger_entry"("prev");
