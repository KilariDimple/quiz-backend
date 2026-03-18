const mongoose = require('mongoose');

const quizResultSchema = new mongoose.Schema({
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
  quizCode: {
    type: String,
    required: true,
  },
  username: {
    type: String,
    required: true,
  },
  answers: {
    type: [Number],
    required: true,
  },
  score: {
    type: Number,
    required: true,
    default: 0,
  },
  totalQuestions: {
    type: Number,
    required: true,
  },
  percentage: {
    type: Number,
    default: 0,
  },
  feedbackGenerated: {
    type: Boolean,
    default: false,
  },
  feedback: {
    strengths: [String],
    weaknesses: [String],
    suggestions: [String],
    overallComment: { type: String, default: '' },
  },
  submittedAt: {
    type: Date,
    default: Date.now,
  },
});

// Prevent duplicate submissions
quizResultSchema.index({ studentId: 1, quizId: 1 }, { unique: true });

module.exports = mongoose.model('QuizResult', quizResultSchema);
