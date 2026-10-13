const mongoose = require('mongoose');

const schema = new mongoose.Schema({
  post: { type: mongoose.Schema.Types.ObjectId, ref: 'Post', required: true, index: true },
  author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  text: { type: String, required: true, maxlength: 200 }
}, { timestamps: true });

module.exports = mongoose.models.Comment || mongoose.model('Comment', schema);
