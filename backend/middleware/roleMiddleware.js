function requireRole(...allowedRoles) {
  return (req, res, next) => {
    const role = req.user?.role;

    if (!role) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    if (!allowedRoles.includes(role)) {
      return res.status(403).json({ message: 'Forbidden: insufficient role' });
    }

    next();
  };
}

const requireAdmin = requireRole('admin');

module.exports = { requireRole, requireAdmin };