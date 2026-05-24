const express = require("express");
const bcrypt = require("bcrypt");
const crypto = require("crypto");
const router = express.Router();

const pool = require("../db");
const stripe = require("../stripeClient");
const authenticateToken = require("../middleware/authMiddleware");
const {
  getRoleLabel,
  getRolePermissions,
  normalizeRole,
  requireMinimumRole,
} = require("../middleware/roleMiddleware");
const { assertNotDisposableEmail } = require("./services/emailGuard");
const { normalizeToE164 } = require("./services/phoneGuard");

const STAFF_ROLE_SQL_LIST = "'staff','front_desk','manager','admin','owner','franchise_owner','franchise'";
const PASSWORD_POLICY_MESSAGE =
  "Password must be at least 8 characters long, include letters and numbers, and avoid common passwords or three identical characters in a row.";
const COMMON_PASSWORDS = new Set([
  "12345678",
  "123456789",
  "11111111",
  "abc12345",
  "password",
  "password1",
  "password12",
  "password123",
  "qwerty123",
]);
const ALLOWED_MEMBERSHIP_STATUSES = new Set(["active", "inactive", "frozen", "canceled"]);

router.use(authenticateToken, requireMinimumRole("front_desk"));

function isStrongPassword(password) {
  const value = String(password || "");

  if (value.length < 8) return false;
  if (!/[A-Za-z]/.test(value) || !/\d/.test(value)) return false;
  if (/(.)\1\1/.test(value)) return false;
  if (COMMON_PASSWORDS.has(value.toLowerCase())) return false;

  return true;
}

function getAssignableStaffRoles(role) {
  const normalizedRole = normalizeRole(role);

  if (normalizedRole === "owner") {
    return ["front_desk", "manager", "owner"];
  }

  if (normalizedRole === "manager") {
    return ["front_desk"];
  }

  return [];
}

function parseDateOnly(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error("membership_expiry must be a valid date");
  }

  return parsed.toISOString().slice(0, 10);
}

function buildScopeClause(operator, columnName, params) {
  if (operator.role === "owner" || !operator.home_club_id) {
    return "";
  }

  params.push(operator.home_club_id);
  return ` AND ${columnName} = $${params.length}`;
}

async function assertBranchExists(branchId) {
  const branchRes = await pool.query(`SELECT id, name FROM branches WHERE id = $1 LIMIT 1`, [branchId]);

  if (branchRes.rows.length === 0) {
    throw new Error("Invalid branch_id");
  }

  return branchRes.rows[0];
}

async function getOperatorContext(userId) {
  const operatorRes = await pool.query(
    `
    SELECT
      u.id,
      u.name,
      u.email,
      u.role,
      u.home_club_id,
      b.name AS home_club_name
    FROM users u
    LEFT JOIN branches b ON b.id = u.home_club_id
    WHERE u.id = $1
    LIMIT 1
    `,
    [userId]
  );

  if (operatorRes.rows.length === 0) {
    throw new Error("Staff user not found");
  }

  const row = operatorRes.rows[0];
  const role = normalizeRole(row.role);

  return {
    ...row,
    role,
    role_label: getRoleLabel(role),
    permissions: getRolePermissions(role),
  };
}

router.get("/dashboard", async (req, res) => {
  try {
    const operator = await getOperatorContext(req.user.userId);

    const summaryParams = [];
    const summaryScope = buildScopeClause(operator, "u.home_club_id", summaryParams);

    const recentParams = [];
    const recentScope = buildScopeClause(operator, "cl.branch_id", recentParams);

    const branchParams = [];
    const branchScope = operator.role === "owner" || !operator.home_club_id ? "" : "WHERE b.id = $1";
    if (branchScope) {
      branchParams.push(operator.home_club_id);
    }

    const staffCountParams = [];
    const staffCountScope = buildScopeClause(operator, "home_club_id", staffCountParams);

    const [summaryRes, staffCountsRes, recentCheckinsRes, attendanceTrendRes, branchesRes, plansRes, branchActivityRes, upcomingClassesRes] =
      await Promise.all([
        pool.query(
          `
          SELECT
            COUNT(*) FILTER (
              WHERE LOWER(COALESCE(u.role, 'member')) NOT IN (${STAFF_ROLE_SQL_LIST})
                AND COALESCE(u.status, 'ACTIVE') <> 'DELETED'
            )::int AS total_members,
            COUNT(*) FILTER (
              WHERE LOWER(COALESCE(u.role, 'member')) NOT IN (${STAFF_ROLE_SQL_LIST})
                AND u.membership_status = 'active'
                AND u.membership_expiry IS NOT NULL
                AND u.membership_expiry >= CURRENT_DATE
            )::int AS active_memberships,
            COUNT(*) FILTER (
              WHERE LOWER(COALESCE(u.role, 'member')) NOT IN (${STAFF_ROLE_SQL_LIST})
                AND u.membership_status = 'frozen'
            )::int AS frozen_memberships,
            COUNT(*) FILTER (
              WHERE LOWER(COALESCE(u.role, 'member')) NOT IN (${STAFF_ROLE_SQL_LIST})
                AND u.membership_status = 'canceled'
            )::int AS canceled_memberships
          FROM users u
          WHERE 1 = 1${summaryScope}
          `,
          summaryParams
        ),
        pool.query(
          `
          SELECT
            COUNT(*) FILTER (
              WHERE LOWER(COALESCE(role, 'member')) IN ('staff', 'front_desk')
            )::int AS front_desk_count,
            COUNT(*) FILTER (
              WHERE LOWER(COALESCE(role, 'member')) = 'manager'
            )::int AS manager_count,
            COUNT(*) FILTER (
              WHERE LOWER(COALESCE(role, 'member')) IN ('admin', 'owner', 'franchise_owner', 'franchise')
            )::int AS owner_count
          FROM users
          WHERE COALESCE(status, 'ACTIVE') <> 'DELETED'${staffCountScope}
          `,
          staffCountParams
        ),
        pool.query(
          `
          SELECT
            cl.id,
            cl.checkin_time,
            u.id AS user_id,
            u.name AS member_name,
            u.membership_code,
            b.id AS branch_id,
            b.name AS branch_name
          FROM checkin_logs cl
          INNER JOIN users u ON u.id = cl.user_id
          LEFT JOIN branches b ON b.id = cl.branch_id
          WHERE 1 = 1${recentScope}
          ORDER BY cl.checkin_time DESC
          LIMIT 12
          `,
          recentParams
        ),
        pool.query(
          `
          SELECT
            days.day,
            TO_CHAR(days.day, 'Dy') AS day_label,
            COALESCE(counts.checkins, 0)::int AS checkins
          FROM (
            SELECT generate_series(
              CURRENT_DATE - INTERVAL '6 day',
              CURRENT_DATE,
              INTERVAL '1 day'
            )::date AS day
          ) days
          LEFT JOIN (
            SELECT
              DATE(cl.checkin_time) AS day,
              COUNT(*)::int AS checkins
            FROM checkin_logs cl
            WHERE cl.checkin_time >= CURRENT_DATE - INTERVAL '6 day'${recentScope}
            GROUP BY DATE(cl.checkin_time)
          ) counts ON counts.day = days.day
          ORDER BY days.day ASC
          `,
          recentParams
        ),
        pool.query(
          `
          SELECT id, name
          FROM branches b
          ${branchScope}
          ORDER BY name ASC
          `,
          branchParams
        ),
        pool.query(
          `
          SELECT id, name, price
          FROM membership_plans
          WHERE is_active = true
          ORDER BY price ASC, name ASC
          `
        ),
        pool.query(
          `
          SELECT
            b.id,
            b.name,
            COUNT(cl.id)::int AS today_checkins
          FROM branches b
          LEFT JOIN checkin_logs cl
            ON cl.branch_id = b.id
           AND cl.checkin_time >= CURRENT_DATE
           AND cl.checkin_time < CURRENT_DATE + INTERVAL '1 day'
          ${branchScope}
          GROUP BY b.id, b.name
          ORDER BY today_checkins DESC, b.name ASC
          `,
          branchParams
        ),
        pool.query(
          `
          SELECT COUNT(*)::int AS upcoming_classes
          FROM class_sessions
          WHERE scheduled_at > NOW()
          `
        ),
      ]);

    const branchActivity = branchActivityRes.rows || [];
    const todayCheckins = branchActivity.reduce(
      (sum, branch) => sum + Number(branch.today_checkins || 0),
      0
    );

    return res.status(200).json({
      operator: {
        id: operator.id,
        name: operator.name,
        email: operator.email,
        role: operator.role,
        role_label: operator.role_label,
        home_club_id: operator.home_club_id,
        home_club_name: operator.home_club_name,
      },
      permissions: operator.permissions,
      access_model: {
        internal_only: true,
        staff_accounts_created_internally: true,
        customer_app_separate_from_admin: true,
        location_restricted: operator.role !== "owner" && !!operator.home_club_id,
        assignable_staff_roles: getAssignableStaffRoles(operator.role),
      },
      summary: {
        ...(summaryRes.rows[0] || {}),
        ...(staffCountsRes.rows[0] || {}),
        branch_count: branchesRes.rows.length,
        today_checkins: todayCheckins,
        upcoming_classes: upcomingClassesRes.rows[0]?.upcoming_classes || 0,
      },
      branches: branchesRes.rows || [],
      membership_plans: plansRes.rows || [],
      branch_activity: branchActivity,
      attendance_trend: attendanceTrendRes.rows || [],
      recent_checkins: recentCheckinsRes.rows || [],
    });
  } catch (error) {
    console.error("admin dashboard error:", error);
    return res.status(500).json({ message: error.message || "Unable to load admin dashboard" });
  }
});

router.get("/members", async (req, res) => {
  try {
    const operator = await getOperatorContext(req.user.userId);
    const query = String(req.query.q || "").trim();

    if (!query) {
      return res.status(200).json({ members: [] });
    }

    const like = `%${query.toLowerCase()}%`;
    const params = [like, query];
    const scopeClause = buildScopeClause(operator, "u.home_club_id", params);

    const result = await pool.query(
      `
      SELECT
        u.id,
        u.name,
        u.email,
        u.phone_number,
        u.membership_code,
        u.membership_status,
        u.membership_expiry,
        u.role,
        u.home_club_id,
        mp.name AS membership_plan_name,
        b.name AS home_club_name
      FROM users u
      LEFT JOIN membership_plans mp ON mp.id = u.membership_plan_id
      LEFT JOIN branches b ON b.id = u.home_club_id
      WHERE COALESCE(u.status, 'ACTIVE') <> 'DELETED'
        AND LOWER(COALESCE(u.role, 'member')) NOT IN (${STAFF_ROLE_SQL_LIST})
        AND (
          LOWER(COALESCE(u.name, '')) LIKE $1
          OR LOWER(COALESCE(u.email, '')) LIKE $1
          OR LOWER(COALESCE(u.phone_number, '')) LIKE $1
          OR LOWER(COALESCE(u.membership_code, '')) LIKE $1
        )${scopeClause}
      ORDER BY
        CASE
          WHEN LOWER(COALESCE(u.membership_code, '')) = LOWER($2) THEN 0
          WHEN LOWER(COALESCE(u.email, '')) = LOWER($2) THEN 1
          WHEN LOWER(COALESCE(u.name, '')) = LOWER($2) THEN 2
          ELSE 3
        END,
        u.name ASC NULLS LAST
      LIMIT 20
      `,
      params
    );

    return res.status(200).json({
      members: result.rows.map((member) => ({
        ...member,
        role: normalizeRole(member.role),
      })),
    });
  } catch (error) {
    console.error("admin member search error:", error);
    return res.status(500).json({ message: "Unable to search members" });
  }
});

router.get("/members/:id", async (req, res) => {
  try {
    const operator = await getOperatorContext(req.user.userId);
    const memberId = Number(req.params.id);

    if (!Number.isInteger(memberId)) {
      return res.status(400).json({ message: "Invalid member id" });
    }

    const memberParams = [memberId];
    const scopeClause = buildScopeClause(operator, "u.home_club_id", memberParams);
    const checkinParams = [memberId];
    const checkinScope = buildScopeClause(operator, "cl.branch_id", checkinParams);

    const [memberRes, visitsRes] = await Promise.all([
      pool.query(
        `
        SELECT
          u.id,
          u.name,
          u.email,
          u.phone_number,
          u.membership_code,
          u.membership_status,
          u.membership_expiry,
          u.role,
          u.home_club_id,
          mp.id AS membership_plan_id,
          mp.name AS membership_plan_name,
          b.name AS home_club_name
        FROM users u
        LEFT JOIN membership_plans mp ON mp.id = u.membership_plan_id
        LEFT JOIN branches b ON b.id = u.home_club_id
        WHERE u.id = $1
          AND LOWER(COALESCE(u.role, 'member')) NOT IN (${STAFF_ROLE_SQL_LIST})${scopeClause}
        LIMIT 1
        `,
        memberParams
      ),
      pool.query(
        `
        SELECT
          cl.checkin_time,
          cl.branch_id,
          b.name AS branch_name
        FROM checkin_logs cl
        LEFT JOIN branches b ON b.id = cl.branch_id
        WHERE cl.user_id = $1${checkinScope}
        ORDER BY cl.checkin_time DESC
        LIMIT 10
        `,
        checkinParams
      ),
    ]);

    if (memberRes.rows.length === 0) {
      return res.status(404).json({ message: "Member not found" });
    }

    return res.status(200).json({
      member: {
        ...memberRes.rows[0],
        role: normalizeRole(memberRes.rows[0].role),
      },
      recent_checkins: visitsRes.rows || [],
    });
  } catch (error) {
    console.error("admin member detail error:", error);
    return res.status(500).json({ message: "Unable to load member detail" });
  }
});

router.patch("/members/:id", async (req, res) => {
  try {
    const operator = await getOperatorContext(req.user.userId);
    const memberId = Number(req.params.id);

    if (!Number.isInteger(memberId)) {
      return res.status(400).json({ message: "Invalid member id" });
    }

    const currentParams = [memberId];
    const scopeClause = buildScopeClause(operator, "u.home_club_id", currentParams);
    const currentRes = await pool.query(
      `
      SELECT
        u.id,
        u.name,
        u.phone_number,
        u.country_region,
        u.home_club_id,
        u.membership_status,
        u.membership_expiry,
        u.membership_plan_id,
        u.role,
        u.stripe_subscription_id
      FROM users u
      WHERE u.id = $1${scopeClause}
      LIMIT 1
      `,
      currentParams
    );

    if (currentRes.rows.length === 0) {
      return res.status(404).json({ message: "Member not found" });
    }

    const current = currentRes.rows[0];
    if (normalizeRole(current.role) !== "member") {
      return res.status(400).json({ message: "This route manages member accounts only" });
    }

    const body = req.body || {};
    const hasName = Object.prototype.hasOwnProperty.call(body, "name");
    const hasPhone = Object.prototype.hasOwnProperty.call(body, "phone_number");
    const hasHomeClub = Object.prototype.hasOwnProperty.call(body, "home_club_id");
    const hasMembershipStatus = Object.prototype.hasOwnProperty.call(body, "membership_status");
    const hasMembershipPlan = Object.prototype.hasOwnProperty.call(body, "membership_plan_id");
    const hasMembershipExpiry = Object.prototype.hasOwnProperty.call(body, "membership_expiry");
    const scheduleCancellation = Boolean(body.schedule_cancellation);

    if (!hasName && !hasPhone && !hasHomeClub && !hasMembershipStatus && !hasMembershipPlan && !hasMembershipExpiry) {
      return res.status(400).json({ message: "No member changes were provided" });
    }

    if ((hasName || hasPhone || hasHomeClub) && !operator.permissions.can_edit_member_basic) {
      return res.status(403).json({ message: "Front desk access is required for basic member edits" });
    }

    if ((hasMembershipStatus || hasMembershipPlan || hasMembershipExpiry || scheduleCancellation) && !operator.permissions.can_manage_membership) {
      return res.status(403).json({ message: "Manager access is required for membership controls" });
    }

    const updates = [];
    const params = [];

    if (hasName) {
      const nextName = String(body.name || "").trim();
      if (!nextName) {
        return res.status(400).json({ message: "Name is required" });
      }

      params.push(nextName);
      updates.push(`name = $${params.length}`);
    }

    if (hasPhone) {
      const rawPhone = String(body.phone_number || "").trim();
      if (!rawPhone) {
        return res.status(400).json({ message: "Phone number is required" });
      }

      const region = (current.country_region || "US").toUpperCase();
      const nextPhone = normalizeToE164(rawPhone, region);
      const existingPhone = await pool.query(
        "SELECT 1 FROM users WHERE phone_number = $1 AND id <> $2 LIMIT 1",
        [nextPhone, memberId]
      );

      if (existingPhone.rows.length > 0) {
        return res.status(400).json({ message: "Phone number already in use" });
      }

      params.push(nextPhone);
      updates.push(`phone_number = $${params.length}`);
    }

    if (hasHomeClub) {
      const nextHomeClubId = Number(body.home_club_id);
      if (!Number.isInteger(nextHomeClubId)) {
        return res.status(400).json({ message: "home_club_id is required" });
      }

      if (operator.role !== "owner" && operator.home_club_id && Number(operator.home_club_id) !== nextHomeClubId) {
        return res.status(403).json({ message: "Your access is tied to a different club" });
      }

      await assertBranchExists(nextHomeClubId);

      params.push(nextHomeClubId);
      updates.push(`home_club_id = $${params.length}`);
    }

    if (hasMembershipStatus) {
      const nextStatus = String(body.membership_status || "").trim().toLowerCase();
      if (!ALLOWED_MEMBERSHIP_STATUSES.has(nextStatus)) {
        return res.status(400).json({ message: "Invalid membership_status" });
      }

      params.push(nextStatus);
      updates.push(`membership_status = $${params.length}`);
    }

    if (hasMembershipPlan) {
      const planValue =
        body.membership_plan_id === null || body.membership_plan_id === ""
          ? null
          : String(body.membership_plan_id).trim();

      if (planValue) {
        const planRes = await pool.query(
          `SELECT id FROM membership_plans WHERE id::text = $1 LIMIT 1`,
          [planValue]
        );

        if (planRes.rows.length === 0) {
          return res.status(400).json({ message: "Invalid membership_plan_id" });
        }
      }

      params.push(planValue);
      updates.push(`membership_plan_id = $${params.length}`);
    }

    if (hasMembershipExpiry) {
      const nextExpiry = parseDateOnly(body.membership_expiry);
      params.push(nextExpiry);
      updates.push(`membership_expiry = $${params.length}`);
    }

    if (updates.length === 0) {
      return res.status(400).json({ message: "No valid member changes were provided" });
    }

    params.push(memberId);
    await pool.query(
      `
      UPDATE users
      SET ${updates.join(", ")}
      WHERE id = $${params.length}
      `,
      params
    );

    let billingAction = null;
    if (scheduleCancellation && current.stripe_subscription_id) {
      try {
        const subscription = await stripe.subscriptions.update(current.stripe_subscription_id, {
          cancel_at_period_end: true,
        });
        billingAction = subscription?.cancel_at_period_end
          ? "cancellation_scheduled"
          : "manual_follow_up_required";
      } catch (error) {
        console.warn("admin membership cancellation sync failed:", error?.message || error);
        billingAction = "manual_follow_up_required";
      }
    }

    const updatedRes = await pool.query(
      `
      SELECT
        u.id,
        u.name,
        u.email,
        u.phone_number,
        u.membership_code,
        u.membership_status,
        u.membership_expiry,
        u.home_club_id,
        u.role,
        mp.id AS membership_plan_id,
        mp.name AS membership_plan_name,
        b.name AS home_club_name
      FROM users u
      LEFT JOIN membership_plans mp ON mp.id = u.membership_plan_id
      LEFT JOIN branches b ON b.id = u.home_club_id
      WHERE u.id = $1
      LIMIT 1
      `,
      [memberId]
    );

    return res.status(200).json({
      message: "Member updated",
      billing_action: billingAction,
      member: {
        ...updatedRes.rows[0],
        role: normalizeRole(updatedRes.rows[0]?.role),
      },
    });
  } catch (error) {
    console.error("admin member update error:", error);
    return res.status(400).json({ message: error.message || "Unable to update member" });
  }
});

router.get("/staff", async (req, res) => {
  try {
    const operator = await getOperatorContext(req.user.userId);

    if (!operator.permissions.can_manage_staff_accounts) {
      return res.status(403).json({ message: "Manager access is required to view staff accounts" });
    }

    const params = [];
    const scopeClause = buildScopeClause(operator, "u.home_club_id", params);

    const staffRes = await pool.query(
      `
      SELECT
        u.id,
        u.name,
        u.email,
        u.phone_number,
        u.role,
        u.home_club_id,
        u.status,
        b.name AS home_club_name
      FROM users u
      LEFT JOIN branches b ON b.id = u.home_club_id
      WHERE LOWER(COALESCE(u.role, 'member')) IN (${STAFF_ROLE_SQL_LIST})${scopeClause}
      ORDER BY u.name ASC NULLS LAST
      LIMIT 40
      `,
      params
    );

    return res.status(200).json({
      staff: staffRes.rows.map((staffMember) => {
        const role = normalizeRole(staffMember.role);
        return {
          ...staffMember,
          role,
          role_label: getRoleLabel(role),
        };
      }),
    });
  } catch (error) {
    console.error("admin staff list error:", error);
    return res.status(500).json({ message: "Unable to load staff accounts" });
  }
});

router.post("/staff", async (req, res) => {
  try {
    const operator = await getOperatorContext(req.user.userId);

    if (!operator.permissions.can_manage_staff_accounts) {
      return res.status(403).json({ message: "Manager access is required to issue staff credentials" });
    }

    const { name, email, phone_number, password, role, home_club_id } = req.body || {};
    const cleanName = String(name || "").trim();
    const cleanEmail = String(email || "").trim().toLowerCase();
    const cleanRole = normalizeRole(role);

    if (!cleanName || !cleanEmail || !phone_number || !password || !role) {
      return res.status(400).json({
        message: "name, email, phone_number, password, and role are required",
      });
    }

    const allowedRoles = getAssignableStaffRoles(operator.role);
    if (!allowedRoles.includes(cleanRole)) {
      return res.status(403).json({ message: "You do not have permission to assign that staff role" });
    }

    await assertNotDisposableEmail(pool, cleanEmail);

    if (!isStrongPassword(password)) {
      return res.status(400).json({ message: PASSWORD_POLICY_MESSAGE });
    }

    const phoneE164 = normalizeToE164(phone_number, "US");
    const existingUser = await pool.query(
      "SELECT 1 FROM users WHERE LOWER(email) = $1 OR phone_number = $2 LIMIT 1",
      [cleanEmail, phoneE164]
    );

    if (existingUser.rows.length > 0) {
      return res.status(400).json({ message: "Email or phone number already in use" });
    }

    let targetHomeClubId =
      home_club_id === null || home_club_id === undefined || home_club_id === ""
        ? null
        : Number(home_club_id);

    if (cleanRole !== "owner") {
      if (
        !Number.isInteger(targetHomeClubId) &&
        operator.home_club_id !== null &&
        operator.home_club_id !== undefined &&
        Number.isInteger(Number(operator.home_club_id))
      ) {
        targetHomeClubId = Number(operator.home_club_id);
      }

      if (!Number.isInteger(targetHomeClubId)) {
        return res.status(400).json({ message: "home_club_id is required for front desk and manager staff" });
      }
    }

    if (Number.isInteger(targetHomeClubId)) {
      if (operator.role !== "owner" && operator.home_club_id && Number(operator.home_club_id) !== targetHomeClubId) {
        return res.status(403).json({ message: "You can only issue staff access for your club" });
      }

      await assertBranchExists(targetHomeClubId);
    }

    const hashedPassword = await bcrypt.hash(password, 12);
    const createdRes = await pool.query(
      `
      INSERT INTO users (
        name,
        email,
        phone_number,
        password_hash,
        email_verified,
        status,
        role,
        home_club_id,
        membership_status
      )
      VALUES ($1, $2, $3, $4, TRUE, 'ACTIVE', $5, $6, 'inactive')
      RETURNING id, name, email, phone_number, role, home_club_id, status
      `,
      [cleanName, cleanEmail, phoneE164, hashedPassword, cleanRole, targetHomeClubId]
    );

    const created = createdRes.rows[0];
    const branchNameRes = Number.isInteger(Number(created.home_club_id))
      ? await pool.query(`SELECT name FROM branches WHERE id = $1 LIMIT 1`, [created.home_club_id])
      : { rows: [] };

    return res.status(201).json({
      message: "Staff credentials issued",
      staff_member: {
        ...created,
        role: normalizeRole(created.role),
        role_label: getRoleLabel(created.role),
        home_club_name: branchNameRes.rows[0]?.name || null,
      },
    });
  } catch (error) {
    console.error("admin staff create error:", error);
    return res.status(400).json({ message: error.message || "Unable to create staff account" });
  }
});

router.post("/checkin/verify", async (req, res) => {
  try {
    const operator = await getOperatorContext(req.user.userId);
    const { token, membership_code, branch_id } = req.body || {};

    if (!operator.permissions.can_scan_members) {
      return res.status(403).json({ message: "Front desk access is required for check-in scanning" });
    }

    if (!branch_id) {
      return res.status(400).json({ message: "branch_id is required" });
    }

    const numericBranchId = Number(branch_id);
    if (!Number.isInteger(numericBranchId)) {
      return res.status(400).json({ message: "Invalid branch_id" });
    }

    if (operator.role !== "owner" && operator.home_club_id && Number(operator.home_club_id) !== numericBranchId) {
      return res.status(403).json({ message: "Your scanner access is restricted to your club" });
    }

    let resolvedMembershipCode = null;

    if (token) {
      const secret = process.env.QR_SECRET || process.env.JWT_SECRET;
      if (!secret) {
        return res.status(500).json({ message: "Missing QR_SECRET or JWT_SECRET in .env" });
      }

      const parts = String(token).split(".");
      if (parts.length !== 3) {
        return res.status(400).json({ message: "Invalid token format" });
      }

      const [code, windowStr, sig] = parts;
      const window = Number(windowStr);

      if (!code || !Number.isFinite(window) || !sig) {
        return res.status(400).json({ message: "Invalid token content" });
      }

      const windowSeconds = 30;
      const nowWindow = Math.floor(Math.floor(Date.now() / 1000) / windowSeconds);
      const allowedWindows = new Set([nowWindow, nowWindow - 1, nowWindow + 1]);

      if (!allowedWindows.has(window)) {
        return res.status(403).json({ message: "Token expired" });
      }

      const payload = `${code}.${window}`;
      const expectedSig = crypto
        .createHmac("sha256", secret)
        .update(payload)
        .digest("hex");

      const ok =
        expectedSig.length === sig.length &&
        crypto.timingSafeEqual(Buffer.from(expectedSig), Buffer.from(sig));

      if (!ok) {
        return res.status(403).json({ message: "Invalid token signature" });
      }

      resolvedMembershipCode = String(code).trim();
    } else {
      if (!membership_code) {
        return res.status(400).json({ message: "token or membership_code is required" });
      }
      resolvedMembershipCode = String(membership_code).trim();
    }

    const branch = await assertBranchExists(numericBranchId);

    const userResult = await pool.query(
      `
      SELECT
        id,
        name,
        role,
        membership_status,
        membership_plan_id,
        home_club_id
      FROM users
      WHERE membership_code = $1
      LIMIT 1
      `,
      [resolvedMembershipCode]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ message: "Invalid membership code" });
    }

    const user = userResult.rows[0];
    if (normalizeRole(user.role) !== "member") {
      return res.status(403).json({ message: "Only member accounts can use this scanner" });
    }

    if (user.membership_status !== "active") {
      return res.status(403).json({ message: "Membership inactive" });
    }

    let accessScope = "ALL_CLUBS";

    if (user.membership_plan_id) {
      const normalizedPlan = String(user.membership_plan_id).toLowerCase();

      if (normalizedPlan === "basic") {
        accessScope = "HOME_ONLY";
      } else if (normalizedPlan === "pro") {
        accessScope = "ALL_CLUBS";
      } else {
        const planRes = await pool.query(
          `SELECT access_scope FROM membership_plans WHERE id = $1 LIMIT 1`,
          [user.membership_plan_id]
        );
        accessScope = planRes.rows[0]?.access_scope || "ALL_CLUBS";
      }
    }

    if (accessScope === "HOME_ONLY") {
      if (!user.home_club_id) {
        return res.status(403).json({ message: "Home club not set for this member" });
      }

      if (numericBranchId !== Number(user.home_club_id)) {
        return res.status(403).json({
          message: "Access denied: this plan allows check-in only at the home club",
          allowed_club_id: user.home_club_id,
        });
      }
    }

    const alreadyCheckedIn = await pool.query(
      `
      SELECT checkin_time, branch_id
      FROM checkin_logs
      WHERE user_id = $1
        AND checkin_time::date = CURRENT_DATE
      ORDER BY checkin_time DESC
      LIMIT 1
      `,
      [user.id]
    );

    if (alreadyCheckedIn.rows.length > 0) {
      const previousVisit = alreadyCheckedIn.rows[0];
      const previousBranch = await pool.query(
        `SELECT id, name FROM branches WHERE id = $1 LIMIT 1`,
        [previousVisit.branch_id]
      );

      return res.status(200).json({
        message: "Already checked in today",
        user: { id: user.id, name: user.name },
        checkin_time: previousVisit.checkin_time,
        branch: previousBranch.rows[0] || null,
      });
    }

    const logResult = await pool.query(
      `
      INSERT INTO checkin_logs (user_id, branch_id)
      VALUES ($1, $2)
      RETURNING checkin_time
      `,
      [user.id, numericBranchId]
    );

    return res.status(200).json({
      message: "Check-in successful",
      user: { id: user.id, name: user.name },
      checkin_time: logResult.rows[0].checkin_time,
      branch: { id: branch.id, name: branch.name },
    });
  } catch (error) {
    console.error("admin scanner verify error:", error);
    return res.status(500).json({ message: error.message || "Server error" });
  }
});

module.exports = router;
