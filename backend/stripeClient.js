const Stripe = require('stripe');

const missingStripeMessage = 'Missing STRIPE_SECRET_KEY in environment';

const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: '2024-06-20',
    })
  : new Proxy(
      {},
      {
        get() {
          throw new Error(missingStripeMessage);
        },
      }
    );

module.exports = stripe;
