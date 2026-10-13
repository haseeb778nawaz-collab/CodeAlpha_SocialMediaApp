require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');

const app = express();
app.set('trust proxy', 1);

app.use(helmet({
  contentSecurityPolicy: {
    useDefaults: false,
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      fontSrc: ['https://fonts.gstatic.com'],
      imgSrc: ["'self'", 'data:', 'blob:', 'https://res.cloudinary.com'],
      connectSrc: ["'self'", 'https://api.cloudinary.com'],
      objectSrc: ["'none'"],
      frameAncestors: ["'self'"]
    }
  }
}));
app.use(express.json({ limit: '50kb' }));
app.use(express.static(path.join(__dirname, 'public')));

/* ---------- Rate limiting ---------- */
const limiter = (windowMs, max, message) => rateLimit({ windowMs, max, standardHeaders: true, legacyHeaders: false, message: { error: message } });
app.use('/api/auth/login', limiter(15 * 60 * 1000, 20, 'Too many attempts, please try again in a few minutes'));
app.use('/api/auth/register', limiter(60 * 60 * 1000, 20, 'Too many sign-ups from this network, try again later'));
app.use('/api', limiter(60 * 1000, 150, 'You are going too fast, slow down a little'));

/* ---------- DB connection (lazy: works locally and on Vercel) ---------- */
let ready = null;
function connectDB() {
  if (!ready) {
    ready = mongoose
      .connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/ripple_social', { serverSelectionTimeoutMS: 8000 })
      .then(() => console.log('MongoDB connected'))
      .catch(e => { ready = null; throw e; });
  }
  return ready;
}
app.use('/api', (req, res, next) => connectDB().then(() => next()).catch(next));

/* ---------- Routes ---------- */
app.use('/api/auth', require('./routes/auth'));
app.use('/api/users', require('./routes/users'));
app.use('/api/posts', require('./routes/posts'));
app.use('/api/upload', require('./routes/upload'));

app.use('/api', (req, res) => res.status(404).json({ error: 'Not found' }));
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Something went wrong, please try again' });
});

if (require.main === module) {
  const port = process.env.PORT || 3000;
  connectDB()
    .then(() => app.listen(port, () => console.log(`Ripple running at http://localhost:${port}`)))
    .catch(e => { console.error('Could not start server:', e.message); process.exit(1); });
}
module.exports = app;
