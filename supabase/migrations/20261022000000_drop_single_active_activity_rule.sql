-- =========================================================================
-- Migration: Allow more than one active activity per organization (Phase 2)
-- Run ONLY after the frontend with multi-active support is ready.
-- =========================================================================

DROP TRIGGER IF EXISTS trg_single_active_activity ON activities;
DROP FUNCTION IF EXISTS handle_single_active_activity();
DROP INDEX IF EXISTS unique_active_activity_per_org;

-- Verification (read-only):
-- SELECT organization_id, count(*) FROM activities WHERE is_active = true GROUP BY organization_id;