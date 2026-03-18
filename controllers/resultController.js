const QuizResult = require('../models/QuizResult');
const Quiz = require('../models/Quiz');
const CheatingLog = require('../models/CheatingLog');

// Get all results for a student
exports.getStudentResults = async (req, res) => {
  try {
    const results = await QuizResult.find({ studentId: req.user.id })
      .populate('quizId', 'title quizCode resultMode isReleased')
      .sort({ submittedAt: -1 });

    // Filter based on result mode
    const filteredResults = results.map((r) => {
      const result = r.toObject();
      if (result.quizId && result.quizId.resultMode === 'hidden' && !result.quizId.isReleased) {
        result.score = null;
        result.percentage = null;
        result.isHidden = true;
      } else {
        result.isHidden = false;
      }
      return result;
    });

    res.json(filteredResults);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching results', error: error.message });
  }
};

// Get quiz results (for faculty)
exports.getQuizResults = async (req, res) => {
  try {
    const { quizId } = req.params;

    const quiz = await Quiz.findOne({ _id: quizId, createdBy: req.user.id });
    if (!quiz) {
      return res.status(404).json({ message: 'Quiz not found' });
    }

    const results = await QuizResult.find({ quizId })
      .select('username score totalQuestions percentage submittedAt')
      .sort({ score: -1 });

    const cheatingLogs = await CheatingLog.find({ quizId })
      .select('username totalAttempts');

    const cheatingMap = {};
    cheatingLogs.forEach((log) => {
      cheatingMap[log.username] = log.totalAttempts;
    });

    const enrichedResults = results.map((r) => ({
      ...r.toObject(),
      cheatingAttempts: cheatingMap[r.username] || 0,
    }));

    res.json({
      quiz: {
        title: quiz.title,
        quizCode: quiz.quizCode,
        totalQuestions: quiz.questions.length,
      },
      results: enrichedResults,
      totalStudents: results.length,
      avgScore: results.length > 0
        ? Math.round(results.reduce((sum, r) => sum + r.percentage, 0) / results.length)
        : 0,
    });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching results', error: error.message });
  }
};

// Get leaderboard for a quiz code
exports.getLeaderboard = async (req, res) => {
  try {
    const { quizCode } = req.params;

    const quiz = await Quiz.findOne({ quizCode });
    if (!quiz) {
      return res.status(404).json({ message: 'Quiz not found' });
    }

    // Check result visibility
    if (quiz.resultMode === 'hidden' && !quiz.isReleased) {
      return res.status(403).json({ message: 'Results have not been released yet' });
    }

    const results = await QuizResult.find({ quizCode })
      .select('username score totalQuestions percentage submittedAt')
      .sort({ score: -1, submittedAt: 1 });

    const leaderboard = results.map((r, index) => ({
      rank: index + 1,
      username: r.username,
      score: r.score,
      totalQuestions: r.totalQuestions,
      percentage: r.percentage,
      submittedAt: r.submittedAt,
    }));

    res.json({
      quizTitle: quiz.title,
      quizCode: quiz.quizCode,
      leaderboard,
    });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching leaderboard', error: error.message });
  }
};

// Get question difficulty analysis (for faculty)
exports.getQuestionAnalysis = async (req, res) => {
  try {
    const { quizId } = req.params;

    const quiz = await Quiz.findOne({ _id: quizId, createdBy: req.user.id });
    if (!quiz) {
      return res.status(404).json({ message: 'Quiz not found' });
    }

    const results = await QuizResult.find({ quizId });
    if (results.length === 0) {
      return res.status(404).json({ message: 'No results available for analysis' });
    }

    const analysis = quiz.questions.map((q, i) => {
      const correctCount = results.filter((r) => r.answers[i] === q.correctAnswer).length;
      const correctPercentage = Math.round((correctCount / results.length) * 100);
      const wrongPercentage = 100 - correctPercentage;

      let difficulty;
      if (correctPercentage >= 80) difficulty = 'Easy';
      else if (correctPercentage >= 50) difficulty = 'Medium';
      else difficulty = 'Hard';

      return {
        questionNumber: i + 1,
        question: q.question,
        topic: q.topic,
        correctPercentage,
        wrongPercentage,
        difficulty,
        totalResponses: results.length,
      };
    });

    res.json({
      quiz: { title: quiz.title, quizCode: quiz.quizCode },
      analysis,
      totalStudents: results.length,
    });
  } catch (error) {
    res.status(500).json({ message: 'Error analyzing questions', error: error.message });
  }
};

// Get cheating logs for a quiz (for faculty)
exports.getCheatingLogs = async (req, res) => {
  try {
    const { quizId } = req.params;

    const quiz = await Quiz.findOne({ _id: quizId, createdBy: req.user.id });
    if (!quiz) {
      return res.status(404).json({ message: 'Quiz not found' });
    }

    const logs = await CheatingLog.find({ quizId })
      .select('username totalAttempts attempts')
      .sort({ totalAttempts: -1 });

    res.json({
      quizTitle: quiz.title,
      quizCode: quiz.quizCode,
      logs,
    });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching cheating logs', error: error.message });
  }
};
