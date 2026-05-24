const pool = require("../../db");

async function logStaffAction({
  adminUserId,
  clubId = null,
  action,
  targetType = null,
  targetId = null,
  metadata = {},
}) {
  if (!action) return;

  try {
    await pool.query(
      `
      INSERT INTO staff_logs (
        club_id,
        admin_user_id,
        action_key,
        target_type,
        target_id,
        metadata
      )
      VALUES ($1, $2, $3, $4, $5, $6)
      `,
      [clubId, adminUserId || null, action, targetType, targetId, metadata]
    );
  } catch (error) {
    // Avoid breaking the main flow on logging issues
    console.log("staff log failed:", error?.message || error);
  }
}

module.exports = {
  logStaffAction,
};
