const ROLE_ALIASES = {
  user: "member",
  member: "member",
  staff: "front_desk",
  frontdesk: "front_desk",
  front_desk: "front_desk",
  manager: "manager",
  admin: "owner",
  owner: "owner",
  franchise: "owner",
  franchise_owner: "owner",
};

const ROLE_LEVELS = {
  member: 0,
  front_desk: 1,
  manager: 2,
  owner: 3,
};

const ROLE_LABELS = {
  member: "Member",
  front_desk: "Front Desk",
  manager: "Manager",
  owner: "Owner",
};

function normalizeRole(role) {
  const value = String(role || "").trim().toLowerCase();
  return ROLE_ALIASES[value] || "member";
}

function getRoleLevel(role) {
  return ROLE_LEVELS[normalizeRole(role)] ?? ROLE_LEVELS.member;
}

function getRoleLabel(role) {
  return ROLE_LABELS[normalizeRole(role)] || ROLE_LABELS.member;
}

function hasMinimumRole(role, minimumRole) {
  return getRoleLevel(role) >= getRoleLevel(minimumRole);
}

function getRolePermissions(role) {
  const normalizedRole = normalizeRole(role);
  const isFrontDesk = hasMinimumRole(normalizedRole, "front_desk");
  const isManager = hasMinimumRole(normalizedRole, "manager");
  const isOwner = hasMinimumRole(normalizedRole, "owner");

  return {
    role: normalizedRole,
    role_label: getRoleLabel(normalizedRole),
    can_access_admin_center: isFrontDesk,
    can_scan_members: isFrontDesk,
    can_view_member_lookup: isFrontDesk,
    can_edit_member_basic: isFrontDesk,
    can_manage_membership: isManager,
    can_billing_and_payments: isManager,
    can_view_reporting: isManager,
    can_manage_club_operations: isManager,
    can_manage_staff_accounts: isManager,
    can_assign_manager_role: isOwner,
    can_assign_owner_role: isOwner,
    can_multi_location_control: isOwner,
  };
}

function requireRole(...allowedRoles) {
  const normalizedAllowed = allowedRoles.map((role) => normalizeRole(role));

  return (req, res, next) => {
    const role = normalizeRole(req.user?.role);

    if (!req.user?.userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    if (!normalizedAllowed.includes(role)) {
      return res.status(403).json({ message: "Forbidden: insufficient role" });
    }

    req.user.role = role;
    next();
  };
}

function requireMinimumRole(minimumRole) {
  return (req, res, next) => {
    const role = normalizeRole(req.user?.role);

    if (!req.user?.userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    if (!hasMinimumRole(role, minimumRole)) {
      return res.status(403).json({ message: "Forbidden: insufficient role" });
    }

    req.user.role = role;
    next();
  };
}

const requireAdmin = requireMinimumRole("manager");

module.exports = {
  getRoleLabel,
  getRoleLevel,
  getRolePermissions,
  hasMinimumRole,
  normalizeRole,
  requireAdmin,
  requireMinimumRole,
  requireRole,
};
