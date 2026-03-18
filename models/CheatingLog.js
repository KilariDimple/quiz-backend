const mongoose = require('mongoose');

const cheatingLogSchema = new mongoose.Schema({
  studentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Student',
    required: true,
  },
  quizId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Quiz',
    required: true,
  },
  username: {
    type: String,
    required: true,
  },
  quizCode: {
    type: String,
    required: true,
  },
  attempts: [
    {
      type: {
        type: String,
        enum: ['tab_switch', 'fullscreen_exit', 'page_refresh', 'devtools_open', 'copy_attempt'],
        required: true,
      },
      timestamp: {
        type: Date,
        default: Date.now,
      },
    },
  ],
  totalAttempts: {
    type: Number,
    default: 0,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

// Compound index for efficient queries
cheatingLogSchema.index({ studentId: 1, quizId: 1 }, { unique: true });

module.exports = mongoose.model('CheatingLog', cheatingLogSchema);
