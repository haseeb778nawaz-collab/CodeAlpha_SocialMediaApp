const mongoose = require('mongoose');

const schema = new mongoose.Schema({
  author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  text: { type: String, default: '', maxlength: 280 },
  image: { type: String, default: '' },
  likes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  commentsCount: { type: Number, default: 0 }
}, { timestamps: true });

schema.index({ createdAt: -1 });
schema.index({ author: 1, createdAt: -1 });
schema.index({ likes: 1, createdAt: -1 });

module.exports = mongoose.models.Post || mongoose.model('Post', schema);
