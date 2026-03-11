// auth.js (FULL UPDATED FILE with Reset Password OTP + Reset Password routes)

const express = require("express");
const router = express.Router();

const pool = require("../db");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const authenticateToken = require("../middleware/authMiddleware");
const { assertNotDisposableEmail } = require("./services/emailGuard");
const { normalizeToE164 } = require("./services/phoneGuard");

const nodemailer = require("nodemailer");
const crypto = require("crypto");

// Utility: Strong password validator
function isStrongPassword(password) {
  const strongRegex =
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
  return strongRegex.test(password);
}

// OTP helpers
function generateOtp() {
  return String(100000 + Math.floor(Math.random() * 900000)); // 6-digit
}
function hashOtp(otp) {
  return crypto.createHash("sha256").update(otp).digest("hex");
}

// SMTP transporter (uses .env)
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT || 587),
  secure: false,
  auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
});

// ✅ REGISTER ROUTE
router.post("/register", async (req, res) => {
  const { name, email, phone_number, password } = req.body;

  try {
    if (!name || !email || !phone_number || !password) {
      return res
        .status(400)
        .json({ message: "name, email, phone_number, password are required" });
    }

    const cleanEmail = String(email).trim().toLowerCase();

    // Block disposable emails
    await assertNotDisposableEmail(pool, cleanEmail);

    // Normalize phone
    const phoneE164 = normalizeToE164(phone_number, "US"); // change to 'IN' if needed

    // Strong password
    if (!isStrongPassword(password)) {
      return res.status(400).json({
        message:
          "Password must be at least 8 characters long and include uppercase, lowercase, number, and special character.",
      });
    }

    // Unique check (case/space safe)
    const existingUser = await pool.query(
      "SELECT 1 FROM users WHERE LOWER(email) = $1 OR phone_number = $2 LIMIT 1",
      [cleanEmail, phoneE164]
    );

    if (existingUser.rows.length > 0) {
      return res
        .status(400)
        .json({ message: "Email or phone number already in use" });
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    // Create user in PENDING_EMAIL until verified
    const newUser = await pool.query(
      `INSERT INTO users (name, email, phone_number, password_hash, email_verified, status)
       VALUES ($1, $2, $3, $4, FALSE, 'PENDING_EMAIL')
       RETURNING id, name, email, phone_number, email_verified, status`,
      [name, cleanEmail, phoneE164, hashedPassword]
    );

    res.status(201).json({ user: newUser.rows[0] });
  } catch (err) {
    console.error("Registration error:", err);
    res.status(400).json({ message: err.message || "Registration failed" });
  }
});

// ✅ SEND EMAIL OTP
router.post("/send-email-otp", async (req, res) => {
  const { email } = req.body;

  try {
    const cleanEmail = String(email).trim().toLowerCase();

    const userRes = await pool.query(
      "SELECT id, email_verified FROM users WHERE LOWER(email) = $1",
      [cleanEmail]
    );

    if (userRes.rows.length === 0)
      return res.status(404).json({ message: "User not found" });

    if (userRes.rows[0].email_verified)
      return res.status(400).json({ message: "Email already verified" });

    const userId = userRes.rows[0].id;

    // ✅ COOLDOWN CHECK (MUST BE BEFORE INSERT)
    const lastOtpRes = await pool.query(
      `SELECT created_at
       FROM email_otps
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT 1`,
      [userId]
    );

    // ✅ expire previous OTPs so old OTP shows "OTP expired"
    await pool.query(
      `UPDATE email_otps
       SET expires_at = NOW()
       WHERE user_id = $1 AND used_at IS NULL AND expires_at > NOW()`,
      [userId]
    );

    if (lastOtpRes.rows.length > 0) {
      const last = new Date(lastOtpRes.rows[0].created_at);
      const diffSeconds = (Date.now() - last.getTime()) / 1000;

      if (diffSeconds < 60) {
        const wait = Math.ceil(60 - diffSeconds);
        return res.status(429).json({
          message: `Please wait ${wait} seconds before requesting another OTP.`,
        });
      }
    }

    // ✅ NOW generate OTP (only if allowed)
    const otp = generateOtp();
    const otpHash = hashOtp(otp);

    await pool.query(
      `INSERT INTO email_otps (user_id, otp_hash, expires_at)
       VALUES ($1, $2, NOW() + INTERVAL '10 minutes')`,
      [userId, otpHash]
    );

    await transporter.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to: cleanEmail,
      subject: "Your GymPro verification code",
      text: `Your OTP is: ${otp}. It expires in 10 minutes.`,
    });

    res.status(200).json({ message: "OTP sent to email" });
  } catch (err) {
    console.error("send-email-otp error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// ✅ VERIFY EMAIL OTP
router.post("/verify-email-otp", async (req, res) => {
  const { email, otp } = req.body;

  try {
    if (!email || !otp)
      return res.status(400).json({ message: "email and otp are required" });

    const cleanEmail = String(email).trim().toLowerCase();

    const userRes = await pool.query(
      "SELECT id, email_verified FROM users WHERE LOWER(email) = $1",
      [cleanEmail]
    );

    if (userRes.rows.length === 0)
      return res.status(404).json({ message: "User not found" });

    if (userRes.rows[0].email_verified)
      return res.status(400).json({ message: "Email already verified" });

    const userId = userRes.rows[0].id;

    const otpRes = await pool.query(
      `SELECT * FROM email_otps
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT 1`,
      [userId]
    );

    if (otpRes.rows.length === 0)
      return res.status(400).json({ message: "OTP not found" });

    const row = otpRes.rows[0];

    if (row.attempts >= 5)
      return res.status(400).json({ message: "Too many attempts" });
    if (new Date(row.expires_at) < new Date())
      return res.status(400).json({ message: "OTP expired" });
    if (row.used_at)
      return res.status(400).json({ message: "OTP already used" });

    // increment attempts first (prevents brute-force)
    await pool.query("UPDATE email_otps SET attempts = attempts + 1 WHERE id = $1", [
      row.id,
    ]);

    const incomingHash = hashOtp(String(otp).trim());
    if (incomingHash !== row.otp_hash)
      return res.status(400).json({ message: "Invalid OTP" });

    await pool.query("UPDATE email_otps SET used_at = NOW() WHERE id = $1", [row.id]);
    await pool.query("UPDATE users SET email_verified = TRUE, status = 'ACTIVE' WHERE id = $1", [
      userId,
    ]);

    res.status(200).json({ message: "Email verified. Account activated." });
  } catch (err) {
    console.error("verify-email-otp error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

/* =========================================================
   ✅ RESET PASSWORD (FORGOT PASSWORD) - NEW
   Requires DB table: password_reset_otps (user_id INTEGER FK users.id)
   ========================================================= */

// ✅ SEND RESET PASSWORD OTP
router.post("/send-reset-otp", async (req, res) => {
  const { email } = req.body;

  try {
    if (!email) {
      return res.status(400).json({ message: "email is required" });
    }

    const cleanEmail = String(email).trim().toLowerCase();

    const userRes = await pool.query(
      "SELECT id FROM users WHERE LOWER(email) = $1 LIMIT 1",
      [cleanEmail]
    );

    // Security: do not reveal if user exists
    if (userRes.rows.length === 0) {
      return res.status(200).json({
        message: "If this email exists, OTP has been sent.",
      });
    }

    const userId = userRes.rows[0].id;

    // Cooldown: 60 seconds
    const lastOtpRes = await pool.query(
      `SELECT created_at
       FROM password_reset_otps
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT 1`,
      [userId]
    );

    if (lastOtpRes.rows.length > 0) {
      const last = new Date(lastOtpRes.rows[0].created_at);
      const diffSeconds = (Date.now() - last.getTime()) / 1000;
      if (diffSeconds < 60) {
        const wait = Math.ceil(60 - diffSeconds);
        return res.status(429).json({
          message: `Please wait ${wait} seconds before requesting another OTP.`,
        });
      }
    }

    // Expire any previous active OTPs
    await pool.query(
      `UPDATE password_reset_otps
       SET expires_at = NOW()
       WHERE user_id = $1
         AND used_at IS NULL
         AND expires_at > NOW()`,
      [userId]
    );

    const otp = generateOtp();
    const otpHash = hashOtp(otp);

    await pool.query(
      `INSERT INTO password_reset_otps (user_id, otp_hash, expires_at)
       VALUES ($1, $2, NOW() + INTERVAL '10 minutes')`,
      [userId, otpHash]
    );

    await transporter.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to: cleanEmail,
      subject: "GymPro Password Reset Code",
      text: `Your password reset OTP is: ${otp}. It expires in 10 minutes.`,
    });

    return res.status(200).json({
      message: "If this email exists, OTP has been sent.",
    });
  } catch (err) {
    console.error("send-reset-otp error:", err);
    return res.status(500).json({ message: "Server error" });
  }
});

// ✅ VERIFY RESET PASSWORD OTP (ONLY verifies OTP, does NOT change password)
router.post("/verify-reset-otp", async (req, res) => {
  const { email, otp } = req.body;

  try {
    if (!email || !otp) {
      return res.status(400).json({ message: "email and otp are required" });
    }

    const cleanEmail = String(email).trim().toLowerCase();

    const userRes = await pool.query(
      "SELECT id FROM users WHERE LOWER(email) = $1 LIMIT 1",
      [cleanEmail]
    );

    // do not reveal if user exists
    if (userRes.rows.length === 0) {
      return res.status(400).json({ message: "Invalid OTP or expired" });
    }

    const userId = userRes.rows[0].id;

    const otpRes = await pool.query(
      `SELECT *
       FROM password_reset_otps
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT 1`,
      [userId]
    );

    if (otpRes.rows.length === 0) {
      return res.status(400).json({ message: "Invalid OTP or expired" });
    }

    const row = otpRes.rows[0];

    if (row.attempts >= 5)
      return res.status(400).json({ message: "Too many attempts" });

    if (row.used_at)
      return res.status(400).json({ message: "OTP already used" });

    if (new Date(row.expires_at) < new Date())
      return res.status(400).json({ message: "Invalid OTP or expired" });

    // Increment attempts first
    await pool.query("UPDATE password_reset_otps SET attempts = attempts + 1 WHERE id = $1", [
      row.id,
    ]);

    const incomingHash = hashOtp(String(otp).trim());

    if (incomingHash !== row.otp_hash) {
      return res.status(400).json({ message: "Invalid OTP or expired" });
    }

    // ✅ OTP is valid (do NOT mark used here)
    return res.status(200).json({ message: "OTP verified" });
  } catch (err) {
    console.error("verify-reset-otp error:", err);
    return res.status(500).json({ message: "Server error" });
  }
});

// ✅ RESET PASSWORD (Verify OTP + Set New Password)
router.post("/reset-password", async (req, res) => {
  const { email, otp, new_password } = req.body;

  try {
    if (!email || !otp || !new_password) {
      return res.status(400).json({
        message: "email, otp, new_password are required",
      });
    }

    if (!isStrongPassword(new_password)) {
      return res.status(400).json({
        message:
          "Password must be at least 8 characters long and include uppercase, lowercase, number, and special character.",
      });
    }

    const cleanEmail = String(email).trim().toLowerCase();

    const userRes = await pool.query(
      "SELECT id FROM users WHERE LOWER(email) = $1 LIMIT 1",
      [cleanEmail]
    );

    if (userRes.rows.length === 0) {
      return res.status(400).json({ message: "Invalid OTP or expired" });
    }

    const userId = userRes.rows[0].id;

    const otpRes = await pool.query(
      `SELECT *
       FROM password_reset_otps
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT 1`,
      [userId]
    );

    if (otpRes.rows.length === 0) {
      return res.status(400).json({ message: "Invalid OTP or expired" });
    }

    const row = otpRes.rows[0];

    if (row.attempts >= 5)
      return res.status(400).json({ message: "Too many attempts" });

    if (row.used_at)
      return res.status(400).json({ message: "OTP already used" });

    if (new Date(row.expires_at) < new Date())
      return res.status(400).json({ message: "Invalid OTP or expired" });

    // Increment attempts first
    await pool.query("UPDATE password_reset_otps SET attempts = attempts + 1 WHERE id = $1", [
      row.id,
    ]);

    const incomingHash = hashOtp(String(otp).trim());

    if (incomingHash !== row.otp_hash) {
      return res.status(400).json({ message: "Invalid OTP or expired" });
    }

    // Mark OTP used
    await pool.query("UPDATE password_reset_otps SET used_at = NOW() WHERE id = $1", [row.id]);

    const hashedNew = await bcrypt.hash(new_password, 12);

    // Also unlock account if it was locked due to failed attempts
    await pool.query(
      `UPDATE users
       SET password_hash = $1,
           failed_login_attempts = 0,
           lock_until = NULL
       WHERE id = $2`,
      [hashedNew, userId]
    );

    return res.status(200).json({
      message: "Password reset successfully. You can login now.",
    });
  } catch (err) {
    console.error("reset-password error:", err);
    return res.status(500).json({ message: "Server error" });
  }
});

/* =========================================================
   END RESET PASSWORD
   ========================================================= */

// ✅ LOGIN ROUTE (with brute-force protection)
router.post("/login", async (req, res) => {
  const { email_or_phone, password } = req.body;

  try {
    if (!email_or_phone || !password) {
      return res.status(400).json({
        message: "email_or_phone and password are required",
      });
    }

    const input = String(email_or_phone).trim();
    const isEmail = input.includes("@");

    let userQuery;

    if (isEmail) {
      const cleanEmail = input.toLowerCase();

      userQuery = await pool.query(
        "SELECT * FROM users WHERE LOWER(email) = $1 LIMIT 1",
        [cleanEmail]
      );
    } else {
      // phone login: normalize to E.164
      let phoneE164;
      try {
        phoneE164 = normalizeToE164(input, "US"); // change to 'IN' if needed
      } catch (e) {
        return res.status(400).json({ message: "Invalid phone number format" });
      }

      userQuery = await pool.query("SELECT * FROM users WHERE phone_number = $1 LIMIT 1", [
        phoneE164,
      ]);
    }

    if (userQuery.rows.length === 0) {
      return res.status(400).json({ message: "User not found" });
    }

    const user = userQuery.rows[0];

    // ✅ Block login until verified
    if (!user.email_verified || user.status !== "ACTIVE") {
      return res.status(403).json({
        message: "Please verify your email before login.",
      });
    }

    // ✅ If locked, block login
    if (user.lock_until && new Date(user.lock_until) > new Date()) {
      const mins = Math.ceil((new Date(user.lock_until) - new Date()) / 60000);
      return res.status(429).json({
        message: `Account locked due to failed attempts. Try again in ${mins} minute(s).`,
      });
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);

    // ❌ Wrong password => increment attempts + lock if needed
    if (!isMatch) {
      const nextAttempts = (user.failed_login_attempts || 0) + 1;

      // lock after 5 attempts for 15 minutes
      if (nextAttempts >= 5) {
        await pool.query(
          `UPDATE users
           SET failed_login_attempts = $1,
               lock_until = NOW() + INTERVAL '15 minutes'
           WHERE id = $2`,
          [nextAttempts, user.id]
        );

        return res.status(429).json({
          message: "Too many failed login attempts. Account locked for 15 minutes.",
        });
      }

      await pool.query(
        "UPDATE users SET failed_login_attempts = $1, lock_until = NULL WHERE id = $2",
        [nextAttempts, user.id]
      );

      return res.status(401).json({ message: "Invalid credentials" });
    }

    // ✅ On success: reset attempts + unlock
    await pool.query("UPDATE users SET failed_login_attempts = 0, lock_until = NULL WHERE id = $1", [
      user.id,
    ]);

    const token = jwt.sign({ userId: user.id, role: user.role }, process.env.JWT_SECRET, {
      expiresIn: "7d",
    });

    res.status(200).json({
      message: "Login successful",
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone_number: user.phone_number,
      },
    });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// ✅ PROFILE ROUTE
router.get("/profile", authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;

    const result = await pool.query(
      `SELECT id, name, email, phone_number, language, country_region
       FROM users
       WHERE id = $1`,
      [userId]
    );

    if (result.rows.length === 0) return res.status(404).json({ message: "User not found" });

    res.status(200).json({ profile: result.rows[0] });
  } catch (err) {
    console.error("Profile fetch error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// ✅ PROFILE UPDATE ROUTE (name, phone ONLY)
router.put("/update-profile", authenticateToken, async (req, res) => {
  const userId = req.user.userId;
  const { name, phone_number } = req.body;

  try {
    const currentRes = await pool.query("SELECT id, phone_number, country_region FROM users WHERE id = $1", [
      userId,
    ]);

    if (currentRes.rows.length === 0) {
      return res.status(404).json({ message: "User not found" });
    }

    const current = currentRes.rows[0];

    const newName = name ? String(name).trim() : null;

    let newPhoneE164 = null;
    if (phone_number) {
      const region = (current.country_region || "US").toUpperCase();
      newPhoneE164 = normalizeToE164(phone_number, region);
    }

    if (newPhoneE164 && newPhoneE164 !== current.phone_number) {
      const existingPhone = await pool.query(
        "SELECT 1 FROM users WHERE phone_number = $1 AND id <> $2 LIMIT 1",
        [newPhoneE164, userId]
      );

      if (existingPhone.rows.length > 0) {
        return res.status(400).json({ message: "Phone number already in use" });
      }
    }

    const updated = await pool.query(
      `UPDATE users
       SET name = COALESCE($1, name),
           phone_number = COALESCE($2, phone_number)
       WHERE id = $3
       RETURNING id, name, email, phone_number, email_verified, status`,
      [newName, newPhoneE164, userId]
    );

    return res.status(200).json({
      message: "Profile updated",
      user: updated.rows[0],
    });
  } catch (err) {
    console.error("Profile update error:", err);
    return res.status(400).json({ message: err.message || "Server error" });
  }
});

// ✅ EMAIL CHANGE (OTP) - SAFE BODY HANDLING ADDED
router.post("/request-email-change", authenticateToken, async (req, res) => {
  const userId = req.user.userId;
  const { new_email } = req.body || {};

  try {
    if (!new_email) {
      return res.status(400).json({ message: "new_email is required" });
    }

    const cleanEmail = String(new_email).trim().toLowerCase();

    await assertNotDisposableEmail(pool, cleanEmail);

    const existing = await pool.query("SELECT 1 FROM users WHERE LOWER(email) = $1 AND id <> $2 LIMIT 1", [
      cleanEmail,
      userId,
    ]);
    if (existing.rows.length > 0) {
      return res.status(400).json({ message: "Email already in use" });
    }

    const lastRes = await pool.query(
      `SELECT created_at
       FROM email_change_otps
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT 1`,
      [userId]
    );

    await pool.query(
      `UPDATE email_change_otps
       SET expires_at = NOW()
       WHERE user_id = $1 AND used_at IS NULL AND expires_at > NOW()`,
      [userId]
    );

    if (lastRes.rows.length > 0) {
      const last = new Date(lastRes.rows[0].created_at);
      const diffSeconds = (Date.now() - last.getTime()) / 1000;
      if (diffSeconds < 60) {
        const wait = Math.ceil(60 - diffSeconds);
        return res.status(429).json({
          message: `Please wait ${wait} seconds before requesting another OTP.`,
        });
      }
    }

    const otp = generateOtp();
    const otpHash = hashOtp(otp);

    await pool.query(
      `INSERT INTO email_change_otps (user_id, new_email, otp_hash, expires_at)
       VALUES ($1, $2, $3, NOW() + INTERVAL '10 minutes')`,
      [userId, cleanEmail, otpHash]
    );

    await transporter.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to: cleanEmail,
      subject: "GymPro - Verify your new email",
      text: `Your OTP is: ${otp}. It expires in 10 minutes.`,
    });

    return res.status(200).json({ message: "OTP sent to new email" });
  } catch (err) {
    console.error("request-email-change error:", err);
    return res.status(400).json({ message: err.message || "Server error" });
  }
});

router.post("/confirm-email-change", authenticateToken, async (req, res) => {
  const userId = req.user.userId;
  const { new_email, otp } = req.body || {};

  try {
    if (!new_email || !otp) {
      return res.status(400).json({ message: "new_email and otp are required" });
    }

    const cleanEmail = String(new_email).trim().toLowerCase();

    const otpRes = await pool.query(
      `SELECT *
       FROM email_change_otps
       WHERE user_id = $1 AND new_email = $2
       ORDER BY created_at DESC
       LIMIT 1`,
      [userId, cleanEmail]
    );

    if (otpRes.rows.length === 0) return res.status(400).json({ message: "OTP not found" });

    const row = otpRes.rows[0];

    if (row.attempts >= 5) return res.status(400).json({ message: "Too many attempts" });
    if (new Date(row.expires_at) < new Date()) return res.status(400).json({ message: "OTP expired" });
    if (row.used_at) return res.status(400).json({ message: "OTP already used" });

    await pool.query("UPDATE email_change_otps SET attempts = attempts + 1 WHERE id = $1", [row.id]);

    const incomingHash = hashOtp(String(otp).trim());
    if (incomingHash !== row.otp_hash) return res.status(400).json({ message: "Invalid OTP" });

    const existsNow = await pool.query("SELECT 1 FROM users WHERE LOWER(email) = $1 AND id <> $2 LIMIT 1", [
      cleanEmail,
      userId,
    ]);
    if (existsNow.rows.length > 0) return res.status(400).json({ message: "Email already in use" });

    await pool.query("UPDATE email_change_otps SET used_at = NOW() WHERE id = $1", [row.id]);

    const updated = await pool.query(
      `UPDATE users
       SET email = $1,
           email_verified = TRUE,
           status = 'ACTIVE'
       WHERE id = $2
       RETURNING id, name, email, phone_number, email_verified, status`,
      [cleanEmail, userId]
    );

    return res.status(200).json({
      message: "Email updated successfully",
      user: updated.rows[0],
    });
  } catch (err) {
    console.error("confirm-email-change error:", err);
    return res.status(400).json({ message: err.message || "Server error" });
  }
});

// ✅ CHANGE PASSWORD ROUTE
router.put("/change-password", authenticateToken, async (req, res) => {
  const userId = req.user.userId;
  const { current_password, new_password } = req.body;

  try {
    if (!current_password || !new_password) {
      return res.status(400).json({ message: "current_password and new_password are required" });
    }

    if (!isStrongPassword(new_password)) {
      return res.status(400).json({
        message:
          "New password must be at least 8 characters long and include uppercase, lowercase, number, and special character.",
      });
    }

    const userRes = await pool.query("SELECT password_hash FROM users WHERE id = $1", [userId]);
    if (userRes.rows.length === 0) return res.status(404).json({ message: "User not found" });

    const isMatch = await bcrypt.compare(current_password, userRes.rows[0].password_hash);
    if (!isMatch) return res.status(401).json({ message: "Current password is incorrect" });

    const hashedNew = await bcrypt.hash(new_password, 12);
    await pool.query("UPDATE users SET password_hash = $1 WHERE id = $2", [hashedNew, userId]);

    res.status(200).json({ message: "Password changed successfully" });
  } catch (err) {
    console.error("Password change error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// ✅ GET USER SETTINGS
router.get("/settings", authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;

    const result = await pool.query("SELECT language, country_region FROM users WHERE id = $1", [userId]);

    if (result.rows.length === 0) return res.status(404).json({ message: "User not found" });

    return res.status(200).json(result.rows[0]);
  } catch (err) {
    console.error("Get settings error:", err);
    return res.status(500).json({ message: "Server error" });
  }
});

// ✅ UPDATE USER SETTINGS
router.put("/settings", authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { language, country_region } = req.body;

    const result = await pool.query(
      `UPDATE users
       SET language = COALESCE($1, language),
           country_region = COALESCE($2, country_region)
       WHERE id = $3
       RETURNING language, country_region`,
      [language || null, country_region || null, userId]
    );

    return res.status(200).json({
      message: "Settings updated",
      settings: result.rows[0],
    });
  } catch (err) {
    console.error("Update settings error:", err);
    return res.status(500).json({ message: "Server error" });
  }
});

// ✅ DELETE ACCOUNT (SOFT DELETE)
router.delete("/delete-account", authenticateToken, async (req, res) => {
  const userId = req.user.userId;

  try {
    const userRes = await pool.query(
      `SELECT id, email, stripe_subscription_id
       FROM users
       WHERE id = $1
       LIMIT 1`,
      [userId]
    );

    if (userRes.rows.length === 0) {
      return res.status(404).json({ message: "User not found" });
    }

    const user = userRes.rows[0];

    // Try cancel subscription if exists (won't block delete if Stripe fails)
    try {
      if (user.stripe_subscription_id) {
        const stripe = require("../stripeClient");

        if (stripe?.subscriptions?.del) {
          await stripe.subscriptions.del(user.stripe_subscription_id);
        } else if (stripe?.subscriptions?.cancel) {
          await stripe.subscriptions.cancel(user.stripe_subscription_id);
        } else if (stripe?.subscriptions?.delete) {
          await stripe.subscriptions.delete(user.stripe_subscription_id);
        } else {
          console.warn("Stripe cancel method not found on stripe client");
        }
      }
    } catch (e) {
      console.warn("Stripe cancel failed (continuing):", e?.message || e);
    }

    // Soft delete + anonymize unique email + anonymize phone (NOT NULL)
    const deletedEmail = `deleted_${userId}_${Date.now()}@deleted.local`;
    const dummyPhone = `+1999${String(userId).padStart(6, "0")}${String(Date.now()).slice(-4)}`;

    // password_hash is NOT NULL -> overwrite with a random hash
    const dummyPassword = crypto.randomBytes(32).toString("hex");
    const dummyPasswordHash = await bcrypt.hash(dummyPassword, 12);

    await pool.query(
      `UPDATE users
       SET status = 'DELETED',
           email_verified = FALSE,
           email = $1,
           phone_number = $2,
           password_hash = $3,
           stripe_customer_id = NULL,
           stripe_subscription_id = NULL
       WHERE id = $4`,
      [deletedEmail, dummyPhone, dummyPasswordHash, userId]
    );

    return res.status(200).json({ message: "Account deleted successfully" });
  } catch (err) {
    console.error("delete-account error:", err);
    return res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;