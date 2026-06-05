-- Migration: Add preview_link & github_repo to projects, poster & event to project_images

ALTER TABLE projects ADD COLUMN IF NOT EXISTS preview_link TEXT;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS github_repo TEXT;

ALTER TABLE project_images DROP CONSTRAINT IF EXISTS project_images_device_type_check;
ALTER TABLE project_images ADD CONSTRAINT project_images_device_type_check
  CHECK (device_type IN ('mobile', 'website', 'poster', 'event'));

-- Allow env-based admin usernames as user_id in activity_log
ALTER TABLE activity_log DROP CONSTRAINT IF EXISTS activity_log_user_id_fkey;
ALTER TABLE activity_log ALTER COLUMN user_id TYPE TEXT;
