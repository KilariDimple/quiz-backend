const { GoogleGenerativeAI } = require('@google/generative-ai');

let genAI = null;

const getGenAI = () => {
  if (!genAI) {
    genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  }
  return genAI;
};

const getModel = () => {
  return getGenAI().getGenerativeModel({ model: 'gemini-2.5-flash' });
};

/**
 * Generate quiz questions from document content
 */
const generateQuizQuestions = async (content, numQuestions, title = 'Quiz') => {
  try {
    const model = getModel();

    const prompt = `You are an expert quiz creator. Based on the following document content, generate exactly ${numQuestions} multiple choice questions.

DOCUMENT CONTENT:
${content.substring(0, 15000)}

REQUIREMENTS:
1. Generate exactly ${numQuestions} questions
2. Each question must have exactly 4 options (A, B, C, D)
3. Only one option should be the correct answer
4. Questions should cover different topics from the content
5. Questions should range from easy to hard difficulty
6. Assign a topic/category to each question based on the content area it covers

RESPOND IN THIS EXACT JSON FORMAT (no markdown, no code blocks, just pure JSON):
{
  "questions": [
    {
      "question": "Question text here?",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correctAnswer": 0,
      "topic": "Topic Name"
    }
  ]
}

The "correctAnswer" field must be the index (0-3) of the correct option.
Generate exactly ${numQuestions} questions. Respond with ONLY valid JSON.`;

    const result = await model.generateContent(prompt);
    const response = result.response.text();

    // Clean the response - remove markdown code blocks if present
    let cleanResponse = response.trim();
    if (cleanResponse.startsWith('```json')) {
      cleanResponse = cleanResponse.slice(7);
    } else if (cleanResponse.startsWith('```')) {
      cleanResponse = cleanResponse.slice(3);
    }
    if (cleanResponse.endsWith('```')) {
      cleanResponse = cleanResponse.slice(0, -3);
    }
    cleanResponse = cleanResponse.trim();

    const parsed = JSON.parse(cleanResponse);
    return parsed.questions;
  } catch (error) {
    console.error('Error generating quiz questions:', error.message);
    throw new Error('Failed to generate quiz questions: ' + error.message);
  }
};

/**
 * Generate personalized student feedback
 */
const generateStudentFeedback = async (studentName, score, totalQuestions, questions, studentAnswers) => {
  try {
    const model = getModel();

    // Build question analysis
    const questionAnalysis = questions.map((q, i) => {
      const isCorrect = studentAnswers[i] === q.correctAnswer;
      return {
        question: q.question,
        topic: q.topic,
        correct: isCorrect,
        studentAnswer: q.options[studentAnswers[i]] || 'Not answered',
        correctAnswer: q.options[q.correctAnswer],
      };
    });

    const correctTopics = questionAnalysis.filter(q => q.correct).map(q => q.topic);
    const wrongTopics = questionAnalysis.filter(q => !q.correct).map(q => q.topic);

    const prompt = `You are an educational AI tutor. Analyze this student's quiz performance and generate personalized feedback.

STUDENT: ${studentName}
SCORE: ${score}/${totalQuestions} (${Math.round((score / totalQuestions) * 100)}%)

QUESTION ANALYSIS:
${JSON.stringify(questionAnalysis, null, 2)}

TOPICS ANSWERED CORRECTLY: ${[...new Set(correctTopics)].join(', ') || 'None'}
TOPICS ANSWERED INCORRECTLY: ${[...new Set(wrongTopics)].join(', ') || 'None'}

Generate a detailed personalized feedback report. Respond in this EXACT JSON format (no markdown, no code blocks):
{
  "strengths": ["Strength 1", "Strength 2", "Strength 3"],
  "weaknesses": ["Weakness 1", "Weakness 2"],
  "suggestions": ["Suggestion 1", "Suggestion 2", "Suggestion 3"],
  "overallComment": "A comprehensive 2-3 sentence overall assessment of the student's performance."
}

Make the feedback specific, actionable, and encouraging. Respond with ONLY valid JSON.`;

    const result = await model.generateContent(prompt);
    const response = result.response.text();

    let cleanResponse = response.trim();
    if (cleanResponse.startsWith('```json')) cleanResponse = cleanResponse.slice(7);
    else if (cleanResponse.startsWith('```')) cleanResponse = cleanResponse.slice(3);
    if (cleanResponse.endsWith('```')) cleanResponse = cleanResponse.slice(0, -3);
    cleanResponse = cleanResponse.trim();

    return JSON.parse(cleanResponse);
  } catch (error) {
    console.error('Error generating student feedback:', error.message);
    throw new Error('Failed to generate feedback: ' + error.message);
  }
};

/**
 * Generate class-wide performance feedback for faculty
 */
const generateClassFeedback = async (quizTitle, questions, results) => {
  try {
    const model = getModel();

    // Analyze per-question performance
    const questionStats = questions.map((q, i) => {
      const correctCount = results.filter(r => r.answers[i] === q.correctAnswer).length;
      return {
        question: q.question,
        topic: q.topic,
        correctPercentage: Math.round((correctCount / results.length) * 100),
        wrongPercentage: Math.round(((results.length - correctCount) / results.length) * 100),
      };
    });

    const avgScore = results.reduce((sum, r) => sum + r.percentage, 0) / results.length;

    const prompt = `You are an educational analytics AI. Analyze the overall class performance for this quiz and provide feedback for the faculty.

QUIZ: ${quizTitle}
TOTAL STUDENTS: ${results.length}
AVERAGE SCORE: ${Math.round(avgScore)}%

QUESTION-WISE PERFORMANCE:
${JSON.stringify(questionStats, null, 2)}

Generate comprehensive class performance feedback. Respond in EXACT JSON format (no markdown):
{
  "strongTopics": ["Topic students excelled at 1", "Topic 2"],
  "weakTopics": ["Topic students struggled with 1", "Topic 2"],
  "teachingSuggestions": ["Teaching suggestion 1", "Suggestion 2", "Suggestion 3"],
  "overallAssessment": "A 2-3 sentence overall assessment of class performance.",
  "difficultyInsights": "Brief analysis of question difficulty distribution."
}

Respond with ONLY valid JSON.`;

    const result = await model.generateContent(prompt);
    const response = result.response.text();

    let cleanResponse = response.trim();
    if (cleanResponse.startsWith('```json')) cleanResponse = cleanResponse.slice(7);
    else if (cleanResponse.startsWith('```')) cleanResponse = cleanResponse.slice(3);
    if (cleanResponse.endsWith('```')) cleanResponse = cleanResponse.slice(0, -3);
    cleanResponse = cleanResponse.trim();

    return JSON.parse(cleanResponse);
  } catch (error) {
    console.error('Error generating class feedback:', error.message);
    throw new Error('Failed to generate class feedback: ' + error.message);
  }
};

/**
 * Generate performance insights for a student across multiple quizzes
 */
const generatePerformanceInsights = async (studentName, quizResults) => {
  try {
    const model = getModel();

    const historyData = quizResults.map((r, i) => ({
      quizNumber: i + 1,
      score: r.score,
      total: r.totalQuestions,
      percentage: r.percentage,
      date: r.submittedAt,
    }));

    const prompt = `You are an AI learning analytics expert. Analyze this student's performance history across multiple quizzes and generate insights.

STUDENT: ${studentName}
QUIZ HISTORY:
${JSON.stringify(historyData, null, 2)}

Generate personalized performance insights. Respond in EXACT JSON format (no markdown):
{
  "trend": "improving" | "declining" | "stable",
  "trendDescription": "Description of the performance trend, e.g., 'You improved 15% in the last 3 quizzes.'",
  "strongAreas": ["Strong area 1", "Strong area 2"],
  "weakAreas": ["Weak area 1", "Weak area 2"],
  "studySuggestions": ["Study suggestion 1", "Suggestion 2", "Suggestion 3"],
  "motivationalMessage": "A motivational message based on performance.",
  "predictedNextScore": "Predicted score range for next quiz based on trend"
}

Respond with ONLY valid JSON.`;

    const result = await model.generateContent(prompt);
    const response = result.response.text();

    let cleanResponse = response.trim();
    if (cleanResponse.startsWith('```json')) cleanResponse = cleanResponse.slice(7);
    else if (cleanResponse.startsWith('```')) cleanResponse = cleanResponse.slice(3);
    if (cleanResponse.endsWith('```')) cleanResponse = cleanResponse.slice(0, -3);
    cleanResponse = cleanResponse.trim();

    return JSON.parse(cleanResponse);
  } catch (error) {
    console.error('Error generating performance insights:', error.message);
    throw new Error('Failed to generate insights: ' + error.message);
  }
};

module.exports = {
  generateQuizQuestions,
  generateStudentFeedback,
  generateClassFeedback,
  generatePerformanceInsights,
};
