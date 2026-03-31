const express = require("express");
const authenticateToken = require("../middleware/authMiddleware");
const pool = require("../db");

const router = express.Router();

const MAX_HISTORY_MESSAGES = 20;

function sanitizeMessages(messages) {
  if (!Array.isArray(messages)) return [];

  return messages
    .filter(
      (item) =>
        item &&
        (item.role === "user" || item.role === "assistant") &&
        typeof item.text === "string" &&
        item.text.trim()
    )
    .slice(-MAX_HISTORY_MESSAGES)
    .map((item) => ({
      role: item.role,
      content: item.text.trim(),
    }));
}

function includesAny(text, words) {
  return words.some((word) => text.includes(word));
}

async function getAssistantContext(userId) {
  const [profileRes, membershipRes, branchRes, historyRes, plansRes] = await Promise.all([
    pool.query(
      `
      SELECT id, name, email, language, country_region, home_club_id
      FROM users
      WHERE id = $1
      LIMIT 1
      `,
      [userId]
    ),
    pool.query(
      `
      SELECT
        u.membership_status,
        u.membership_expiry,
        u.membership_code,
        u.membership_plan_id,
        mp.name AS membership_plan_name,
        mp.access_scope
      FROM users u
      LEFT JOIN membership_plans mp ON mp.id::text = u.membership_plan_id::text
      WHERE u.id = $1
      LIMIT 1
      `,
      [userId]
    ),
    pool.query(
      `
      SELECT id, name, city, state
      FROM branches
      ORDER BY name ASC
      `,
      []
    ),
    pool.query(
      `
      SELECT cl.checkin_time, b.name AS branch_name
      FROM checkin_logs cl
      LEFT JOIN branches b ON b.id = cl.branch_id
      WHERE cl.user_id = $1
      ORDER BY cl.checkin_time DESC
      LIMIT 5
      `,
      [userId]
    ),
    pool.query(
      `
      SELECT id, name, price, access_scope
      FROM membership_plans
      WHERE is_active = true
      ORDER BY price ASC
      `,
      []
    ),
  ]);

  return {
    profile: profileRes.rows[0] || null,
    membership: membershipRes.rows[0] || null,
    branches: branchRes.rows || [],
    recentCheckins: historyRes.rows || [],
    plans: plansRes.rows || [],
  };
}

function buildLocalReply(message, context) {
  const input = String(message || "").trim().toLowerCase();
  const { profile, membership, branches, recentCheckins, plans } = context;

  const planSummary = plans
    .map((plan) => `${plan.name} ($${Number(plan.price || 0).toFixed(2)})`)
    .join(", ");

  if (includesAny(input, ["hello", "hi", "hey"])) {
    return `Hi${profile?.name ? ` ${profile.name}` : ""}. I can help with your membership, barcode check-in, branches, recent visits, payments, and gym guidance.`;
  }

  if (includesAny(input, ["membership", "plan", "price", "pricing", "dominate", "build"])) {
    const currentPlan = membership?.membership_plan_name || membership?.membership_plan_id || "none";
    const status = membership?.membership_status || "inactive";
    const expiry = membership?.membership_expiry
      ? new Date(membership.membership_expiry).toLocaleDateString()
      : "not set";

    return `Your current membership status is ${status}. Current plan: ${currentPlan}. Expiry: ${expiry}. Available plans in VYAY right now: ${planSummary || "no active plans found"}.`;
  }

  if (includesAny(input, ["barcode", "check-in", "checkin", "scan", "membership code"])) {
    if (membership?.membership_status !== "active") {
      return "Your membership is not active right now, so the barcode will stay locked until you buy or renew a plan.";
    }

    if (!membership?.membership_code) {
      return "Your membership looks active, but your membership code is missing. Open Check-in and refresh, and if it still does not appear, support should investigate the account.";
    }

    return `Your membership is active and your code is ${membership.membership_code}. Open the Check-in screen and show the barcode at the front desk or scanner.`;
  }

  if (includesAny(input, ["branch", "club", "location", "gym near"])) {
    const homeClub =
      branches.find((branch) => Number(branch.id) === Number(profile?.home_club_id)) || null;
    const branchPreview = branches
      .slice(0, 5)
      .map((branch) => `${branch.name}${branch.city ? ` (${branch.city})` : ""}`)
      .join(", ");

    if (membership?.access_scope === "HOME_ONLY" && homeClub) {
      return `Your current plan looks limited to your home club. Your home club is ${homeClub.name}. Available branch list: ${branchPreview}.`;
    }

    return `You currently have access information for these clubs: ${branchPreview || "no branches found"}.`;
  }

  if (includesAny(input, ["history", "visited", "recent check", "recent visit"])) {
    if (!recentCheckins.length) {
      return "You do not have any recent check-in history yet.";
    }

    const items = recentCheckins
      .map((entry) => {
        const dateText = entry.checkin_time
          ? new Date(entry.checkin_time).toLocaleString()
          : "unknown time";
        return `${entry.branch_name || "Unknown branch"} on ${dateText}`;
      })
      .join("; ");

    return `Your recent check-ins: ${items}.`;
  }

  if (includesAny(input, ["payment", "paid", "stripe", "purchase", "buy"])) {
    if (membership?.membership_status === "active") {
      return "Your membership already looks active. If you just paid and the barcode was delayed, opening Check-in and refreshing once is usually enough after sync finishes.";
    }

    return `If you complete payment successfully, return to the app and open Check-in. The app should sync your membership and unlock barcode access. Available plans: ${planSummary || "no active plans found"}.`;
  }

  if (includesAny(input, ["password", "email", "otp", "settings", "language", "country"])) {
    return "For account updates, use Account and Settings. You can change email with OTP verification, update password from Settings, and update language or country from the Settings screen.";
  }

  if (includesAny(input, ["workout", "exercise", "training", "beginner plan", "gym plan"])) {
    return "A simple beginner plan is 3 days per week: push, pull, and legs. Focus on technique first, then add weight gradually. If you want, I can also suggest a fat-loss or muscle-gain version.";
  }

  if (includesAny(input, ["diet", "food", "meal", "protein", "nutrition"])) {
    return "Keep nutrition simple: aim for enough protein, enough water, and regular meals. Use carbs around training for energy and protein after training for recovery.";
  }

  return `I can help with your VYAY plan, barcode check-in, branches, recent visits, payments, workouts, and account support. Right now your membership status is ${membership?.membership_status || "inactive"} and your current plan is ${membership?.membership_plan_name || membership?.membership_plan_id || "not set"}.`;
}

router.post("/chat", authenticateToken, async (req, res) => {
  const userId = req.user?.userId || "unknown";
  const messages = sanitizeMessages(req.body?.messages);

  const latestUserMessage = [...messages].reverse().find((item) => item.role === "user");

  if (!latestUserMessage) {
    return res.status(400).json({ message: "A user message is required." });
  }

  try {
    const context = await getAssistantContext(userId);
    return res.json({
      reply: buildLocalReply(latestUserMessage.content, context),
      source: "local",
    });
  } catch (error) {
    console.error("MawaB chat error:", error?.message || error);
    return res.status(500).json({
      message: "MawaB is unavailable right now. Please try again in a moment.",
    });
  }
});

module.exports = router;
