const router = require('express').Router();
const mongoose = require('mongoose');
const User = require('../models/User');
const Post = require('../models/Post');
const Comment = require('../models/Comment');
const auth = require('../middleware/auth');
const { wrap, bad, pub, isCloudUrl } = require('../lib/util');

const LIMIT = 10;
router.use(auth);
['id', 'commentId'].forEach(p => router.param(p, (req, res, next, v) => mongoose.isValidObjectId(v) ? next() : bad(res, 'Not found', 404)));

const shape = (p, uid) => ({
  id: p._id, text: p.text, image: p.image, createdAt: p.createdAt, author: pub(p.author),
  likes: p.likes.length, liked: p.likes.some(l => String(l) === String(uid)), comments: p.commentsCount
});

router.get('/', wrap(async (req, res) => {
  const { feed = 'explore', author, liked, before } = req.query;
  const q = {};
  if (before) {
    const d = new Date(before);
    if (isNaN(d)) return bad(res, 'Bad cursor');
    q.createdAt = { $lt: d };
  }
  if (author || liked) {
    const u = await User.findOne({ username: String(author || liked).toLowerCase() }).select('_id');
    if (!u) return res.json({ posts: [], next: null });
    author ? (q.author = u._id) : (q.likes = u._id);
  } else if (feed === 'following') {
    const m = await User.findById(req.userId).select('following');
    q.author = { $in: [...m.following, req.userId] };
  }
  const posts = await Post.find(q).sort({ createdAt: -1 }).limit(LIMIT + 1).populate('author', 'name username avatar');
  const more = posts.length > LIMIT;
  if (more) posts.pop();
  res.json({ posts: posts.map(p => shape(p, req.userId)), next: more ? posts[posts.length - 1].createdAt.toISOString() : null });
}));

router.post('/', wrap(async (req, res) => {
  const text = String(req.body.text ?? '').trim(), image = req.body.image || '';
  if (!text && !image) return bad(res, 'Write something or add a photo');
  if (text.length > 280) return bad(res, 'Posts can be up to 280 characters');
  if (image && !isCloudUrl(image)) return bad(res, 'Invalid photo');
  const post = await Post.create({ author: req.userId, text, image });
  await post.populate('author', 'name username avatar');
  res.status(201).json(shape(post, req.userId));
}));

router.delete('/:id', wrap(async (req, res) => {
  const post = await Post.findById(req.params.id);
  if (!post) return bad(res, 'Post not found', 404);
  if (String(post.author) !== req.userId) return bad(res, 'You can only delete your own posts', 403);
  await Promise.all([post.deleteOne(), Comment.deleteMany({ post: post._id })]);
  res.json({ ok: true });
}));

router.post('/:id/like', wrap(async (req, res) => {
  const post = await Post.findById(req.params.id).select('likes');
  if (!post) return bad(res, 'Post not found', 404);
  const has = post.likes.some(l => String(l) === req.userId);
  const upd = await Post.findByIdAndUpdate(req.params.id, has ? { $pull: { likes: req.userId } } : { $addToSet: { likes: req.userId } }, { new: true }).select('likes');
  res.json({ liked: !has, likes: upd.likes.length });
}));

/* comments */
const shapeC = c => ({ id: c._id, text: c.text, createdAt: c.createdAt, author: pub(c.author) });

router.get('/:id/comments', wrap(async (req, res) => {
  const list = await Comment.find({ post: req.params.id }).sort({ createdAt: 1 }).limit(100).populate('author', 'name username avatar');
  res.json(list.map(shapeC));
}));

router.post('/:id/comments', wrap(async (req, res) => {
  const text = String(req.body.text ?? '').trim();
  if (!text) return bad(res, 'Write a comment first');
  if (text.length > 200) return bad(res, 'Comments can be up to 200 characters');
  if (!(await Post.exists({ _id: req.params.id }))) return bad(res, 'Post not found', 404);
  const c = await Comment.create({ post: req.params.id, author: req.userId, text });
  await Post.updateOne({ _id: req.params.id }, { $inc: { commentsCount: 1 } });
  await c.populate('author', 'name username avatar');
  res.status(201).json(shapeC(c));
}));

router.delete('/:id/comments/:commentId', wrap(async (req, res) => {
  const [c, post] = await Promise.all([Comment.findById(req.params.commentId), Post.findById(req.params.id).select('author')]);
  if (!c || !post || String(c.post) !== req.params.id) return bad(res, 'Comment not found', 404);
  if (String(c.author) !== req.userId && String(post.author) !== req.userId) return bad(res, 'Not allowed', 403);
  await c.deleteOne();
  await Post.updateOne({ _id: post._id, commentsCount: { $gt: 0 } }, { $inc: { commentsCount: -1 } });
  res.json({ ok: true });
}));

module.exports = router;
