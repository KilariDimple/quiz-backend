const express = require('express');
const router = express.Router();
const {
  getStudentResults,
  getQuizResults,
  getLeaderboard,
  getQuestionAnalysis,
  getCheatingLogs,
} = require('../controllers/resultController');
const { auth, roleAuth } = require('../middleware/auth');

// Student routes
router.get('/student', auth, roleAuth('student'), getStudentResults);
router.get('/leaderboard/:quizCode', auth, getLeaderboard);

// Faculty routes
router.get('/quiz/:quizId', auth, roleAuth('faculty'), getQuizResults);
router.get('/question-analysis/:quizId', auth, roleAuth('faculty'), getQuestionAnalysis);
router.get('/cheating/:quizId', auth, roleAuth('faculty'), getCheatingLogs);

module.exports = router;
