const express = require("express");
const crypto = require("crypto");
const bcrypt = require("bcrypt");

const pool = require("../db");
const { authenticateAdmin } = require("../middleware/adminAuthMiddleware");
const {
  loadAdminContext,
  requireClubAccess,
  requirePermission,
} = require("../middleware/adminAccessMiddleware");
const {
  ADMIN_STAFF_ROLE_FILTER,
  getAdminSchemaErrorMessage,
  isAdminSchemaMissingError,
} = require("./services/adminTenant");
const { logStaffAction } = require("./services/staffLogger");

const router = express.Router();

router.use(authenticateAdmin, loadAdminContext);

function getClubId(club) {
  return club?.club_id || club?.id || null;
}

function getLegacyBranchId(club) {
  return club?.legacy_branch_id || null;
}

function handlePlatformError(res, error, fallbackMessage) {
  console.error(fallbackMessage, error);

  if (isAdminSchemaMissingError(error)) {
    return res.status(500).json({ message: getAdminSchemaErrorMessage() });
  }

  return res.status(500).json({ message: error.message || fallbackMessage });
}

function resolveMembershipScope(membershipPlanId) {
  const normalized = String(membershipPlanId || "").trim().toLowerCase();

  if (!normalized) return "ALL_CLUBS";
  if (normalized === "basic") return "HOME_ONLY";
  if (normalized === "pro") return "ALL_CLUBS";

  return null;
}

async function fetchMemberWithProfile({ memberId, legacyBranchId }) {
  const result = await pool.query(
    `
    SELECT
      u.id,
      u.name,
      u.email,
      u.phone_number,
      u.membership_status,
      u.membership_code,
      u.membership_expiry,
      u.home_club_id,
      u.photo_url,
      mp.id AS membership_plan_id,
      mp.name AS membership_plan_name,
      mp.access_scope
    FROM users u
    LEFT JOIN membership_plans mp ON mp.id = u.membership_plan_id
    WHERE u.id = $1
      AND (u.home_club_id = $2 OR $2 IS NULL)
      AND LOWER(COALESCE(u.role, 'member')) NOT IN (${ADMIN_STAFF_ROLE_FILTER})
    LIMIT 1
    `,
    [memberId, legacyBranchId]
  );

  return result.rows[0] || null;
}

async function loadMemberAlerts(memberId) {
  const alertsRes = await pool.query(
    `
    SELECT
      id,
      club_id,
      type,
      message,
      severity,
      status,
      created_at
    FROM member_alerts
    WHERE member_user_id = $1
      AND status = 'open'
    ORDER BY created_at DESC
    `,
    [memberId]
  );

  return alertsRes.rows;
}

router.get("/context", (req, res) => {
  return res.status(200).json({
    admin: req.admin,
  });
});

router.post("/staff", requirePermission("staff.manage"), async (req, res) => {
  const client = await pool.connect();

  try {
    const { name, email, employee_id, password, role_key, club_ids } = req.body || {};
    const cleanName = String(name || "").trim();
    const cleanEmail = String(email || "").trim().toLowerCase();
    const cleanEmployeeId = String(employee_id || "").trim().toLowerCase() || null;
    const cleanRoleKey = String(role_key || "").trim().toLowerCase();
    const clubIds = Array.isArray(club_ids) ? club_ids.map((c) => Number(c)) : [];

    if (!cleanName || !cleanEmail || !cleanRoleKey || clubIds.length === 0) {
      return res.status(400).json({
        message: "name, email, role_key, and at least one club_id are required",
      });
    }

    await client.query("BEGIN");

    const roleRes = await client.query(
      `SELECT id FROM roles WHERE key = $1 LIMIT 1`,
      [cleanRoleKey]
    );
    if (roleRes.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(400).json({ message: "Invalid role_key" });
    }
    const roleId = roleRes.rows[0].id;

    const clubsRes = await client.query(
      `
      SELECT id, franchise_id FROM clubs
      WHERE id = ANY($1::bigint[])
      `,
      [clubIds]
    );

    if (clubsRes.rows.length !== clubIds.length) {
      await client.query("ROLLBACK");
      return res.status(400).json({ message: "One or more clubs not found" });
    }

    const franchiseId = req.admin.franchise_id || clubsRes.rows[0].franchise_id;
    if (clubsRes.rows.some((c) => Number(c.franchise_id) !== Number(franchiseId))) {
      await client.query("ROLLBACK");
      return res.status(403).json({ message: "All clubs must belong to your franchise" });
    }

    const existingEmail = await client.query(
      `SELECT 1 FROM admin_users WHERE LOWER(email) = $1 LIMIT 1`,
      [cleanEmail]
    );
    if (existingEmail.rows.length > 0) {
      await client.query("ROLLBACK");
      return res.status(409).json({ message: "Email already in use" });
    }

    if (cleanEmployeeId) {
      const existingEmp = await client.query(
        `SELECT 1 FROM admin_users WHERE LOWER(employee_id) = $1 LIMIT 1`,
        [cleanEmployeeId]
      );
      if (existingEmp.rows.length > 0) {
        await client.query("ROLLBACK");
        return res.status(409).json({ message: "Employee ID already in use" });
      }
    }

    const passwordToUse = password || crypto.randomBytes(8).toString("hex");
    const hashed = await bcrypt.hash(passwordToUse, 12);

    const adminInsert = await client.query(
      `
      INSERT INTO admin_users (
        franchise_id,
        name,
        email,
        employee_id,
        password_hash,
        is_active,
        is_super_admin
      )
      VALUES ($1, $2, $3, $4, $5, TRUE, FALSE)
      RETURNING id, name, email, employee_id
      `,
      [franchiseId, cleanName, cleanEmail, cleanEmployeeId, hashed]
    );

    const adminUserId = adminInsert.rows[0].id;

    for (let i = 0; i < clubIds.length; i += 1) {
      await client.query(
        `
        INSERT INTO user_club_access (admin_user_id, club_id, role_id, is_primary)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (admin_user_id, club_id) DO UPDATE
        SET role_id = EXCLUDED.role_id, is_primary = EXCLUDED.is_primary
        `,
        [adminUserId, clubIds[i], roleId, i === 0]
      );
    }

    await client.query("COMMIT");

    await logStaffAction({
      adminUserId: req.admin.id,
      clubId: clubIds[0],
      action: "staff.create",
      targetType: "admin_user",
      targetId: String(adminUserId),
      metadata: { role_key: cleanRoleKey, club_ids: clubIds },
    });

    return res.status(201).json({
      message: "Staff account created",
      staff: {
        id: adminUserId,
        name: cleanName,
        email: cleanEmail,
        employee_id: cleanEmployeeId,
        temp_password: password ? undefined : passwordToUse,
        role_key: cleanRoleKey,
        club_ids: clubIds,
      },
    });
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch (_) {}
    return handlePlatformError(res, error, "Unable to create staff account");
  } finally {
    client.release();
  }
});

router.get("/clubs", requirePermission("club.read"), (req, res) => {
  return res.status(200).json({
    clubs: req.admin.clubs,
  });
});

router.get(
  "/clubs/:clubId/summary",
  requirePermission("club.read"),
  requireClubAccess(),
  async (req, res) => {
    try {
      const clubId = Number(getClubId(req.adminClub));
      const rawLegacyBranchId = getLegacyBranchId(req.adminClub);
      const legacyBranchId =
        rawLegacyBranchId === null || rawLegacyBranchId === undefined
          ? null
          : Number(rawLegacyBranchId);

      const [memberCountRes, checkinsRes, classRes] = await Promise.all([
        pool.query(
          `
          SELECT
            COUNT(*)::int AS total_members,
            COUNT(*) FILTER (WHERE membership_status = 'active')::int AS active_members
          FROM users
          WHERE home_club_id = $1
            AND LOWER(COALESCE(role, 'member')) NOT IN (${ADMIN_STAFF_ROLE_FILTER})
          `,
          [legacyBranchId]
        ),
        pool.query(
          `
          SELECT COUNT(*)::int AS today_checkins
          FROM checkin_logs
          WHERE (COALESCE(club_id, -1) = $1 OR branch_id = $2)
            AND checkin_time >= CURRENT_DATE
            AND checkin_time < CURRENT_DATE + INTERVAL '1 day'
          `,
          [clubId, legacyBranchId]
        ),
        pool.query(
          `
          SELECT COUNT(*)::int AS scheduled_classes
          FROM class_sessions
          WHERE club_id = $1
            AND scheduled_at >= NOW()
          `,
          [clubId]
        ),
      ]);

      return res.status(200).json({
        club: req.adminClub,
        summary: {
          total_members: memberCountRes.rows[0]?.total_members || 0,
          active_members: memberCountRes.rows[0]?.active_members || 0,
          today_checkins: checkinsRes.rows[0]?.today_checkins || 0,
          scheduled_classes: classRes.rows[0]?.scheduled_classes || 0,
        },
      });
    } catch (error) {
      return handlePlatformError(res, error, "Unable to load club summary");
    }
  }
);

router.get(
  "/clubs/:clubId/members",
  requirePermission("member.read"),
  requireClubAccess(),
  async (req, res) => {
    try {
      const rawLegacyBranchId = getLegacyBranchId(req.adminClub);
      const legacyBranchId =
        rawLegacyBranchId === null || rawLegacyBranchId === undefined
          ? null
          : Number(rawLegacyBranchId);

      if (!Number.isInteger(legacyBranchId)) {
        return res.status(400).json({
          message: "This club is not linked to an operational branch yet",
        });
      }

      const search = String(req.query.q || "").trim().toLowerCase();
      const params = [legacyBranchId];
      let searchClause = "";

      if (search) {
        params.push(`%${search}%`);
        searchClause = `
          AND (
            LOWER(COALESCE(u.name, '')) LIKE $2
            OR LOWER(COALESCE(u.email, '')) LIKE $2
            OR LOWER(COALESCE(u.phone_number, '')) LIKE $2
            OR LOWER(COALESCE(u.membership_code, '')) LIKE $2
          )
        `;
      }

      const result = await pool.query(
        `
        SELECT
          u.id,
          u.name,
          u.email,
          u.phone_number,
          u.membership_status,
          u.membership_code,
          u.membership_expiry,
          mp.name AS membership_plan_name
        FROM users u
        LEFT JOIN membership_plans mp ON mp.id = u.membership_plan_id
        WHERE u.home_club_id = $1
          AND LOWER(COALESCE(u.role, 'member')) NOT IN (${ADMIN_STAFF_ROLE_FILTER})
          ${searchClause}
        ORDER BY u.name ASC NULLS LAST
        LIMIT 100
        `,
        params
      );

      return res.status(200).json({
        club: req.adminClub,
        members: result.rows,
      });
    } catch (error) {
      return handlePlatformError(res, error, "Unable to load club members");
    }
  }
);

router.get(
  "/clubs/:clubId/members/:memberId",
  requirePermission("member.read"),
  requireClubAccess(),
  async (req, res) => {
    try {
      const rawLegacyBranchId = getLegacyBranchId(req.adminClub);
      const legacyBranchId =
        rawLegacyBranchId === null || rawLegacyBranchId === undefined
          ? null
          : Number(rawLegacyBranchId);

      const memberId = Number(req.params.memberId);
      const member = await fetchMemberWithProfile({ memberId, legacyBranchId });

      if (!member) {
        return res.status(404).json({ message: "Member not found in this club" });
      }

      const [alerts, recentCheckins, notes] = await Promise.all([
        loadMemberAlerts(memberId),
        pool.query(
          `
          SELECT id, checkin_time
          FROM checkin_logs
          WHERE user_id = $1
          ORDER BY checkin_time DESC
          LIMIT 20
          `,
          [memberId]
        ),
        pool.query(
          `
          SELECT
            mn.id,
            mn.note,
            mn.created_at,
            au.name AS author_name
          FROM member_notes mn
          LEFT JOIN admin_users au ON au.id = mn.author_admin_user_id
          WHERE mn.member_user_id = $1
          ORDER BY mn.created_at DESC
          LIMIT 20
          `,
          [memberId]
        ),
      ]);

      return res.status(200).json({
        club: req.adminClub,
        member,
        alerts,
        recent_checkins: recentCheckins.rows,
        notes: notes.rows,
      });
    } catch (error) {
      return handlePlatformError(res, error, "Unable to load member profile");
    }
  }
);

router.put(
  "/clubs/:clubId/members/:memberId",
  requirePermission("member.update"),
  requireClubAccess(),
  async (req, res) => {
    try {
      const rawLegacyBranchId = getLegacyBranchId(req.adminClub);
      const legacyBranchId =
        rawLegacyBranchId === null || rawLegacyBranchId === undefined
          ? null
          : Number(rawLegacyBranchId);
      const memberId = Number(req.params.memberId);

      const member = await fetchMemberWithProfile({ memberId, legacyBranchId });
      if (!member) {
        return res.status(404).json({ message: "Member not found in this club" });
      }

      const { name, phone_number, membership_status, membership_expiry } = req.body || {};
      const updates = [];
      const params = [];

      if (name) {
        params.push(String(name).trim());
        updates.push(`name = $${params.length}`);
      }

      if (phone_number) {
        params.push(String(phone_number).trim());
        updates.push(`phone_number = $${params.length}`);
      }

      if (membership_status) {
        const allowed = new Set(["active", "frozen", "canceled", "inactive"]);
        if (!allowed.has(membership_status)) {
          return res.status(400).json({ message: "Invalid membership_status" });
        }
        params.push(membership_status);
        updates.push(`membership_status = $${params.length}`);
      }

      if (membership_expiry) {
        params.push(membership_expiry);
        updates.push(`membership_expiry = $${params.length}`);
      }

      if (updates.length === 0) {
        return res.status(400).json({ message: "No updatable fields provided" });
      }

      params.push(memberId);
      await pool.query(
        `
        UPDATE users
        SET ${updates.join(", ")}, updated_at = NOW()
        WHERE id = $${params.length}
          AND LOWER(COALESCE(role, 'member')) NOT IN (${ADMIN_STAFF_ROLE_FILTER})
        `,
        params
      );

      await logStaffAction({
        adminUserId: req.admin.id,
        clubId: getClubId(req.adminClub),
        action: "member.update",
        targetType: "member",
        targetId: String(memberId),
        metadata: { fields: updates },
      });

      return res.status(200).json({ message: "Member updated" });
    } catch (error) {
      return handlePlatformError(res, error, "Unable to update member");
    }
  }
);

router.post(
  "/clubs/:clubId/members/:memberId/notes",
  requirePermission("member.update"),
  requireClubAccess(),
  async (req, res) => {
    try {
      const memberId = Number(req.params.memberId);
      const { note } = req.body || {};
      if (!note || !String(note).trim()) {
        return res.status(400).json({ message: "note is required" });
      }

      const insertRes = await pool.query(
        `
        INSERT INTO member_notes (club_id, member_user_id, author_admin_user_id, note)
        VALUES ($1, $2, $3, $4)
        RETURNING id, created_at
        `,
        [getClubId(req.adminClub), memberId, req.admin.id, String(note).trim()]
      );

      await logStaffAction({
        adminUserId: req.admin.id,
        clubId: getClubId(req.adminClub),
        action: "member.note.create",
        targetType: "member",
        targetId: String(memberId),
      });

      return res.status(201).json({
        message: "Note added",
        note: insertRes.rows[0],
      });
    } catch (error) {
      return handlePlatformError(res, error, "Unable to add note");
    }
  }
);

router.post(
  "/clubs/:clubId/members/:memberId/alerts",
  requirePermission("member.update"),
  requireClubAccess(),
  async (req, res) => {
    try {
      const memberId = Number(req.params.memberId);
      const { type, message, severity = "info" } = req.body || {};

      if (!type || !message) {
        return res.status(400).json({ message: "type and message are required" });
      }

      const insertRes = await pool.query(
        `
        INSERT INTO member_alerts (member_user_id, club_id, type, message, severity)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id, created_at
        `,
        [memberId, getClubId(req.adminClub), String(type).trim(), String(message).trim(), severity]
      );

      await logStaffAction({
        adminUserId: req.admin.id,
        clubId: getClubId(req.adminClub),
        action: "member.alert.create",
        targetType: "member",
        targetId: String(memberId),
        metadata: { type, severity },
      });

      return res.status(201).json({
        message: "Alert created",
        alert: insertRes.rows[0],
      });
    } catch (error) {
      return handlePlatformError(res, error, "Unable to create alert");
    }
  }
);

router.post(
  "/clubs/:clubId/members/:memberId/payments/manual",
  requirePermission("billing.refund"),
  requireClubAccess(),
  async (req, res) => {
    try {
      const memberId = Number(req.params.memberId);
      const { amount_cents, currency = "usd", method = "cash", note } = req.body || {};

      if (!amount_cents || Number(amount_cents) <= 0) {
        return res.status(400).json({ message: "amount_cents must be greater than zero" });
      }

      const insertRes = await pool.query(
        `
        INSERT INTO manual_payments (
          member_user_id,
          club_id,
          admin_user_id,
          amount_cents,
          currency,
          method,
          note
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING id, created_at
        `,
        [
          memberId,
          getClubId(req.adminClub),
          req.admin.id,
          Math.round(Number(amount_cents)),
          String(currency || "usd").toLowerCase(),
          String(method || "cash"),
          note || null,
        ]
      );

      await logStaffAction({
        adminUserId: req.admin.id,
        clubId: getClubId(req.adminClub),
        action: "billing.manual_payment",
        targetType: "member",
        targetId: String(memberId),
        metadata: { amount_cents: Number(amount_cents), currency, method },
      });

      return res.status(201).json({
        message: "Payment recorded",
        payment: insertRes.rows[0],
      });
    } catch (error) {
      return handlePlatformError(res, error, "Unable to record payment");
    }
  }
);

router.get(
  "/clubs/:clubId/checkins",
  requirePermission("report.view"),
  requireClubAccess(),
  async (req, res) => {
    try {
      const clubId = Number(getClubId(req.adminClub));
      const rawLegacyBranchId = getLegacyBranchId(req.adminClub);
      const legacyBranchId =
        rawLegacyBranchId === null || rawLegacyBranchId === undefined
          ? null
          : Number(rawLegacyBranchId);

      const result = await pool.query(
        `
        SELECT
          cl.id,
          cl.checkin_time,
          u.id AS member_id,
          u.name AS member_name,
          u.membership_code
        FROM checkin_logs cl
        INNER JOIN users u ON u.id = cl.user_id
        WHERE COALESCE(cl.club_id, -1) = $1
           OR cl.branch_id = $2
        ORDER BY cl.checkin_time DESC
        LIMIT 100
        `,
        [clubId, legacyBranchId]
      );

      return res.status(200).json({
        club: req.adminClub,
        checkins: result.rows,
      });
    } catch (error) {
      return handlePlatformError(res, error, "Unable to load club check-ins");
    }
  }
);

router.post(
  "/clubs/:clubId/checkins/verify",
  requirePermission("checkin.verify"),
  requireClubAccess(),
  async (req, res) => {
    try {
      const clubId = Number(getClubId(req.adminClub));
      const rawLegacyBranchId = getLegacyBranchId(req.adminClub);
      const legacyBranchId =
        rawLegacyBranchId === null || rawLegacyBranchId === undefined
          ? null
          : Number(rawLegacyBranchId);
      const { token, membership_code } = req.body || {};

      if (!Number.isInteger(legacyBranchId)) {
        return res.status(400).json({
          message: "This club is not linked to an operational branch yet",
        });
      }

      let resolvedMembershipCode = null;

      if (token) {
        const secret = process.env.QR_SECRET || process.env.JWT_SECRET;
        if (!secret) {
          return res.status(500).json({ message: "QR_SECRET or JWT_SECRET is required" });
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

        const nowWindow = Math.floor(Math.floor(Date.now() / 1000) / 30);
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
        resolvedMembershipCode = String(membership_code || "").trim();
      }

      if (!resolvedMembershipCode) {
        return res.status(400).json({ message: "token or membership_code is required" });
      }

      const userRes = await pool.query(
        `
        SELECT
          id,
          name,
          email,
          phone_number,
          membership_status,
          membership_plan_id,
          home_club_id,
          membership_expiry,
          photo_url
        FROM users
        WHERE membership_code = $1
          AND LOWER(COALESCE(role, 'member')) NOT IN (${ADMIN_STAFF_ROLE_FILTER})
        LIMIT 1
        `,
        [resolvedMembershipCode]
      );

      if (userRes.rows.length === 0) {
        return res.status(404).json({ message: "Invalid membership code" });
      }

      const member = userRes.rows[0];

      let accessScope = resolveMembershipScope(member.membership_plan_id);
      if (!accessScope) {
        const planRes = await pool.query(
          `SELECT access_scope FROM membership_plans WHERE id = $1 LIMIT 1`,
          [member.membership_plan_id]
        );
        accessScope = planRes.rows[0]?.access_scope || "ALL_CLUBS";
      }

      if (accessScope === "HOME_ONLY" && Number(member.home_club_id) !== legacyBranchId) {
        return res.status(403).json({
          message: "Access denied: this member can only check in at their home club",
          allowed_branch_id: member.home_club_id,
        });
      }

      const alerts = await loadMemberAlerts(member.id);
      const nowDate = new Date().toISOString().slice(0, 10);
      const expiry = member.membership_expiry;
      const isExpired = expiry && expiry < nowDate;

      if (isExpired) {
        alerts.push({
          type: "expired_membership",
          severity: "warn",
          status: "open",
          message: "Membership expired",
        });
      }

      if (member.membership_status !== "active") {
        return res.status(403).json({
          message: "Membership inactive",
          member: {
            id: member.id,
            name: member.name,
            membership_status: member.membership_status,
            membership_expiry: member.membership_expiry,
            photo_url: member.photo_url,
          },
          alerts,
          club: req.adminClub,
        });
      }

      const alreadyCheckedIn = await pool.query(
        `
        SELECT id, checkin_time
        FROM checkin_logs
        WHERE user_id = $1
          AND checkin_time::date = CURRENT_DATE
          AND (COALESCE(club_id, -1) = $2 OR branch_id = $3)
        ORDER BY checkin_time DESC
        LIMIT 1
        `,
        [member.id, clubId, legacyBranchId]
      );

      if (alreadyCheckedIn.rows.length > 0) {
        return res.status(200).json({
          message: "Already checked in today",
          member: {
            id: member.id,
            name: member.name,
            email: member.email,
            phone_number: member.phone_number,
            membership_status: member.membership_status,
            membership_expiry: member.membership_expiry,
            photo_url: member.photo_url,
          },
          checkin: alreadyCheckedIn.rows[0],
          alerts,
          club: req.adminClub,
        });
      }

      const insertRes = await pool.query(
        `
        INSERT INTO checkin_logs (user_id, branch_id, club_id)
        VALUES ($1, $2, $3)
        RETURNING id, checkin_time
        `,
        [member.id, legacyBranchId, clubId]
      );

      await logStaffAction({
        adminUserId: req.admin.id,
        clubId,
        action: "checkin.verify",
        targetType: "member",
        targetId: String(member.id),
        metadata: { membership_code: resolvedMembershipCode },
      });

      return res.status(200).json({
        message: "Check-in successful",
        member: {
          id: member.id,
          name: member.name,
          email: member.email,
          phone_number: member.phone_number,
          membership_status: member.membership_status,
          membership_expiry: member.membership_expiry,
          photo_url: member.photo_url,
        },
        alerts,
        checkin: insertRes.rows[0],
        club: req.adminClub,
      });
    } catch (error) {
      return handlePlatformError(res, error, "Unable to verify club check-in");
    }
  }
);

router.get(
  "/clubs/:clubId/classes",
  requirePermission("class.manage"),
  requireClubAccess(),
  async (req, res) => {
    try {
      const clubId = Number(getClubId(req.adminClub));
      const result = await pool.query(
        `
        SELECT
          cs.id,
          cs.class_type_id,
          ct.name AS class_name,
          cs.trainer_id,
          t.name AS trainer_name,
          cs.scheduled_at,
          cs.duration_minutes,
          cs.location,
          cs.capacity,
          (
            SELECT COUNT(*)
            FROM class_bookings cb
            WHERE cb.class_session_id = cs.id
          )::int AS booked_count
        FROM class_sessions cs
        INNER JOIN class_types ct ON ct.id = cs.class_type_id
        LEFT JOIN trainers t ON t.id = cs.trainer_id
        WHERE cs.club_id = $1
        ORDER BY cs.scheduled_at DESC
        `,
        [clubId]
      );

      return res.status(200).json({
        club: req.adminClub,
        sessions: result.rows.map((row) => ({
          ...row,
          spots_left: Number(row.capacity) - Number(row.booked_count || 0),
        })),
      });
    } catch (error) {
      return handlePlatformError(res, error, "Unable to load club classes");
    }
  }
);

router.post(
  "/clubs/:clubId/classes",
  requirePermission("class.manage"),
  requireClubAccess(),
  async (req, res) => {
    try {
      const clubId = Number(getClubId(req.adminClub));
      const {
        class_type_id,
        trainer_id,
        scheduled_at,
        duration_minutes,
        location,
        capacity,
      } = req.body || {};

      if (!class_type_id || !scheduled_at || !duration_minutes || !location || !capacity) {
        return res.status(400).json({ message: "Missing required class fields" });
      }

      const scheduledAt = new Date(scheduled_at);
      if (Number.isNaN(scheduledAt.getTime()) || scheduledAt <= new Date()) {
        return res.status(400).json({ message: "scheduled_at must be a future datetime" });
      }

      const result = await pool.query(
        `
        INSERT INTO class_sessions (
          class_type_id,
          trainer_id,
          scheduled_at,
          duration_minutes,
          location,
          capacity,
          club_id
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING *
        `,
        [
          class_type_id,
          trainer_id || null,
          scheduled_at,
          duration_minutes,
          location,
          capacity,
          clubId,
        ]
      );

      return res.status(201).json({
        message: "Class created",
        session: result.rows[0],
      });
    } catch (error) {
      return handlePlatformError(res, error, "Unable to create class session");
    }
  }
);

module.exports = router;
