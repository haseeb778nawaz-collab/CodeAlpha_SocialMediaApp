const router = require('express').Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const auth = require('../middleware/auth');
const { SECRET, wrap, bad, me } = require('../lib/util');

const sign = u => jwt.sign({ id: u._id }, SECRET, { expiresIn: '7d' });
const str = v => String(v ?? '').trim();

router.post('/register', wrap(async (req, res) => {
  const name = str(req.body.name), username = str(req.body.username).toLowerCase();
  const email = str(req.body.email).toLowerCase(), password = String(req.body.password ?? '');
  if (name.length < 2 || name.length > 40) return bad(res, 'Name must be 2 to 40 characters');
  if (!/^[a-z0-9_]{3,20}$/.test(username)) return bad(res, 'Username: 3 to 20 letters, numbers or underscores');
  if (!/^\S+@\S+\.\S+$/.test(email)) return bad(res, 'Enter a valid email address');
  if (password.length < 8) return bad(res, 'Password must be at least 8 characters');
  if (await User.exists({ email })) return bad(res, 'This email is already registered', 409);
  if (await User.exists({ username })) return bad(res, 'That username is taken', 409);
  const user = await User.create({ name, username, email, password: await bcrypt.hash(password, 10) });
  res.status(201).json({ token: sign(user), user: me(user) });
}));

router.post('/login', wrap(async (req, res) => {
  const id = str(req.body.identifier).toLowerCase();
  const user = id && await User.findOne({ $or: [{ email: id }, { username: id }] });
  if (!user || !(await bcrypt.compare(String(req.body.password ?? ''), user.password)))
    return bad(res, 'Incorrect email/username or password', 401);
  res.json({ token: sign(user), user: me(user) });
}));

router.get('/me', auth, wrap(async (req, res) => {
  const user = await User.findById(req.userId);
  user ? res.json(me(user)) : bad(res, 'Account not found', 401);
}));

module.exports = router;
