const QuizResult = require('../models/QuizResult');
const Quiz = require('../models/Quiz');
const { generateStudentFeedback, generateClassFeedback, generatePerformanceInsights } = require('../utils/gemini');
const { generateFeedbackPDF } = require('../utils/pdfGenerator');

// Generate AI feedback for a specific quiz result
exports.generateFeedback = async (req, res) => {
  try {
    const { resultId } = req.params;

    const result = await QuizResult.findOne({ _id: resultId, studentId: req.user.id });
    if (!result) {
      return res.status(404).json({ message: 'Result not found' });
    }

    // Check if feedback already generated
    if (result.feedbackGenerated && result.feedback.overallComment) {
      return res.json({
        message: 'Feedback already generated',
        feedback: result.feedback,
      });
    }

    const quiz = await Quiz.findById(result.quizId);
    if (!quiz) {
      return res.status(404).json({ message: 'Quiz not found' });
    }

    // Generate feedback using Gemini
    const feedback = await generateStudentFeedback(
      req.user.username,
      result.score,
      result.totalQuestions,
      quiz.questions,
      result.answers
    );

    // Save feedback to result
    result.feedback = feedback;
    result.feedbackGenerated = true;
    await result.save();

    res.json({
      message: 'Feedback generated successfully',
      feedback,
    });
  } catch (error) {
    console.error('Generate feedback error:', error);
    res.status(500).json({ message: 'Error generating feedback', error: error.message });
  }
};

// Download feedback as PDF
exports.downloadFeedbackPDF = async (req, res) => {
  try {
    const { resultId } = req.params;

    const result = await QuizResult.findOne({ _id: resultId, studentId: req.user.id });
    if (!result) {
      return res.status(404).json({ message: 'Result not found' });
    }

    const quiz = await Quiz.findById(result.quizId);
    if (!quiz) {
      return res.status(404).json({ message: 'Quiz not found' });
    }

    // Generate feedback if not yet generated
    if (!result.feedbackGenerated) {
      const feedback = await generateStudentFeedback(
        req.user.username,
        result.score,
        result.totalQuestions,
        quiz.questions,
        result.answers
      );
      result.feedback = feedback;
      result.feedbackGenerated = true;
      await result.save();
    }

    // Generate PDF
    const pdfBuffer = await generateFeedbackPDF({
      studentName: result.username,
      quizTitle: quiz.title,
      score: result.score,
      totalQuestions: result.totalQuestions,
      percentage: result.percentage,
      feedback: result.feedback,
      submittedAt: result.submittedAt,
    });

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename=feedback_${result.quizCode}_${result.username}.pdf`,
      'Content-Length': pdfBuffer.length,
    });

    res.send(pdfBuffer);
  } catch (error) {
    console.error('PDF generation error:', error);
    res.status(500).json({ message: 'Error generating PDF', error: error.message });
  }
};

// Get AI performance insights for student
exports.getStudentAnalytics = async (req, res) => {
  try {
    const results = await QuizResult.find({ studentId: req.user.id })
      .populate('quizId', 'title')
      .sort({ submittedAt: 1 });

    if (results.length === 0) {
      return res.json({
        message: 'No quiz results found',
        insights: null,
        chartData: { labels: [], scores: [], percentages: [] },
      });
    }

    // Chart data
    const chartData = {
      labels: results.map((r, i) => r.quizId ? r.quizId.title : `Quiz ${i + 1}`),
      scores: results.map((r) => r.score),
      totalQuestions: results.map((r) => r.totalQuestions),
      percentages: results.map((r) => r.percentage),
      dates: results.map((r) => r.submittedAt),
    };

    // Generate AI insights if enough data
    let insights = null;
    if (results.length >= 2) {
      try {
        insights = await generatePerformanceInsights(req.user.username, results);
      } catch (aiErr) {
        console.error('AI insights error:', aiErr.message);
        insights = {
          trend: results[results.length - 1].percentage > results[0].percentage ? 'improving' : 'declining',
          trendDescription: 'AI insights temporarily unavailable.',
          strongAreas: [],
          weakAreas: [],
          studySuggestions: ['Keep practicing across all topics.'],
          motivationalMessage: 'Keep up the great work!',
          predictedNextScore: 'N/A',
        };
      }
    }

    res.json({
      message: 'Analytics fetched successfully',
      insights,
      chartData,
      totalQuizzes: results.length,
      avgPercentage: Math.round(results.reduce((sum, r) => sum + r.percentage, 0) / results.length),
    });
  } catch (error) {
    console.error('Analytics error:', error);
    res.status(500).json({ message: 'Error fetching analytics', error: error.message });
  }
};

// Generate class feedback (for faculty)
exports.getClassFeedback = async (req, res) => {
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

    const feedback = await generateClassFeedback(quiz.title, quiz.questions, results);

    res.json({
      message: 'Class feedback generated successfully',
      quizTitle: quiz.title,
      totalStudents: results.length,
      avgPercentage: Math.round(results.reduce((sum, r) => sum + r.percentage, 0) / results.length),
      feedback,
    });
  } catch (error) {
    console.error('Class feedback error:', error);
    res.status(500).json({ message: 'Error generating class feedback', error: error.message });
  }
};
