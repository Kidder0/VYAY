const express = require("express");
const router = express.Router();
const pool = require("../db");
const authenticateToken = require("../middleware/authMiddleware");



router.get("/public", async (req, res) => {
  try {
    const result = await pool.query(`SELECT id, name FROM branches ORDER BY name ASC`);
    return res.status(200).json({ branches: result.rows });
  } catch (err) {
    console.error("branches/public error:", err);
    return res.status(500).json({ message: "Server error" });
  }
});
// ✅ GET /api/branches (filtered by plan)
router.get("/", authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;

    const userRes = await pool.query(
      `SELECT membership_status, membership_plan_id, home_club_id
       FROM users
       WHERE id = $1
       LIMIT 1`,
      [userId]
    );

    const user = userRes.rows[0];
    if (!user) return res.status(404).json({ message: "User not found" });

    // If not active, still show all branches (or you can restrict, your choice)
    if (user.membership_status !== "active" || !user.membership_plan_id) {
      const all = await pool.query(`SELECT * FROM branches ORDER BY name ASC`);
      return res.status(200).json({ branches: all.rows });
    }

    const planRes = await pool.query(
      `SELECT access_scope
       FROM membership_plans
       WHERE id = $1
       LIMIT 1`,
      [user.membership_plan_id]
    );

    const accessScope = planRes.rows[0]?.access_scope || "HOME_ONLY";

    if (accessScope === "ALL_CLUBS") {
      const all = await pool.query(`SELECT * FROM branches ORDER BY name ASC`);
      return res.status(200).json({ branches: all.rows });
    }

    // HOME_ONLY
    if (!user.home_club_id) {
      const all = await pool.query(`SELECT * FROM branches ORDER BY name ASC`);
      return res.status(200).json({
        branches: all.rows,
        warning: "Home club not set. Please set your home club.",
      });
    }

    const home = await pool.query(
      `SELECT * FROM branches WHERE id = $1 LIMIT 1`,
      [user.home_club_id]
    );

    return res.status(200).json({ branches: home.rows });
  } catch (err) {
    console.error("branches error:", err);
    return res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;