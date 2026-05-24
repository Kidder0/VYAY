const jwt = require("jsonwebtoken");
const {
  getAdminJwtSecret,
  getAdminSchemaErrorMessage,
  isAdminSchemaMissingError,
} = require("../routes/services/adminTenant");

function authenticateAdmin(req, res, next) {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    return res.status(401).json({ message: "Admin access token missing" });
  }

  try {
    const secret = getAdminJwtSecret();

    if (!secret) {
      return res.status(500).json({ message: "ADMIN_JWT_SECRET or JWT_SECRET is required" });
    }

    const decoded = jwt.verify(token, secret);

    if (decoded?.kind !== "admin" || !decoded?.adminUserId) {
      return res.status(403).json({ message: "Invalid admin token" });
    }

    req.adminAuth = decoded;
    next();
  } catch (error) {
    console.error("Admin JWT error:", error);
    return res.status(403).json({ message: "Invalid or expired admin token" });
  }
}

function handleAdminSchemaError(res, error) {
  if (isAdminSchemaMissingError(error)) {
    return res.status(500).json({ message: getAdminSchemaErrorMessage() });
  }

  return null;
}

module.exports = {
  authenticateAdmin,
  handleAdminSchemaError,
};
