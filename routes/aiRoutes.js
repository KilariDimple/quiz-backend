const express = require('express');
const router = express.Router();
const {
  generateFeedback,
  downloadFeedbackPDF,
  getStudentAnalytics,
  getClassFeedback,
} = require('../controllers/aiController');
const { auth, roleAuth } = require('../middleware/auth');

// Student routes
router.post('/feedback/:resultId', auth, roleAuth('student'), generateFeedback);
router.get('/feedback-pdf/:resultId', auth, roleAuth('student'), downloadFeedbackPDF);
router.get('/analytics', auth, roleAuth('student'), getStudentAnalytics);

// Faculty routes
router.get('/class-feedback/:quizId', auth, roleAuth('faculty'), getClassFeedback);

module.exports = router;
