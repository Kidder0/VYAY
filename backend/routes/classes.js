const express = require('express');
const router = express.Router();

const pool = require('../db');
const authenticateToken = require('../middleware/authMiddleware');
const requireAdmin = require('../middleware/requireAdmin');

/**
 * =========================
 * ✅ PUBLIC: Upcoming sessions
 * =========================
 * GET /api/classes/upcoming
 */
router.get('/upcoming', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        cs.id AS session_id,
        ct.name AS class_name,
        ct.description,
        cs.scheduled_at,
        cs.duration_minutes,
        cs.location,
        cs.capacity,
        (
          SELECT COUNT(*) 
          FROM class_bookings 
          WHERE class_session_id = cs.id
        ) AS booked_count,
        t.name AS trainer_name,
        t.bio AS trainer_bio,
        t.photo_url AS trainer_photo
      FROM class_sessions cs
      JOIN class_types ct ON cs.class_type_id = ct.id
      LEFT JOIN trainers t ON cs.trainer_id = t.id
      WHERE cs.scheduled_at > NOW()
      ORDER BY cs.scheduled_at ASC;
    `);

    const sessions = result.rows.map((session) => ({
      ...session,
      booked_count: parseInt(session.booked_count, 10),
      spots_left: session.capacity - parseInt(session.booked_count, 10),
    }));

    res.status(200).json({ sessions });
  } catch (err) {
    console.error('Error fetching classes:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

/**
 * =========================
 * ✅ MEMBER: Book a class
 * =========================
 * POST /api/classes/book
 * Body: { session_id }
 */
router.post('/book', authenticateToken, async (req, res) => {
  const userId = req.user.userId;
  const { session_id } = req.body;

  if (!session_id) {
    return res.status(400).json({ message: 'session_id is required' });
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // lock the session row so capacity can't be oversold
    const sessionRes = await client.query(
      'SELECT id, capacity, scheduled_at FROM class_sessions WHERE id = $1 FOR UPDATE',
      [session_id]
    );

    if (sessionRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ message: 'Class session not found' });
    }

    const capacity = sessionRes.rows[0].capacity;

    const scheduledAt = new Date(sessionRes.rows[0].scheduled_at);
    if (scheduledAt <= new Date()) {
      await client.query('ROLLBACK');
      return res.status(400).json({ message: 'Cannot book a past session' });
    }

    // check if already booked
    const existingBooking = await client.query(
      'SELECT 1 FROM class_bookings WHERE user_id = $1 AND class_session_id = $2',
      [userId, session_id]
    );

    if (existingBooking.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ message: 'Already booked this class' });
    }

    // count bookings while lock is held
    const countRes = await client.query(
      'SELECT COUNT(*) FROM class_bookings WHERE class_session_id = $1',
      [session_id]
    );

    const bookedCount = parseInt(countRes.rows[0].count, 10);

    if (bookedCount >= capacity) {
      await client.query('ROLLBACK');
      return res.status(400).json({ message: 'Class is full' });
    }

    await client.query(
      'INSERT INTO class_bookings (user_id, class_session_id) VALUES ($1, $2)',
      [userId, session_id]
    );

    await client.query('COMMIT');
    return res.status(200).json({ message: 'Class booked successfully!' });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Booking error:', err);

    // unique constraint violation (if you added one)
    if (err.code === '23505') {
      return res.status(400).json({ message: 'Already booked this class' });
    }

    return res.status(500).json({ message: 'Server error' });
  } finally {
    client.release();
  }
});

/**
 * =========================
 * ✅ MEMBER: My bookings
 * =========================
 * GET /api/classes/my-bookings
 */
router.get('/my-bookings', authenticateToken, async (req, res) => {
  const userId = req.user.userId;

  try {
    const result = await pool.query(
      `
      SELECT 
        cb.id AS booking_id,
        ct.name AS class_name,
        ct.description,
        cs.scheduled_at,
        cs.duration_minutes,
        cs.location
      FROM class_bookings cb
      JOIN class_sessions cs ON cb.class_session_id = cs.id
      JOIN class_types ct ON cs.class_type_id = ct.id
      WHERE cb.user_id = $1
      ORDER BY cs.scheduled_at ASC;
      `,
      [userId]
    );

    res.status(200).json({ bookings: result.rows });
  } catch (err) {
    console.error('Fetch bookings error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

/**
 * =========================
 * ✅ MEMBER: Cancel booking
 * =========================
 * DELETE /api/classes/cancel/:session_id
 */
router.delete('/cancel/:session_id', authenticateToken, async (req, res) => {
  const userId = req.user.userId;
  const sessionId = req.params.session_id;

  try {
    const result = await pool.query(
      'DELETE FROM class_bookings WHERE user_id = $1 AND class_session_id = $2 RETURNING *',
      [userId, sessionId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'No booking found to cancel' });
    }

    res.status(200).json({ message: 'Booking cancelled successfully' });
  } catch (err) {
    console.error('Cancel booking error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

/**
 * =========================
 * ✅ PUBLIC: Trainers list
 * =========================
 * GET /api/classes/trainers
 */
router.get('/trainers', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, name, bio, photo_url FROM trainers ORDER BY name ASC;'
    );
    res.status(200).json({ trainers: result.rows });
  } catch (err) {
    console.error('Error fetching trainers:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

/**
 * =========================
 * 🔒 ADMIN: Add trainer
 * =========================
 * POST /api/classes/trainers
 */
router.post('/trainers', authenticateToken, requireAdmin, async (req, res) => {
  const { name, bio, photo_url } = req.body;

  if (!name || !photo_url) {
    return res.status(400).json({ message: 'Name and photo URL are required' });
  }

  try {
    const result = await pool.query(
      'INSERT INTO trainers (name, bio, photo_url) VALUES ($1, $2, $3) RETURNING *',
      [name, bio || '', photo_url]
    );
    res.status(201).json({ trainer: result.rows[0] });
  } catch (err) {
    console.error('Add trainer error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

/**
 * =========================
 * 🔒 ADMIN: Update trainer
 * =========================
 * PUT /api/classes/trainers/:id
 */
router.put('/trainers/:id', authenticateToken, requireAdmin, async (req, res) => {
  const trainerId = req.params.id;
  const { name, bio, photo_url } = req.body;

  try {
    const existing = await pool.query(
      'SELECT id, name, bio, photo_url FROM trainers WHERE id = $1',
      [trainerId]
    );

    if (existing.rows.length === 0) {
      return res.status(404).json({ message: 'Trainer not found' });
    }

    const current = existing.rows[0];

    const updatedName = name ?? current.name;
    const updatedBio = bio ?? current.bio;
    const updatedPhoto = photo_url ?? current.photo_url;

    const result = await pool.query(
      `UPDATE trainers
       SET name = $1, bio = $2, photo_url = $3
       WHERE id = $4
       RETURNING *`,
      [updatedName, updatedBio, updatedPhoto, trainerId]
    );

    res.status(200).json({ trainer: result.rows[0] });
  } catch (err) {
    console.error('Update trainer error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

/**
 * =========================
 * 🔒 ADMIN: Delete trainer
 * =========================
 * DELETE /api/classes/trainers/:id
 */
router.delete('/trainers/:id', authenticateToken, requireAdmin, async (req, res) => {
  const trainerId = req.params.id;

  try {
    const result = await pool.query('DELETE FROM trainers WHERE id = $1 RETURNING *', [
      trainerId,
    ]);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Trainer not found' });
    }

    res.status(200).json({ message: 'Trainer deleted successfully' });
  } catch (err) {
    console.error('Delete trainer error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

/**
 * =========================
 * 🔒 ADMIN: Create session
 * =========================
 * POST /api/classes/sessions
 */
router.post('/sessions', authenticateToken, requireAdmin, async (req, res) => {
  const { class_type_id, trainer_id, scheduled_at, duration_minutes, location, capacity } =
    req.body;

  if (!class_type_id || !scheduled_at || !duration_minutes || !location || !capacity) {
    return res.status(400).json({ message: 'Missing required fields' });
  }

  const scheduledAt = new Date(scheduled_at);
  if (scheduledAt <= new Date()) {
    return res.status(400).json({ message: 'scheduled_at must be in the future' });
  }

  try {
    const result = await pool.query(
      `INSERT INTO class_sessions
        (class_type_id, trainer_id, scheduled_at, duration_minutes, location, capacity)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [class_type_id, trainer_id || null, scheduled_at, duration_minutes, location, capacity]
    );

    res.status(201).json({ session: result.rows[0] });
  } catch (err) {
    console.error('Create session error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

/**
 * =========================
 * 🔒 ADMIN: List sessions (includes past)
 * =========================
 * GET /api/classes/sessions?futureOnly=true
 */
router.get('/sessions', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const futureOnly = req.query.futureOnly === 'true';

    const result = await pool.query(`
      SELECT 
        cs.id,
        cs.class_type_id,
        ct.name AS class_name,
        cs.trainer_id,
        t.name AS trainer_name,
        cs.scheduled_at,
        cs.duration_minutes,
        cs.location,
        cs.capacity,
        (
          SELECT COUNT(*) 
          FROM class_bookings 
          WHERE class_session_id = cs.id
        ) AS booked_count
      FROM class_sessions cs
      JOIN class_types ct ON cs.class_type_id = ct.id
      LEFT JOIN trainers t ON cs.trainer_id = t.id
      ${futureOnly ? 'WHERE cs.scheduled_at > NOW()' : ''}
      ORDER BY cs.scheduled_at DESC;
    `);

    const sessions = result.rows.map((s) => ({
      ...s,
      booked_count: parseInt(s.booked_count, 10),
      spots_left: s.capacity - parseInt(s.booked_count, 10),
    }));

    res.status(200).json({ sessions });
  } catch (err) {
    console.error('Error fetching sessions:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

/**
 * =========================
 * 🔒 ADMIN: Update session (partial)
 * =========================
 * PUT /api/classes/sessions/:id
 */
router.put('/sessions/:id', authenticateToken, requireAdmin, async (req, res) => {
  const sessionId = req.params.id;
  const { class_type_id, trainer_id, scheduled_at, duration_minutes, location, capacity } =
    req.body;

  try {
    const existing = await pool.query(
      `SELECT id, class_type_id, trainer_id, scheduled_at, duration_minutes, location, capacity
       FROM class_sessions
       WHERE id = $1`,
      [sessionId]
    );

    if (existing.rows.length === 0) {
      return res.status(404).json({ message: 'Session not found' });
    }

    const current = existing.rows[0];

    const updated = {
      class_type_id: class_type_id ?? current.class_type_id,
      trainer_id: trainer_id ?? current.trainer_id,
      scheduled_at: scheduled_at ?? current.scheduled_at,
      duration_minutes: duration_minutes ?? current.duration_minutes,
      location: location ?? current.location,
      capacity: capacity ?? current.capacity,
    };

    // if scheduled_at is changing, enforce future
    if (scheduled_at !== undefined) {
      const newDate = new Date(updated.scheduled_at);
      if (newDate <= new Date()) {
        return res.status(400).json({ message: 'scheduled_at must be in the future' });
      }
    }

    // If capacity is being changed, ensure it isn't less than already booked
    if (capacity !== undefined) {
      const bookedRes = await pool.query(
        'SELECT COUNT(*) FROM class_bookings WHERE class_session_id = $1',
        [sessionId]
      );
      const bookedCount = parseInt(bookedRes.rows[0].count, 10);

      if (updated.capacity < bookedCount) {
        return res.status(400).json({
          message: `Capacity cannot be less than already booked (${bookedCount})`,
        });
      }
    }

    const result = await pool.query(
      `UPDATE class_sessions
       SET class_type_id = $1,
           trainer_id = $2,
           scheduled_at = $3,
           duration_minutes = $4,
           location = $5,
           capacity = $6
       WHERE id = $7
       RETURNING *`,
      [
        updated.class_type_id,
        updated.trainer_id,
        updated.scheduled_at,
        updated.duration_minutes,
        updated.location,
        updated.capacity,
        sessionId,
      ]
    );

    res.status(200).json({ session: result.rows[0] });
  } catch (err) {
    console.error('Update session error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

/**
 * =========================
 * 🔒 ADMIN: Delete session
 * =========================
 * DELETE /api/classes/sessions/:id
 */
router.delete('/sessions/:id', authenticateToken, requireAdmin, async (req, res) => {
  const sessionId = req.params.id;

  try {
    const result = await pool.query('DELETE FROM class_sessions WHERE id = $1 RETURNING *', [
      sessionId,
    ]);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Session not found' });
    }

    res.status(200).json({ message: 'Session deleted successfully' });
  } catch (err) {
    console.error('Delete session error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;