const express = require("express");
const router = express.Router();
const stripe = require("../stripeClient");
const pool = require("../db");
const authenticateToken = require("../middleware/authMiddleware");

// ✅ POST /api/billing/create-checkout-session
router.post("/create-checkout-session", authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { planId } = req.body;

    if (!planId) return res.status(400).json({ message: "planId is required" });

    // Get plan -> must have stripe_price_id
    const planRes = await pool.query(
      `SELECT id, name, price, stripe_price_id
       FROM membership_plans
       WHERE id = $1 AND is_active = true
       LIMIT 1`,
      [planId]
    );

    if (planRes.rows.length === 0) {
      return res.status(404).json({ message: "Plan not found or inactive" });
    }

    const plan = planRes.rows[0];
    if (!plan.stripe_price_id) {
      return res.status(400).json({
        message:
          "This plan is missing stripe_price_id in DB. Add it to membership_plans to use Stripe subscriptions.",
      });
    }

    // Find or create stripe customer
    const userRes = await pool.query(
      `SELECT id, email, name, stripe_customer_id
       FROM users
       WHERE id = $1
       LIMIT 1`,
      [userId]
    );

    const user = userRes.rows[0];
    if (!user) return res.status(404).json({ message: "User not found" });

    let customerId = user.stripe_customer_id;

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        name: user.name,
        metadata: { userId: String(userId) },
      });
      customerId = customer.id;

      await pool.query(`UPDATE users SET stripe_customer_id = $1 WHERE id = $2`, [
        customerId,
        userId,
      ]);
    }

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      line_items: [{ price: plan.stripe_price_id, quantity: 1 }],
      success_url: process.env.FRONTEND_SUCCESS_URL,
      cancel_url: process.env.FRONTEND_CANCEL_URL,
      metadata: {
        planId: String(planId),
        userId: String(userId),
      },
      subscription_data: {
        metadata: {
          planId: String(planId),
          userId: String(userId),
        },
      },
    });

    return res.status(200).json({ url: session.url });
  } catch (err) {
    console.error("create-checkout-session error:", err);
    return res.status(500).json({ message: "Server error" });
  }
});

// ✅ GET /api/billing/status  (UPDATED)
router.get("/status", authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;

    // Return BOTH: membership info (DB) + subscription info (Stripe)
    const userRes = await pool.query(
      `SELECT 
         u.stripe_subscription_id,
         u.subscription_status,
         u.membership_status,
         u.membership_expiry,
         u.membership_plan_id,
         mp.name AS membership_plan_name
       FROM users u
       LEFT JOIN membership_plans mp ON mp.id = u.membership_plan_id
       WHERE u.id = $1
       LIMIT 1`,
      [userId]
    );

    const user = userRes.rows[0];
    if (!user) return res.status(404).json({ message: "User not found" });

    // If no stripe subscription yet, still return membership data
    if (!user.stripe_subscription_id) {
      return res.status(200).json({
        has_subscription: false,
        subscription_status: user.subscription_status || "none",
        cancel_at_period_end: false,
        current_period_end: null,

        membership_status: user.membership_status || "inactive",
        membership_expiry: user.membership_expiry || null,
        membership_plan_id: user.membership_plan_id || null,
        membership_plan_name: user.membership_plan_name || null,
      });
    }

    // Has subscription -> fetch latest status from Stripe
    const subscription = await stripe.subscriptions.retrieve(user.stripe_subscription_id);

    return res.status(200).json({
      has_subscription: true,
      subscription_status: subscription.status,
      cancel_at_period_end: !!subscription.cancel_at_period_end,
      current_period_end: subscription.current_period_end
        ? new Date(subscription.current_period_end * 1000)
        : null,

      membership_status: user.membership_status || "inactive",
      membership_expiry: user.membership_expiry || null,
      membership_plan_id: user.membership_plan_id || null,
      membership_plan_name: user.membership_plan_name || null,
    });
  } catch (err) {
    console.error("billing status error:", err);
    return res.status(500).json({ message: "Server error" });
  }
});

// ✅ POST /api/billing/cancel
router.post("/cancel", authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;

    const userRes = await pool.query(
      `SELECT stripe_subscription_id
       FROM users
       WHERE id = $1
       LIMIT 1`,
      [userId]
    );

    const subId = userRes.rows[0]?.stripe_subscription_id;
    if (!subId) return res.status(400).json({ message: "No active subscription found" });

    const updated = await stripe.subscriptions.update(subId, { cancel_at_period_end: true });

    return res.status(200).json({
      message: "Cancellation scheduled",
      current_period_end: updated.current_period_end
        ? new Date(updated.current_period_end * 1000)
        : null,
    });
  } catch (err) {
    console.error("cancel error:", err);
    return res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;