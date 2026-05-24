BEGIN;

-- Optional employee/ID login for staff
ALTER TABLE admin_users
  ADD COLUMN IF NOT EXISTS employee_id TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS admin_users_employee_id_lower_idx
  ON admin_users (LOWER(employee_id))
  WHERE employee_id IS NOT NULL;

-- Member alerts (expired membership, blacklist, unpaid, notes escalated, etc.)
CREATE TABLE IF NOT EXISTS member_alerts (
  id BIGSERIAL PRIMARY KEY,
  member_user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  club_id BIGINT REFERENCES clubs(id) ON DELETE SET NULL,
  type TEXT NOT NULL,              -- e.g. expired_membership, unpaid_balance, blacklist, note
  message TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'info', -- info | warn | block
  status TEXT NOT NULL DEFAULT 'open',   -- open | resolved
  metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ,
  resolved_by_admin_user_id BIGINT REFERENCES admin_users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS member_alerts_member_id_status_idx
  ON member_alerts (member_user_id, status);

-- Manual payment records (for cash/POS at front desk)
CREATE TABLE IF NOT EXISTS manual_payments (
  id BIGSERIAL PRIMARY KEY,
  member_user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  club_id BIGINT REFERENCES clubs(id) ON DELETE SET NULL,
  admin_user_id BIGINT REFERENCES admin_users(id) ON DELETE SET NULL,
  amount_cents INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'usd',
  method TEXT NOT NULL DEFAULT 'cash', -- cash | pos | other
  note TEXT,
  status TEXT NOT NULL DEFAULT 'recorded',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS manual_payments_member_id_idx
  ON manual_payments (member_user_id);

-- Speed up member lookups used by staff
CREATE INDEX IF NOT EXISTS users_membership_code_lower_idx
  ON users (LOWER(membership_code))
  WHERE membership_code IS NOT NULL;

CREATE INDEX IF NOT EXISTS users_name_phone_lookup_idx
  ON users (LOWER(name), LOWER(email), LOWER(phone_number));

COMMIT;
