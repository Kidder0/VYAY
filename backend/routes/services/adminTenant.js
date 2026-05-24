const pool = require("../../db");

const ADMIN_STAFF_ROLE_FILTER =
  "'staff','front_desk','manager','admin','owner','franchise_owner','franchise'";

function getAdminJwtSecret() {
  return process.env.ADMIN_JWT_SECRET || process.env.JWT_SECRET;
}

function isAdminSchemaMissingError(error) {
  return error?.code === "42P01" || error?.code === "42703";
}

function getAdminSchemaErrorMessage() {
  return "Admin tenant schema is missing or outdated. Run backend/sql/admin_multitenant_phase1.sql first.";
}

async function getAdminContext(adminUserId) {
  const adminRes = await pool.query(
    `
    SELECT
      au.id,
      au.franchise_id,
      au.name,
      au.email,
      au.employee_id,
      au.is_active,
      au.is_super_admin,
      au.last_login_at,
      f.name AS franchise_name
    FROM admin_users au
    LEFT JOIN franchises f ON f.id = au.franchise_id
    WHERE au.id = $1
    LIMIT 1
    `,
    [adminUserId]
  );

  if (adminRes.rows.length === 0) {
    throw new Error("Admin user not found");
  }

  const admin = adminRes.rows[0];

  if (!admin.is_active) {
    throw new Error("Admin account disabled");
  }

  const [clubsRes, permissionsRes, clubPermissionsRes] = await Promise.all([
    pool.query(
      `
      SELECT
        uca.club_id,
        uca.is_primary,
        c.name AS club_name,
        c.location,
        c.legacy_branch_id,
        c.franchise_id,
        r.id AS role_id,
        r.key AS role_key,
        r.name AS role_name
      FROM user_club_access uca
      INNER JOIN clubs c ON c.id = uca.club_id
      INNER JOIN roles r ON r.id = uca.role_id
      WHERE uca.admin_user_id = $1
        AND c.is_active = TRUE
      ORDER BY uca.is_primary DESC, c.name ASC
      `,
      [adminUserId]
    ),
    pool.query(
      `
      SELECT DISTINCT p.key
      FROM user_club_access uca
      INNER JOIN role_permissions rp ON rp.role_id = uca.role_id
      INNER JOIN permissions p ON p.id = rp.permission_id
      WHERE uca.admin_user_id = $1
      ORDER BY p.key ASC
      `,
      [adminUserId]
    ),
    pool.query(
      `
      SELECT DISTINCT
        uca.club_id,
        p.key
      FROM user_club_access uca
      INNER JOIN role_permissions rp ON rp.role_id = uca.role_id
      INNER JOIN permissions p ON p.id = rp.permission_id
      WHERE uca.admin_user_id = $1
      ORDER BY uca.club_id ASC, p.key ASC
      `,
      [adminUserId]
    ),
  ]);

  const permissions = permissionsRes.rows.map((row) => row.key);
  const clubPermissions = {};

  clubPermissionsRes.rows.forEach((row) => {
    const clubId = String(row.club_id);
    if (!clubPermissions[clubId]) {
      clubPermissions[clubId] = [];
    }
    clubPermissions[clubId].push(row.key);
  });

  return {
    id: admin.id,
    franchise_id: admin.franchise_id,
    franchise_name: admin.franchise_name,
    name: admin.name,
    email: admin.email,
    employee_id: admin.employee_id,
    is_active: admin.is_active,
    is_super_admin: admin.is_super_admin,
    last_login_at: admin.last_login_at,
    clubs: clubsRes.rows.map((club) => ({
      ...club,
      permissions: clubPermissions[String(club.club_id)] || [],
    })),
    permissions,
    club_permissions: clubPermissions,
  };
}

async function getClubById(clubId) {
  const result = await pool.query(
    `
    SELECT
      id,
      franchise_id,
      legacy_branch_id,
      name,
      location,
      is_active
    FROM clubs
    WHERE id = $1
    LIMIT 1
    `,
    [clubId]
  );

  return result.rows[0] || null;
}

function resolveAdminClub(context, clubId) {
  if (!context || !Array.isArray(context.clubs)) {
    return null;
  }

  return context.clubs.find((club) => Number(club.club_id) === Number(clubId)) || null;
}

module.exports = {
  ADMIN_STAFF_ROLE_FILTER,
  getAdminContext,
  getAdminJwtSecret,
  getAdminSchemaErrorMessage,
  getClubById,
  isAdminSchemaMissingError,
  resolveAdminClub,
};
