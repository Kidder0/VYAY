const jwt = require('jsonwebtoken');

function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];

  // Expect: Authorization: Bearer <token>
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ message: 'Access token missing' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; // { userId: ... }
    next();
  } catch (err) {
    console.error('JWT Error:', err);
    res.status(403).json({ message: 'Invalid or expired token' });
  }
}

module.exports = authenticateToken;
