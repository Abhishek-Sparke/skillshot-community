export const SETTINGS_MIGRATION = [
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS preferences jsonb NOT NULL DEFAULT '{}'::jsonb`,
  `CREATE OR REPLACE FUNCTION skillshot_notification_preference() RETURNS trigger LANGUAGE plpgsql AS $$
  DECLARE preference text; enabled text;
  BEGIN
    IF NEW.user_id IS NULL OR NEW.audience='STAFF' THEN RETURN NEW; END IF;
    preference := CASE NEW.type WHEN 'LIKE' THEN 'likes' WHEN 'COMMENT' THEN 'comments' WHEN 'COMMENT_REPLY' THEN 'replies'
      WHEN 'MENTION' THEN 'mentions' WHEN 'FOLLOW' THEN 'follows' WHEN 'APPROVAL' THEN 'approvals' WHEN 'MODERATION' THEN 'moderation'
      WHEN 'APPEAL' THEN 'moderation' WHEN 'FEATURED' THEN 'featured' WHEN 'ANNOUNCEMENT' THEN 'announcements' WHEN 'TRUSTED_CONTRIBUTOR' THEN 'trusted' ELSE NULL END;
    IF preference IS NULL THEN RETURN NEW; END IF;
    SELECT preferences->'notifications'->>preference INTO enabled FROM users WHERE id=NEW.user_id;
    IF enabled='false' THEN RETURN NULL; END IF;
    RETURN NEW;
  END $$`,
  `DROP TRIGGER IF EXISTS skillshot_notification_preferences ON notifications`,
  `CREATE TRIGGER skillshot_notification_preferences BEFORE INSERT ON notifications FOR EACH ROW EXECUTE FUNCTION skillshot_notification_preference()`,
];
