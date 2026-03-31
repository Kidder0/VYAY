const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const branchRoutes = require('./routes/branches');
const authRoutes = require('./routes/auth');
const classRoutes = require('./routes/classes');
const checkinRoutes = require('./routes/checkin');
const billingRoutes = require('./routes/billing');
const stripeWebhookRoutes = require('./routes/stripeWebhook');
const mawabRoutes = require('./routes/mawab');

const app = express();
const PORT = process.env.PORT || 5000;

/* ============================================
   ✅ IMPORTANT: Stripe webhook needs raw body
============================================ */
app.use(
  '/api/stripe/webhook',
  express.raw({ type: 'application/json' }),
  stripeWebhookRoutes
);

/* ============================================
   ✅ Normal Middlewares
============================================ */
app.use(cors());

// ✅ THIS MUST BE BEFORE ROUTES (fixes req.body undefined)
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

/* ============================================
   ✅ Static Public Folder
============================================ */
app.use(express.static(path.join(__dirname, 'public')));

/* ============================================
   ✅ API Routes
============================================ */
app.use('/api/auth', authRoutes);
app.use('/api/classes', classRoutes);
app.use('/api/checkin', checkinRoutes);
app.use('/api/billing', billingRoutes);
app.use('/api/branches', branchRoutes);
app.use('/api/mawab', mawabRoutes);

/* ============================================
   ✅ Test Routes
============================================ */
app.get('/', (req, res) => {
  res.send('GymPro API is running...');
});

app.get('/stripe-success', (req, res) => {
  res.send(
    '✅ Payment success! You can now go back to the GymPro app and refresh Check-in.'
  );
});

app.get('/stripe-cancel', (req, res) => {
  res.send('❌ Payment cancelled. You can go back and try again.');
});

/* ============================================
   ✅ Global Error Handler (VERY IMPORTANT)
   Prevents server crash
============================================ */
app.use((err, req, res, next) => {
  console.error('GLOBAL ERROR:', err);
  res.status(500).json({ message: 'Internal server error' });
});

/* ============================================
   ✅ Start Server
============================================ */
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});
