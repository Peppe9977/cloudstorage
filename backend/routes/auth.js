const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const pool = require('../db/pool');

const router = express.Router();

// Slows down credential-guessing/brute-force attempts against /login.
// bcrypt already makes each guess computationally expensive; this limits
// how many guesses an attacker gets to make in the first place.
const loginLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many login attempts. Please try again later.' }
});

router.post('/login', loginLimiter, async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }

  try {
    const [rows] = await pool.query(
      'SELECT id, username, password_hash, root_folder FROM users WHERE username = ? LIMIT 1',
      [username]
    );

    if (rows.length === 0) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    const user = rows[0];
    const match = await bcrypt.compare(password, user.password_hash);

    if (!match) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    // The user's storage root is baked into the token itself, so every
    // subsequent request carries it without an extra DB lookup. It only
    // updates on the next login if changed in the database afterward.
    const token = jwt.sign(
      { sub: user.id, username: user.username, rootFolder: user.root_folder },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '8h' }
    );

    res.json({ token, username: user.username, rootFolder: user.root_folder });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Something went wrong during login' });
  }
});

// Returns the currently authenticated user, useful for the frontend
// to check on page load whether a stored token is still valid.
router.get('/me', require('../middleware/auth').requireAuth, (req, res) => {
  res.json({ username: req.user.username, rootFolder: req.user.rootFolder });
});

module.exports = router;
