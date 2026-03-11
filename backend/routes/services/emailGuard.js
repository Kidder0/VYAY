async function assertNotDisposableEmail(pool, email) {
  const cleanEmail = String(email).trim().toLowerCase();

  const domain = cleanEmail.split('@')[1];
  if (!domain) throw new Error('Invalid email');

  const { rows } = await pool.query(
    `SELECT 1 FROM blocked_email_domains WHERE LOWER(domain) = $1 LIMIT 1`,
    [domain]
  );

  if (rows.length > 0) {
    throw new Error('Temporary/disposable email is not allowed.');
  }
}

module.exports = { assertNotDisposableEmail };