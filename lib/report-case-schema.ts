// Additive, serialized migration. Existing reports and queue entries are retained.
export const REPORT_CASE_SCHEMA = `
SELECT pg_advisory_xact_lock(73419021);
ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_status text NOT NULL DEFAULT 'VISIBLE';
CREATE TABLE IF NOT EXISTS report_cases (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  number bigint GENERATED ALWAYS AS IDENTITY UNIQUE,
  target_type text NOT NULL CHECK(target_type IN ('SKILLSHOT','COMMENT','PROFILE')),
  target_id text NOT NULL,
  status text NOT NULL DEFAULT 'PENDING' CHECK(status IN ('PENDING','IN_REVIEW','RESOLVED','DISMISSED','ESCALATED')),
  assigned_to text REFERENCES users(id), reviewer_id text REFERENCES users(id), reviewed_at timestamptz,
  decision text, decision_reason text, resolved_by text REFERENCES users(id), resolved_at timestamptz,
  version integer NOT NULL DEFAULT 0, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(target_type,target_id)
);
CREATE TABLE IF NOT EXISTS report_case_events (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text, case_id text NOT NULL REFERENCES report_cases(id),
  actor_id text REFERENCES users(id), action text NOT NULL, reason text NOT NULL DEFAULT '',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb, created_at timestamptz NOT NULL DEFAULT now(), source_key text UNIQUE
);
ALTER TABLE reports ADD COLUMN IF NOT EXISTS case_id text REFERENCES report_cases(id);
ALTER TABLE moderation_queue ADD COLUMN IF NOT EXISTS case_id text REFERENCES report_cases(id);
CREATE INDEX IF NOT EXISTS idx_report_case_queue ON report_cases(status,updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_report_case_assigned ON report_cases(assigned_to,status);
CREATE INDEX IF NOT EXISTS idx_report_case_events ON report_case_events(case_id,created_at,id);
CREATE INDEX IF NOT EXISTS idx_reports_case ON reports(case_id,created_at);
CREATE INDEX IF NOT EXISTS idx_queue_case ON moderation_queue(case_id,created_at);

-- Resolve legacy profile handles to stable IDs without rewriting the old report.
INSERT INTO report_cases(target_type,target_id,status,created_at,updated_at)
SELECT target_type,target_id,
  CASE WHEN bool_or(status='PENDING') THEN 'PENDING' WHEN bool_or(status='RESOLVED') THEN 'RESOLVED' ELSE 'DISMISSED' END,
  min(created_at),max(created_at)
FROM (
 SELECT r.target_type,CASE WHEN r.target_type='PROFILE' THEN coalesce(u.id,r.target_id) ELSE r.target_id END target_id,r.status,r.created_at
 FROM reports r LEFT JOIN users u ON r.target_type='PROFILE' AND (u.id=r.target_id OR lower(u.username)=lower(r.target_id)) WHERE r.case_id IS NULL
 UNION ALL
 SELECT q.target_type,CASE WHEN q.target_type='PROFILE' THEN coalesce(q.creator_id,q.target_id) ELSE q.target_id END,q.status,q.created_at
 FROM moderation_queue q WHERE q.case_id IS NULL
) sources WHERE target_type IN ('SKILLSHOT','COMMENT','PROFILE') GROUP BY target_type,target_id
ON CONFLICT(target_type,target_id) DO NOTHING;
UPDATE reports r SET case_id=c.id FROM report_cases c WHERE r.case_id IS NULL AND c.target_type=r.target_type
 AND (c.target_id=r.target_id OR (r.target_type='PROFILE' AND EXISTS(SELECT 1 FROM users u WHERE u.id=c.target_id AND lower(u.username)=lower(r.target_id))));
UPDATE moderation_queue q SET case_id=c.id FROM report_cases c WHERE q.case_id IS NULL AND c.target_type=q.target_type
 AND c.target_id=CASE WHEN q.target_type='PROFILE' THEN coalesce(q.creator_id,q.target_id) ELSE q.target_id END;
INSERT INTO report_case_events(case_id,actor_id,action,reason,created_at,source_key)
 SELECT case_id,reporter_id,'REPORT_CREATED',category,created_at,'reports:'||id FROM reports WHERE case_id IS NOT NULL ON CONFLICT(source_key) DO NOTHING;
INSERT INTO report_case_events(case_id,action,reason,metadata,created_at,source_key)
 SELECT case_id,'AUTOMATIC_FLAG',category,jsonb_build_object('severity',severity),created_at,'moderation_queue:'||id FROM moderation_queue WHERE case_id IS NOT NULL AND source<>'REPORT' ON CONFLICT(source_key) DO NOTHING;
INSERT INTO report_case_events(case_id,actor_id,action,reason,metadata,created_at,source_key)
 SELECT c.id,l.actor_id,l.action,coalesce(l.metadata->>'reason',''),l.metadata,l.created_at,'audit:'||l.id
 FROM audit_logs l JOIN report_cases c ON c.target_type=l.target_type AND c.target_id=l.target_id
 WHERE l.action LIKE 'MODERATION_%' AND NOT (l.metadata ? 'caseId') ON CONFLICT(source_key) DO NOTHING;

-- Both existing upload moderation and user reporting enter the same canonical case.
CREATE OR REPLACE FUNCTION skillshot_track_case() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE target text; cid text; who text; event text;
BEGIN
 target := NEW.target_id;
 IF NEW.target_type='PROFILE' THEN
   IF TG_TABLE_NAME='moderation_queue' THEN target := coalesce(NEW.creator_id,target);
   ELSE SELECT id INTO target FROM users WHERE id=NEW.target_id OR lower(username)=lower(NEW.target_id) LIMIT 1; target:=coalesce(target,NEW.target_id); END IF;
 END IF;
 INSERT INTO report_cases(target_type,target_id) VALUES(NEW.target_type,target)
 ON CONFLICT(target_type,target_id) DO UPDATE SET
 status=CASE WHEN report_cases.status IN ('RESOLVED','DISMISSED') THEN 'PENDING' ELSE report_cases.status END,
 decision=NULL,decision_reason=NULL,resolved_at=NULL,resolved_by=NULL,version=report_cases.version+1,updated_at=now()
 RETURNING id INTO cid;
 NEW.case_id:=cid;
 IF TG_TABLE_NAME='reports' THEN who:=NEW.reporter_id; event:='REPORT_CREATED';
 ELSE who:=NULL; event:=CASE WHEN NEW.source='REPORT' THEN 'REPORT_QUEUED' ELSE 'AUTOMATIC_FLAG' END; END IF;
 INSERT INTO report_case_events(case_id,actor_id,action,reason,source_key) VALUES(cid,who,event,NEW.category,TG_TABLE_NAME||':'||NEW.id);
 INSERT INTO audit_logs(id,actor_id,action,target_type,target_id,metadata) VALUES(gen_random_uuid()::text,who,event,NEW.target_type,target,jsonb_build_object('caseId',cid,'sourceId',NEW.id));
 RETURN NEW;
END $$;
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_trigger WHERE tgname='skillshot_reports_case') THEN CREATE TRIGGER skillshot_reports_case BEFORE INSERT ON reports FOR EACH ROW EXECUTE FUNCTION skillshot_track_case(); END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_trigger WHERE tgname='skillshot_queue_case') THEN CREATE TRIGGER skillshot_queue_case BEFORE INSERT ON moderation_queue FOR EACH ROW EXECUTE FUNCTION skillshot_track_case(); END IF;
END $$;
`;
// Top-level commands start at column zero; function/DO bodies are kept intact.
export const REPORT_CASE_MIGRATION = REPORT_CASE_SCHEMA.trim().split(/;(?:\r?\n)+(?=(?:--|SELECT |ALTER |CREATE |INSERT |UPDATE |DO ))/);
