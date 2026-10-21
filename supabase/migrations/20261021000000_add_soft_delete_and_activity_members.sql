-- =========================================================================
-- Migration: Additive soft-delete, activity_members, app_meta
-- Phase 1 only. Does NOT change the single-active-activity rule (Phase 2).
-- Safe to run on production: only ADD columns/tables/indexes, no DROP TABLE.
-- =========================================================================

-- 1. Soft-delete columns (additive)
ALTER TABLE activities ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE members ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

ALTER TABLE activity_logs
  ADD COLUMN IF NOT EXISTS is_archived BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE activity_logs
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- 2. activity_members (many-to-many)
CREATE TABLE IF NOT EXISTS activity_members (
  activity_id UUID NOT NULL REFERENCES activities(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  PRIMARY KEY (activity_id, member_id)
);

CREATE INDEX IF NOT EXISTS idx_activity_members_member
  ON activity_members(member_id);

-- 3. app_meta (cloud initialization marker + one-time backfill marker)
CREATE TABLE IF NOT EXISTS app_meta (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 4. RLS for new tables
ALTER TABLE activity_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_meta ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Akses publik anggota kegiatan" ON activity_members;
CREATE POLICY "Akses publik anggota kegiatan"
  ON activity_members FOR ALL TO anon
  USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Akses publik meta aplikasi" ON app_meta;
CREATE POLICY "Akses publik meta aplikasi"
  ON app_meta FOR ALL TO anon
  USING (true) WITH CHECK (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON activity_members TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON app_meta TO anon, authenticated;

-- 5. Realtime
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE activity_members;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN undefined_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE app_meta;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN undefined_object THEN NULL;
END $$;

-- 6. One-time backfill: all members x all activities per organization
-- Guarded by app_meta marker so re-running does not re-add intentionally removed memberships.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM app_meta WHERE key = 'activity_members_backfill_v1') THEN
    INSERT INTO activity_members (activity_id, member_id)
    SELECT a.id, m.id
    FROM activities a
    JOIN members m ON m.organization_id = a.organization_id
    ON CONFLICT DO NOTHING;

    INSERT INTO app_meta (key, value)
    VALUES ('activity_members_backfill_v1', 'true'::jsonb)
    ON CONFLICT (key) DO NOTHING;
  END IF;
END $$;

-- 7. Cloud initialization marker (only if data already exists)
INSERT INTO app_meta (key, value)
SELECT 'cloud_initialized_at', to_jsonb(timezone('utc'::text, now()))
WHERE EXISTS (SELECT 1 FROM organizations)
ON CONFLICT (key) DO NOTHING;

-- Verification (read-only, safe to run):
-- SELECT 'organizations', count(*) FROM organizations
-- UNION ALL SELECT 'members', count(*) FROM members
-- UNION ALL SELECT 'activities', count(*) FROM activities
-- UNION ALL SELECT 'tasks', count(*) FROM tasks
-- UNION ALL SELECT 'activity_logs', count(*) FROM activity_logs
-- UNION ALL SELECT 'activity_members', count(*) FROM activity_members;