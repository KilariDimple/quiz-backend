const express = require('express');
const router = express.Router();
const {
  uploadMiddleware,
  uploadDocument,
  generateQuestions,
  createQuiz,
  getQuizByCode,
  submitQuiz,
  logCheating,
  getQuizMonitor,
  releaseResults,
  getMyQuizzes,
} = require('../controllers/quizController');
const { auth, roleAuth } = require('../middleware/auth');

// Faculty routes
router.post('/upload', auth, roleAuth('faculty'), uploadMiddleware, uploadDocument);
router.post('/generate-questions', auth, roleAuth('faculty'), generateQuestions);
router.post('/create', auth, roleAuth('faculty'), createQuiz);
router.get('/my-quizzes', auth, roleAuth('faculty'), getMyQuizzes);
router.get('/monitor/:quizId', auth, roleAuth('faculty'), getQuizMonitor);
router.put('/release/:quizId', auth, roleAuth('faculty'), releaseResults);

// Student routes
router.get('/by-code/:code', auth, roleAuth('student'), getQuizByCode);
router.post('/submit', auth, roleAuth('student'), submitQuiz);
router.post('/log-cheating', auth, roleAuth('student'), logCheating);

module.exports = router;
