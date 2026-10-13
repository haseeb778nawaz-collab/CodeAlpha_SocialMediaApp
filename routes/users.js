const router = require('express').Router();
const User = require('../models/User');
const Post = require('../models/Post');
const auth = require('../middleware/auth');
const { wrap, bad, pub, me, escapeRe, isCloudUrl } = require('../lib/util');

router.use(auth);

router.get('/search', wrap(async (req, res) => {
  const q = String(req.query.q || '').trim().slice(0, 30);
  if (!q) return res.json([]);
  const re = new RegExp(escapeRe(q), 'i');
  const users = await User.find({ $or: [{ username: re }, { name: re }] }).limit(8).select('name username avatar');
  res.json(users.map(pub));
}));

router.get('/suggestions', wrap(async (req, res) => {
  const m = await User.findById(req.userId).select('following');
  const users = await User.find({ _id: { $nin: [...m.following, req.userId] } })
    .sort({ createdAt: -1 }).limit(5).select('name username avatar bio');
  res.json(users.map(u => ({ ...pub(u), bio: u.bio })));
}));

router.put('/me', wrap(async (req, res) => {
  const name = String(req.body.name ?? '').trim(), bio = String(req.body.bio ?? '').trim();
  const avatar = req.body.avatar ?? '';
  if (name.length < 2 || name.length > 40) return bad(res, 'Name must be 2 to 40 characters');
  if (bio.length > 160) return bad(res, 'Bio can be up to 160 characters');
  if (avatar && !isCloudUrl(avatar)) return bad(res, 'Invalid photo');
  const user = await User.findByIdAndUpdate(req.userId, { name, bio, avatar }, { new: true });
  res.json(me(user));
}));

router.get('/:username', wrap(async (req, res) => {
  const u = await User.findOne({ username: req.params.username.toLowerCase() });
  if (!u) return bad(res, 'User not found', 404);
  res.json({
    ...pub(u), bio: u.bio, joined: u.createdAt,
    posts: await Post.countDocuments({ author: u._id }),
    followers: u.followers.length, following: u.following.length,
    isMe: String(u._id) === req.userId,
    isFollowing: u.followers.some(f => String(f) === req.userId)
  });
}));

router.post('/:username/follow', wrap(async (req, res) => {
  const t = await User.findOne({ username: req.params.username.toLowerCase() });
  if (!t) return bad(res, 'User not found', 404);
  if (String(t._id) === req.userId) return bad(res, "You can't follow yourself");
  const has = t.followers.some(f => String(f) === req.userId);
  const op = has ? '$pull' : '$addToSet';
  await User.updateOne({ _id: t._id }, { [op]: { followers: req.userId } });
  await User.updateOne({ _id: req.userId }, { [op]: { following: t._id } });
  const fresh = await User.findById(t._id).select('followers');
  res.json({ following: !has, followers: fresh.followers.length });
}));

module.exports = router;
