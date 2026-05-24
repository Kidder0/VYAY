const {
  getAdminContext,
  getAdminSchemaErrorMessage,
  getClubById,
  isAdminSchemaMissingError,
  resolveAdminClub,
} = require("../routes/services/adminTenant");

function extractRequestedClubId(req) {
  return (
    req.params?.clubId ||
    req.body?.club_id ||
    req.query?.club_id ||
    null
  );
}

async function loadAdminContext(req, res, next) {
  try {
    const adminUserId = req.adminAuth?.adminUserId;
    req.admin = await getAdminContext(adminUserId);
    next();
  } catch (error) {
    console.error("loadAdminContext error:", error);

    if (isAdminSchemaMissingError(error)) {
      return res.status(500).json({ message: getAdminSchemaErrorMessage() });
    }

    return res.status(403).json({ message: error.message || "Unable to load admin context" });
  }
}

function requirePermission(permissionKey) {
  return (req, res, next) => {
    const admin = req.admin;

    if (!admin) {
      return res.status(401).json({ message: "Admin context missing" });
    }

    if (admin.is_super_admin || admin.permissions.includes(permissionKey)) {
      return next();
    }

    return res.status(403).json({
      message: `Missing permission: ${permissionKey}`,
    });
  };
}

function requireClubAccess() {
  return async (req, res, next) => {
    try {
      const requestedClubId = Number(extractRequestedClubId(req));

      if (!Number.isInteger(requestedClubId)) {
        return res.status(400).json({ message: "clubId is required" });
      }

      const admin = req.admin;

      if (!admin) {
        return res.status(401).json({ message: "Admin context missing" });
      }

      if (admin.is_super_admin) {
        const club = await getClubById(requestedClubId);
        if (!club) {
          return res.status(404).json({ message: "Club not found" });
        }

        req.adminClub = club;
        return next();
      }

      const scopedClub = resolveAdminClub(admin, requestedClubId);

      if (!scopedClub) {
        return res.status(403).json({ message: "You do not have access to this club" });
      }

      req.adminClub = scopedClub;
      return next();
    } catch (error) {
      console.error("requireClubAccess error:", error);

      if (isAdminSchemaMissingError(error)) {
        return res.status(500).json({ message: getAdminSchemaErrorMessage() });
      }

      return res.status(500).json({ message: error.message || "Unable to validate club access" });
    }
  };
}

module.exports = {
  loadAdminContext,
  requireClubAccess,
  requirePermission,
};
