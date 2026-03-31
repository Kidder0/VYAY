const express = require("express");
const router = express.Router();
const bwipjs = require("bwip-js");
const crypto = require("crypto");
const pool = require("../db");
const authenticateToken = require("../middleware/authMiddleware");

console.log("Checkin routes loaded");

async function resolveMembershipPlanName(membershipPlanId) {
  if (!membershipPlanId) return null;

  const raw = String(membershipPlanId).trim();
  const lower = raw.toLowerCase();

  // Stripe / stored keys
  if (lower === "basic") return "Build";
  if (lower === "pro") return "Dominate";

  // Direct readable values
  if (lower === "build") return "Build";
  if (lower === "dominate") return "Dominate";

  // Fallback: lookup in membership_plans table by id or text
  try {
    const planLookup = await pool.query(
      `
      SELECT name
      FROM membership_plans
      WHERE id::text = $1
         OR LOWER(name) = LOWER($1)
      LIMIT 1
      `,
      [raw]
    );

    if (planLookup.rows.length > 0) {
      return planLookup.rows[0].name;
    }
  } catch (err) {
    console.error("resolveMembershipPlanName lookup error:", err);
  }

  return null;
}

// GET /api/checkin/code
router.get("/code", authenticateToken, async (req, res) => {
  const userId = req.user.userId;

  try {
    const result = await pool.query(
      `
      SELECT
        membership_code,
        membership_status,
        membership_expiry,
        membership_plan_id
      FROM users
      WHERE id = $1
      LIMIT 1
      `,
      [userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "User not found" });
    }

    const {
      membership_code,
      membership_status,
      membership_expiry,
      membership_plan_id,
    } = result.rows[0];

    const membership_plan_name = await resolveMembershipPlanName(membership_plan_id);

    const now = new Date();
    const expiry = membership_expiry ? new Date(membership_expiry) : null;

    if (membership_status !== "active" || !expiry || expiry < now) {
      const plansResult = await pool.query(
        `
        SELECT id, name, price
        FROM membership_plans
        WHERE is_active = true
        ORDER BY price ASC
        `
      );

      const plans = plansResult.rows.map((p) => ({
        id: p.id,
        name: p.name,
        price: Number(p.price),
        period: "month",
        duration_days: 30,
        features: [],
        access_scope: "ALL_CLUBS",
      }));

      return res.status(200).json({
        show_plans: true,
        membership_status: membership_status || "inactive",
        membership_expiry,
        membership_plan_name,
        message: "No active membership. Please choose a plan to enable check-in.",
        plans,
      });
    }

    if (!membership_code) {
      return res.status(200).json({
        show_plans: false,
        membership_status,
        membership_expiry,
        membership_plan_name,
        membership_code: null,
        barcode: null,
        message: "Membership active but membership_code missing. Please contact support.",
      });
    }

    const barcodeBuffer = await bwipjs.toBuffer({
      bcid: "code128",
      text: membership_code,
      scale: 3,
      height: 10,
      includetext: true,
      textxalign: "center",
    });

    return res.status(200).json({
      show_plans: false,
      membership_status,
      membership_expiry,
      membership_plan_name,
      membership_code,
      barcode: `data:image/png;base64,${barcodeBuffer.toString("base64")}`,
    });
  } catch (err) {
    console.error("Check-in code error:", err);
    return res.status(500).json({ message: "Server error" });
  }
});

// GET /api/checkin/qr-token
router.get("/qr-token", authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;

    const result = await pool.query(
      `
      SELECT
        membership_code,
        membership_status,
        membership_expiry,
        membership_plan_id
      FROM users
      WHERE id = $1
      LIMIT 1
      `,
      [userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "User not found" });
    }

    const {
      membership_code,
      membership_status,
      membership_expiry,
      membership_plan_id,
    } = result.rows[0];

    const membership_plan_name = await resolveMembershipPlanName(membership_plan_id);

    const now = new Date();
    const expiry = membership_expiry ? new Date(membership_expiry) : null;

    if (membership_status !== "active" || !expiry || expiry < now) {
      return res.status(403).json({ message: "No active membership" });
    }

    if (!membership_code) {
      return res.status(403).json({ message: "Membership code missing" });
    }

    const windowSeconds = 30;
    const nowSec = Math.floor(Date.now() / 1000);
    const window = Math.floor(nowSec / windowSeconds);

    const secret = process.env.QR_SECRET || process.env.JWT_SECRET;
    if (!secret) {
      return res.status(500).json({
        message: "Missing QR_SECRET or JWT_SECRET in .env",
      });
    }

    const payload = `${membership_code}.${window}`;
    const signature = crypto
      .createHmac("sha256", secret)
      .update(payload)
      .digest("hex");

    const token = `${membership_code}.${window}.${signature}`;

    return res.status(200).json({
      token,
      expires_in_seconds: windowSeconds - (nowSec % windowSeconds),
      membership_expiry,
      membership_plan_name,
    });
  } catch (err) {
    console.error("qr-token error:", err);
    return res.status(500).json({ message: "Server error" });
  }
});

// GET /api/checkin/history
router.get("/history", authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;

    const result = await pool.query(
      `
      SELECT
        cl.checkin_time,
        cl.branch_id,
        b.name AS branch_name
      FROM checkin_logs cl
      LEFT JOIN branches b ON b.id = cl.branch_id
      WHERE cl.user_id = $1
      ORDER BY cl.checkin_time DESC
      LIMIT 30
      `,
      [userId]
    );

    return res.status(200).json({ checkins: result.rows });
  } catch (err) {
    console.error("checkin history error:", err);
    return res.status(500).json({ message: "Server error" });
  }
});

// POST /api/checkin/verify
router.post("/verify", async (req, res) => {
  try {
    const { token, membership_code, branch_id } = req.body;

    if (!branch_id) {
      return res.status(400).json({ message: "branch_id is required" });
    }

    let resolvedMembershipCode = null;

    if (token) {
      const secret = process.env.QR_SECRET || process.env.JWT_SECRET;
      if (!secret) {
        return res.status(500).json({
          message: "Missing QR_SECRET or JWT_SECRET in .env",
        });
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
        return res.status(400).json({
          message: "token or membership_code is required",
        });
      }
      resolvedMembershipCode = String(membership_code).trim();
    }

    const branchRes = await pool.query(
      `SELECT id, name FROM branches WHERE id = $1 LIMIT 1`,
      [branch_id]
    );

    if (branchRes.rows.length === 0) {
      return res.status(404).json({ message: "Invalid branch_id" });
    }

    const branch = branchRes.rows[0];

    const userResult = await pool.query(
      `
      SELECT
        id,
        name,
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

    if (user.membership_status !== "active") {
      return res.status(403).json({ message: "Membership inactive" });
    }

    let accessScope = "ALL_CLUBS";

    if (user.membership_plan_id) {
      const normalized = String(user.membership_plan_id).toLowerCase();

      if (normalized === "basic") {
        accessScope = "HOME_ONLY";
      } else if (normalized === "pro") {
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
        return res.status(403).json({
          message: "Home club not set for this member",
        });
      }

      if (Number(branch_id) !== Number(user.home_club_id)) {
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
      const prev = alreadyCheckedIn.rows[0];

      const prevBranchRes = await pool.query(
        `SELECT id, name FROM branches WHERE id = $1 LIMIT 1`,
        [prev.branch_id]
      );

      return res.status(200).json({
        message: "Already checked in today",
        user: { id: user.id, name: user.name },
        checkin_time: prev.checkin_time,
        branch: prevBranchRes.rows[0] || null,
      });
    }

    const logResult = await pool.query(
      `
      INSERT INTO checkin_logs (user_id, branch_id)
      VALUES ($1, $2)
      RETURNING checkin_time
      `,
      [user.id, branch_id]
    );

    return res.status(200).json({
      message: "Check-in successful",
      user: { id: user.id, name: user.name },
      checkin_time: logResult.rows[0].checkin_time,
      branch: { id: branch.id, name: branch.name },
    });
  } catch (err) {
    console.error("Verify check-in error:", err);
    return res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;