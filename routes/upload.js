const router = require('express').Router();
const crypto = require('crypto');
const auth = require('../middleware/auth');

// Signed direct uploads: the browser sends the image straight to Cloudinary,
// so large files never pass through the (size-limited) serverless function.
router.get('/sign', auth, (req, res) => {
  const { CLOUDINARY_CLOUD_NAME: cloudName, CLOUDINARY_API_KEY: apiKey, CLOUDINARY_API_SECRET: secret } = process.env;
  if (!cloudName || !apiKey || !secret) return res.status(503).json({ error: 'Photo upload is not configured yet' });
  const timestamp = Math.round(Date.now() / 1000), folder = 'ripple';
  const signature = crypto.createHash('sha1').update(`folder=${folder}&timestamp=${timestamp}${secret}`).digest('hex');
  res.json({ cloudName, apiKey, timestamp, folder, signature });
});

module.exports = router;
