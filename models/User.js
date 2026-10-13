const mongoose = require('mongoose');
const ref = { type: mongoose.Schema.Types.ObjectId, ref: 'User' };

const schema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 40 },
  username: { type: String, required: true, unique: true, lowercase: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  password: { type: String, required: true },
  bio: { type: String, default: '', maxlength: 160 },
  avatar: { type: String, default: '' },
  followers: [ref],
  following: [ref]
}, { timestamps: true });

module.exports = mongoose.models.User || mongoose.model('User', schema);
