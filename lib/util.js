const SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';

exports.SECRET = SECRET;
exports.wrap = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
exports.bad = (res, msg, code = 400) => res.status(code).json({ error: msg });
exports.escapeRe = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
// only accept images that live on Cloudinary
exports.isCloudUrl = u => typeof u === 'string' && /^https:\/\/res\.cloudinary\.com\/[\w-]+\/image\/upload\/[\w\-./]+$/.test(u);
exports.pub = u => ({ id: u._id, name: u.name, username: u.username, avatar: u.avatar || '' });
exports.me = u => ({ id: u._id, name: u.name, username: u.username, avatar: u.avatar || '', email: u.email, bio: u.bio || '' });
