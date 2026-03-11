const express = require("express");
const router = express.Router();
const stripe = require("../stripeClient");
const pool = require("../db");

// helper: generate membership code
function generateMembershipCode(userId) {
  const rand = Math.floor(100000 + Math.random() * 900000);
  return `GMPRO-${userId}-${rand}`;
}

// ✅ Safe date conversion for Postgres DATE column
function safeUnixToDateOnly(unixSeconds) {
  const n = Number(unixSeconds);
  if (!n || Number.isNaN(n)) return null; // avoid Invalid Date / NaN
  return new Date(n * 1000).toISOString().slice(0, 10); // YYYY-MM-DD
}

/**
 * IMPORTANT:
 * - server.js already applies: express.raw({ type: "application/json" }) on /api/stripe/webhook
 * - so DO NOT put express.raw() here again
 */
router.post("/", async (req, res) => {
  const sig = req.headers["stripe-signature"];
  let event;

  try {
    event = stripe.webhooks.constructEvent(
      req.body, // raw Buffer from server.js
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error("❌ Webhook signature verification failed:", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    if (
      event.type === "checkout.session.completed" ||
      event.type === "customer.subscription.updated" ||
      event.type === "customer.subscription.created"
    ) {
      let subscriptionId = null;
      let customerId = null;
      let checkoutPlanId = null;

      if (event.type === "checkout.session.completed") {
        const session = event.data.object;
        subscriptionId = session.subscription;
        customerId = session.customer;
        checkoutPlanId = session?.metadata?.planId || null;
      } else {
        const subEvent = event.data.object;
        subscriptionId = subEvent.id;
        customerId = subEvent.customer;
      }

      // ✅ Guard: if subscriptionId missing, do not crash
      if (!subscriptionId) {
        console.warn("⚠️ Webhook received but subscriptionId missing. type:", event.type);
        return res.json({ received: true });
      }

      // Fetch subscription (period end + status + metadata)
      const subscription = await stripe.subscriptions.retrieve(subscriptionId);

      const status = subscription.status; // active, trialing, past_due...
      const currentPeriodEnd = safeUnixToDateOnly(subscription.current_period_end);

      // planId from subscription metadata preferred; fallback to checkout session metadata
      const planId = subscription?.metadata?.planId || checkoutPlanId || null;

      // Find user by stripe_customer_id
      const userRes = await pool.query(
        `SELECT id, membership_code
         FROM users
         WHERE stripe_customer_id = $1
         LIMIT 1`,
        [customerId]
      );

      if (userRes.rows.length === 0) {
        console.warn("⚠️ No user found for stripe_customer_id:", customerId);
        return res.json({ received: true });
      }

      const userId = userRes.rows[0].id;
      const existingCode = userRes.rows[0].membership_code;

      const isActive = status === "active" || status === "trialing";
      const membershipStatus = isActive ? "active" : "inactive";

      // Generate membership_code only if becoming active and missing code
      let finalMembershipCode = existingCode;
      if (isActive && !existingCode) {
        finalMembershipCode = generateMembershipCode(userId);

        // uniqueness retry
        for (let i = 0; i < 5; i++) {
          const dup = await pool.query(`SELECT 1 FROM users WHERE membership_code = $1 LIMIT 1`, [
            finalMembershipCode,
          ]);
          if (dup.rows.length === 0) break;
          finalMembershipCode = generateMembershipCode(userId);
        }
      }

      // Update user (store expiry as DATE)
      await pool.query(
        `UPDATE users
         SET stripe_subscription_id = $1,
             subscription_status = $2::varchar,
             membership_status = $3,
             membership_expiry = $4::date,
             membership_code = COALESCE($5, membership_code),
             membership_plan_id = COALESCE($6, membership_plan_id)
         WHERE stripe_customer_id = $7`,
        [subscriptionId, status, membershipStatus, currentPeriodEnd, finalMembershipCode, planId, customerId]
      );

      console.log("✅ Membership updated:", {
        customerId,
        status,
        planId,
        codeSet: !!finalMembershipCode,
        expiry: currentPeriodEnd,
      });
    }

    // subscription deleted (still active until period end)
    if (event.type === "customer.subscription.deleted") {
      const sub = event.data.object;
      const status = "canceled";
      const currentPeriodEnd = safeUnixToDateOnly(sub.current_period_end);

      await pool.query(
        `UPDATE users
         SET subscription_status = $1::varchar,
             membership_status = 'active',
             membership_expiry = $2::date
         WHERE stripe_subscription_id = $3`,
        [status, currentPeriodEnd, sub.id]
      );

      console.log("✅ Subscription canceled but active until:", currentPeriodEnd);
    }

    return res.json({ received: true });
  } catch (err) {
    console.error("Webhook handler error:", err);
    return res.status(500).json({ message: "Webhook server error" });
  }
});

module.exports = router;