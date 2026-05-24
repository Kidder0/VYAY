BEGIN;

CREATE TABLE IF NOT EXISTS franchises (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS clubs (
  id BIGSERIAL PRIMARY KEY,
  franchise_id BIGINT NOT NULL REFERENCES franchises(id) ON DELETE CASCADE,
  legacy_branch_id INTEGER UNIQUE,
  name TEXT NOT NULL,
  location TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS roles (
  id BIGSERIAL PRIMARY KEY,
  key TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS permissions (
  id BIGSERIAL PRIMARY KEY,
  key TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS role_permissions (
  role_id BIGINT NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  permission_id BIGINT NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (role_id, permission_id)
);

CREATE TABLE IF NOT EXISTS admin_users (
  id BIGSERIAL PRIMARY KEY,
  franchise_id BIGINT REFERENCES franchises(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  is_super_admin BOOLEAN NOT NULL DEFAULT FALSE,
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS admin_users_email_lower_idx
  ON admin_users (LOWER(email));

CREATE TABLE IF NOT EXISTS user_club_access (
  id BIGSERIAL PRIMARY KEY,
  admin_user_id BIGINT NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
  club_id BIGINT NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  role_id BIGINT NOT NULL REFERENCES roles(id) ON DELETE RESTRICT,
  is_primary BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (admin_user_id, club_id)
);

CREATE INDEX IF NOT EXISTS user_club_access_admin_user_id_idx
  ON user_club_access (admin_user_id);

CREATE INDEX IF NOT EXISTS user_club_access_club_id_idx
  ON user_club_access (club_id);

INSERT INTO franchises (name, slug)
VALUES ('Default Franchise', 'default-franchise')
ON CONFLICT (slug) DO NOTHING;

INSERT INTO clubs (franchise_id, legacy_branch_id, name, location)
SELECT
  f.id,
  b.id,
  b.name,
  NULL
FROM branches b
INNER JOIN franchises f ON f.slug = 'default-franchise'
ON CONFLICT (legacy_branch_id) DO UPDATE
SET name = EXCLUDED.name;

INSERT INTO roles (key, name)
VALUES
  ('front_desk', 'Front Desk'),
  ('club_manager', 'Club Manager'),
  ('regional_manager', 'Regional Manager'),
  ('owner', 'Owner'),
  ('super_admin', 'Super Admin')
ON CONFLICT (key) DO NOTHING;

INSERT INTO permissions (key, name)
VALUES
  ('club.read', 'View accessible clubs'),
  ('member.read', 'Read member profiles'),
  ('member.update', 'Update member profiles'),
  ('checkin.verify', 'Verify club check-ins'),
  ('class.manage', 'Manage class sessions'),
  ('billing.refund', 'Issue refunds'),
  ('report.view', 'View reports'),
  ('staff.manage', 'Manage staff access')
ON CONFLICT (key) DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
INNER JOIN permissions p ON (
  (r.key = 'front_desk' AND p.key IN ('club.read', 'member.read', 'checkin.verify')) OR
  (r.key = 'club_manager' AND p.key IN ('club.read', 'member.read', 'member.update', 'checkin.verify', 'class.manage', 'report.view', 'staff.manage')) OR
  (r.key = 'regional_manager' AND p.key IN ('club.read', 'member.read', 'member.update', 'checkin.verify', 'class.manage', 'report.view', 'staff.manage', 'billing.refund')) OR
  (r.key = 'owner' AND p.key IN ('club.read', 'member.read', 'member.update', 'checkin.verify', 'class.manage', 'report.view', 'staff.manage', 'billing.refund')) OR
  (r.key = 'super_admin' AND p.key IN ('club.read', 'member.read', 'member.update', 'checkin.verify', 'class.manage', 'report.view', 'staff.manage', 'billing.refund'))
)
ON CONFLICT DO NOTHING;

ALTER TABLE checkin_logs
  ADD COLUMN IF NOT EXISTS club_id BIGINT REFERENCES clubs(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS checkin_logs_club_id_idx
  ON checkin_logs (club_id);

UPDATE checkin_logs cl
SET club_id = c.id
FROM clubs c
WHERE c.legacy_branch_id = cl.branch_id
  AND cl.club_id IS NULL;

ALTER TABLE class_sessions
  ADD COLUMN IF NOT EXISTS club_id BIGINT REFERENCES clubs(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS class_sessions_club_id_idx
  ON class_sessions (club_id);

ALTER TABLE trainers
  ADD COLUMN IF NOT EXISTS club_id BIGINT REFERENCES clubs(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS trainers_club_id_idx
  ON trainers (club_id);

CREATE TABLE IF NOT EXISTS member_notes (
  id BIGSERIAL PRIMARY KEY,
  club_id BIGINT REFERENCES clubs(id) ON DELETE SET NULL,
  member_user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  author_admin_user_id BIGINT REFERENCES admin_users(id) ON DELETE SET NULL,
  note TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS staff_logs (
  id BIGSERIAL PRIMARY KEY,
  club_id BIGINT REFERENCES clubs(id) ON DELETE SET NULL,
  admin_user_id BIGINT REFERENCES admin_users(id) ON DELETE SET NULL,
  action_key TEXT NOT NULL,
  target_type TEXT,
  target_id TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMIT;
