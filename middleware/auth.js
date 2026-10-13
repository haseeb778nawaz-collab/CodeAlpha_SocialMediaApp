const jwt = require('jsonwebtoken');
const { SECRET } = require('../lib/util');

module.exports = (req, res, next) => {
  try {
    req.userId = jwt.verify((req.headers.authorization || '').replace('Bearer ', ''), SECRET).id;
    next();
  } catch {
    res.status(401).json({ error: 'Please log in to continue' });
  }
};
