-- HISTORY GUARDS
--
-- Ideaproxima is meant to be a long-lived collective memory. These triggers make that a property of the database
-- rather than a convention of the application code: recorded facts cannot be rewritten or deleted by any code path.
--
--  * ip_forbid_change: fully append-only tables (no UPDATE, no DELETE).
--  * ip_guard_columns(<col>, ...): rows are never deleted, and only the listed columns may change
--    (supersession markers, withdrawal/moderation flags, revision decisions, initiative status).
--
-- AFTER triggers are used so that stored generated columns are populated in NEW and OLD alike.
-- Legally required erasure (e.g. court orders) is an operator procedure that disables a trigger inside a
-- transaction and records the action — see docs/developer/operations.md. It is intentionally not an API feature.

CREATE OR REPLACE FUNCTION ip_forbid_change() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'ideaproxima: % on "%" is forbidden: this history is append-only', TG_OP, TG_TABLE_NAME
    USING ERRCODE = 'restrict_violation';
END
$$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION ip_guard_columns() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'ideaproxima: DELETE on "%" is forbidden: history is preserved (withdraw, retract or hide instead)', TG_TABLE_NAME
      USING ERRCODE = 'restrict_violation';
  END IF;
  IF (to_jsonb(NEW) - TG_ARGV) IS DISTINCT FROM (to_jsonb(OLD) - TG_ARGV) THEN
    RAISE EXCEPTION 'ideaproxima: on "%" only (%) may change: recorded facts are immutable', TG_TABLE_NAME, array_to_string(TG_ARGV, ', ')
      USING ERRCODE = 'restrict_violation';
  END IF;
  RETURN NULL;
END
$$;
--> statement-breakpoint
CREATE TRIGGER activities_append_only AFTER UPDATE OR DELETE ON activities
  FOR EACH ROW EXECUTE FUNCTION ip_forbid_change();
--> statement-breakpoint
CREATE TRIGGER stage_transitions_append_only AFTER UPDATE OR DELETE ON stage_transitions
  FOR EACH ROW EXECUTE FUNCTION ip_forbid_change();
--> statement-breakpoint
CREATE TRIGGER outcomes_append_only AFTER UPDATE OR DELETE ON outcomes
  FOR EACH ROW EXECUTE FUNCTION ip_forbid_change();
--> statement-breakpoint
CREATE TRIGGER sources_append_only AFTER UPDATE OR DELETE ON sources
  FOR EACH ROW EXECUTE FUNCTION ip_forbid_change();
--> statement-breakpoint
CREATE TRIGGER idea_revisions_guard AFTER UPDATE OR DELETE ON idea_revisions
  FOR EACH ROW EXECUTE FUNCTION ip_guard_columns('status', 'decided_by', 'decided_at', 'decision_note');
--> statement-breakpoint
CREATE TRIGGER evaluations_guard AFTER UPDATE OR DELETE ON evaluations
  FOR EACH ROW EXECUTE FUNCTION ip_guard_columns('superseded_at');
--> statement-breakpoint
CREATE TRIGGER stances_guard AFTER UPDATE OR DELETE ON stances
  FOR EACH ROW EXECUTE FUNCTION ip_guard_columns('retracted_at');
--> statement-breakpoint
CREATE TRIGGER involvements_guard AFTER UPDATE OR DELETE ON involvements
  FOR EACH ROW EXECUTE FUNCTION ip_guard_columns('superseded_at');
--> statement-breakpoint
CREATE TRIGGER claims_guard AFTER UPDATE OR DELETE ON claims
  FOR EACH ROW EXECUTE FUNCTION ip_guard_columns('hidden_at');
--> statement-breakpoint
CREATE TRIGGER idea_claims_guard AFTER UPDATE OR DELETE ON idea_claims
  FOR EACH ROW EXECUTE FUNCTION ip_guard_columns('removed_at', 'removed_by', 'position');
--> statement-breakpoint
CREATE TRIGGER evidence_guard AFTER UPDATE OR DELETE ON evidence
  FOR EACH ROW EXECUTE FUNCTION ip_guard_columns('withdrawn_at', 'withdrawn_reason', 'hidden_at');
--> statement-breakpoint
CREATE TRIGGER arguments_guard AFTER UPDATE OR DELETE ON arguments
  FOR EACH ROW EXECUTE FUNCTION ip_guard_columns('withdrawn_at', 'hidden_at');
--> statement-breakpoint
CREATE TRIGGER comments_guard AFTER UPDATE OR DELETE ON comments
  FOR EACH ROW EXECUTE FUNCTION ip_guard_columns('hidden_at');
--> statement-breakpoint
CREATE TRIGGER idea_relations_guard AFTER UPDATE OR DELETE ON idea_relations
  FOR EACH ROW EXECUTE FUNCTION ip_guard_columns('retracted_at', 'retracted_by');
--> statement-breakpoint
CREATE TRIGGER idea_stewards_guard AFTER UPDATE OR DELETE ON idea_stewards
  FOR EACH ROW EXECUTE FUNCTION ip_guard_columns('revoked_at');
--> statement-breakpoint
CREATE TRIGGER person_expertise_guard AFTER UPDATE OR DELETE ON person_expertise
  FOR EACH ROW EXECUTE FUNCTION ip_guard_columns('revoked_at', 'verified_by');
--> statement-breakpoint
CREATE TRIGGER initiatives_guard AFTER UPDATE OR DELETE ON initiatives
  FOR EACH ROW EXECUTE FUNCTION ip_guard_columns('status', 'started_on', 'ended_on', 'hidden_at');
--> statement-breakpoint
CREATE TRIGGER ideas_no_delete AFTER DELETE ON ideas
  FOR EACH ROW EXECUTE FUNCTION ip_forbid_change();
