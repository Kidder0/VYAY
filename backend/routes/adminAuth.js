const express = require("express");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const pool = require("../db");
const {
  authenticateAdmin,
  handleAdminSchemaError,
} = require("../middleware/adminAuthMiddleware");
const { loadAdminContext } = require("../middleware/adminAccessMiddleware");
const {
  getAdminContext,
  getAdminJwtSecret,
} = require("./services/adminTenant");

const router = express.Router();

router.post("/bootstrap", async (req, res) => {
  try {
    const bootstrapSecret = String(req.body?.bootstrap_secret || "");
    const requiredSecret = String(process.env.ADMIN_BOOTSTRAP_SECRET || "");
    const { name, email, password } = req.body || {};
    const cleanName = String(name || "").trim();
    const cleanEmail = String(email || "").trim().toLowerCase();

    if (!requiredSecret) {
      return res.status(500).json({ message: "ADMIN_BOOTSTRAP_SECRET is not configured" });
    }

    if (!bootstrapSecret || bootstrapSecret !== requiredSecret) {
      return res.status(403).json({ message: "Invalid bootstrap secret" });
    }

    if (!cleanName || !cleanEmail || !password) {
      return res.status(400).json({ message: "name, email, and password are required" });
    }

    const countRes = await pool.query(`SELECT COUNT(*)::int AS admin_count FROM admin_users`);
    if (Number(countRes.rows[0]?.admin_count || 0) > 0) {
      return res.status(403).json({ message: "Bootstrap is only available before the first admin user exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 12);
    const defaultFranchiseRes = await pool.query(
      `SELECT id FROM franchises ORDER BY id ASC LIMIT 1`
    );

    const createdRes = await pool.query(
      `
      INSERT INTO admin_users (
        franchise_id,
        name,
        email,
        password_hash,
        is_active,
        is_super_admin
      )
      VALUES ($1, $2, $3, $4, TRUE, TRUE)
      RETURNING id, franchise_id, name, email, is_super_admin
      `,
      [
        defaultFranchiseRes.rows[0]?.id || null,
        cleanName,
        cleanEmail,
        hashedPassword,
      ]
    );

    return res.status(201).json({
      message: "Initial super admin created",
      admin: createdRes.rows[0],
    });
  } catch (error) {
    console.error("admin-auth bootstrap error:", error);
    const schemaResponse = handleAdminSchemaError(res, error);
    if (schemaResponse) return schemaResponse;
    return res.status(500).json({ message: error.message || "Unable to bootstrap admin user" });
  }
});

router.post("/login", async (req, res) => {
  try {
    const { email, employee_id, password } = req.body || {};
    const identifier = String(email || employee_id || "").trim().toLowerCase();

    if (!identifier || !password) {
      return res.status(400).json({ message: "email/employee_id and password are required" });
    }

    const adminRes = await pool.query(
      `
      SELECT
        id,
        franchise_id,
        name,
        email,
        employee_id,
        password_hash,
        is_active,
        is_super_admin
      FROM admin_users
      WHERE LOWER(email) = $1
         OR LOWER(employee_id) = $1
      LIMIT 1
      `,
      [identifier]
    );

    if (adminRes.rows.length === 0) {
      return res.status(401).json({ message: "Invalid admin credentials" });
    }

    const adminUser = adminRes.rows[0];

    if (!adminUser.is_active) {
      return res.status(403).json({ message: "Admin account is disabled" });
    }

    const isValidPassword = await bcrypt.compare(password, adminUser.password_hash);
    if (!isValidPassword) {
      return res.status(401).json({ message: "Invalid admin credentials" });
    }

    await pool.query(`UPDATE admin_users SET last_login_at = NOW() WHERE id = $1`, [adminUser.id]);

    const secret = getAdminJwtSecret();
    if (!secret) {
      return res.status(500).json({ message: "ADMIN_JWT_SECRET or JWT_SECRET is required" });
    }

    const token = jwt.sign(
      {
        kind: "admin",
        adminUserId: adminUser.id,
        franchiseId: adminUser.franchise_id,
        isSuperAdmin: adminUser.is_super_admin,
      },
      secret,
      { expiresIn: "12h" }
    );

    const context = await getAdminContext(adminUser.id);

    return res.status(200).json({
      message: "Admin login successful",
      token,
      admin: {
        id: context.id,
        franchise_id: context.franchise_id,
        franchise_name: context.franchise_name,
        name: context.name,
        email: context.email,
        employee_id: context.employee_id,
        is_super_admin: context.is_super_admin,
        clubs: context.clubs,
        permissions: context.permissions,
      },
    });
  } catch (error) {
    console.error("admin-auth login error:", error);
    const schemaResponse = handleAdminSchemaError(res, error);
    if (schemaResponse) return schemaResponse;
    return res.status(500).json({ message: error.message || "Unable to login admin user" });
  }
});

router.get("/me", authenticateAdmin, loadAdminContext, async (req, res) => {
  return res.status(200).json({
    admin: {
      id: req.admin.id,
      franchise_id: req.admin.franchise_id,
      franchise_name: req.admin.franchise_name,
      name: req.admin.name,
      email: req.admin.email,
      employee_id: req.admin.employee_id,
      is_super_admin: req.admin.is_super_admin,
      last_login_at: req.admin.last_login_at,
      clubs: req.admin.clubs,
      permissions: req.admin.permissions,
    },
  });
});

module.exports = router;
