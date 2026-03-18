const mongoose = require('mongoose');

const questionSchema = new mongoose.Schema({
  question: {
    type: String,
    required: true,
  },
  options: {
    type: [String],
    required: true,
    validate: {
      validator: function (v) {
        return v.length === 4;
      },
      message: 'Each question must have exactly 4 options',
    },
  },
  correctAnswer: {
    type: Number,
    required: true,
    min: 0,
    max: 3,
  },
  topic: {
    type: String,
    default: 'General',
  },
});

const quizSchema = new mongoose.Schema({
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Faculty',
    required: true,
  },
  title: {
    type: String,
    required: [true, 'Quiz title is required'],
    trim: true,
  },
  quizCode: {
    type: String,
    unique: true,
    required: true,
    length: 6,
  },
  questions: {
    type: [questionSchema],
    required: true,
    validate: {
      validator: function (v) {
        return v.length > 0;
      },
      message: 'Quiz must have at least one question',
    },
  },
  timer: {
    type: Number,
    default: 0, // 0 means unlimited
    min: 0,
  },
  resultMode: {
    type: String,
    enum: ['instant', 'hidden'],
    default: 'instant',
  },
  isPublished: {
    type: Boolean,
    default: false,
  },
  isReleased: {
    type: Boolean,
    default: false,
  },
  sourceFileName: {
    type: String,
    default: '',
  },
  activeStudents: {
    type: Number,
    default: 0,
  },
  submittedCount: {
    type: Number,
    default: 0,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

// Generate a random 6-digit quiz code
quizSchema.statics.generateQuizCode = async function () {
  let code;
  let exists = true;
  while (exists) {
    code = Math.floor(100000 + Math.random() * 900000).toString();
    exists = await this.findOne({ quizCode: code });
  }
  return code;
};

module.exports = mongoose.model('Quiz', quizSchema);
