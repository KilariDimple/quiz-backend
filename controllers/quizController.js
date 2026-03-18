const Quiz = require('../models/Quiz');
const QuizResult = require('../models/QuizResult');
const CheatingLog = require('../models/CheatingLog');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const pdfParse = require('pdf-parse');
const { generateQuizQuestions } = require('../utils/gemini');

// Multer configuration for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '..', 'uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  },
});

const fileFilter = (req, file, cb) => {
  const allowedTypes = [
    'application/pdf',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  ];
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Only PDF and PPT files are allowed'), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB limit
});

exports.uploadMiddleware = upload.single('document');

// Upload document and extract content
exports.uploadDocument = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    const filePath = req.file.path;
    let content = '';

    if (req.file.mimetype === 'application/pdf') {
      const dataBuffer = fs.readFileSync(filePath);
      const pdfData = await pdfParse(dataBuffer);
      content = pdfData.text;
    } else {
      // For PPT files, use officeparser
      try {
        const officeParser = require('officeparser');
        content = await new Promise((resolve, reject) => {
          officeParser.parseOffice(filePath, (data, err) => {
            if (err) reject(err);
            else resolve(data);
          });
        });
      } catch (pptErr) {
        content = 'Unable to parse PPT file. Please try uploading a PDF.';
      }
    }

    // Clean up uploaded file (async, non-blocking for OneDrive)
    try { fs.unlinkSync(filePath); } catch (e) {
      setTimeout(() => { try { fs.unlinkSync(filePath); } catch (_) {} }, 2000);
    }

    if (!content || content.trim().length < 50) {
      return res.status(400).json({
        message: 'Could not extract enough content from the document. Please upload a document with more text content.',
      });
    }

    res.json({
      message: 'Document uploaded and parsed successfully',
      content: content.trim(),
      fileName: req.file.originalname,
    });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ message: 'Error processing document', error: error.message });
  }
};

// Generate questions using AI
exports.generateQuestions = async (req, res) => {
  try {
    const { content, numQuestions, title } = req.body;

    if (!content || !numQuestions) {
      return res.status(400).json({ message: 'Content and number of questions are required' });
    }

    if (numQuestions < 1 || numQuestions > 50) {
      return res.status(400).json({ message: 'Number of questions must be between 1 and 50' });
    }

    const questions = await generateQuizQuestions(content, numQuestions, title);

    res.json({
      message: 'Questions generated successfully',
      questions,
    });
  } catch (error) {
    console.error('Question generation error:', error);
    res.status(500).json({ message: 'Error generating questions', error: error.message });
  }
};

// Create/save quiz with generated questions
exports.createQuiz = async (req, res) => {
  try {
    const { title, questions, timer, resultMode, sourceFileName } = req.body;

    if (!title || !questions || questions.length === 0) {
      return res.status(400).json({ message: 'Title and questions are required' });
    }

    // Validate each question
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      if (!q.question || !q.options || q.options.length !== 4 || q.correctAnswer === undefined) {
        return res.status(400).json({
          message: `Invalid question format at index ${i}. Each question must have question text, 4 options, and a correct answer.`,
        });
      }
    }

    // Generate unique quiz code
    const quizCode = await Quiz.generateQuizCode();

    const quiz = new Quiz({
      createdBy: req.user.id,
      title,
      quizCode,
      questions,
      timer: timer || 0,
      resultMode: resultMode || 'instant',
      isPublished: true,
      sourceFileName: sourceFileName || '',
    });

    await quiz.save();

    res.status(201).json({
      message: 'Quiz created successfully',
      quiz: {
        id: quiz._id,
        title: quiz.title,
        quizCode: quiz.quizCode,
        questionCount: quiz.questions.length,
        timer: quiz.timer,
        resultMode: quiz.resultMode,
      },
    });
  } catch (error) {
    console.error('Create quiz error:', error);
    res.status(500).json({ message: 'Error creating quiz', error: error.message });
  }
};

// Get quiz by code (for students)
exports.getQuizByCode = async (req, res) => {
  try {
    const { code } = req.params;

    const quiz = await Quiz.findOne({ quizCode: code, isPublished: true });
    if (!quiz) {
      return res.status(404).json({ message: 'Invalid quiz code. No quiz found.' });
    }

    // Check if student already submitted
    const existingResult = await QuizResult.findOne({
      studentId: req.user.id,
      quizId: quiz._id,
    });

    if (existingResult) {
      return res.status(400).json({ message: 'You have already submitted this quiz.' });
    }

    // Increment active students
    await Quiz.findByIdAndUpdate(quiz._id, { $inc: { activeStudents: 1 } });

    // Send questions without correct answers
    const sanitizedQuestions = quiz.questions.map((q) => ({
      question: q.question,
      options: q.options,
      topic: q.topic,
    }));

    res.json({
      quizId: quiz._id,
      title: quiz.title,
      quizCode: quiz.quizCode,
      questions: sanitizedQuestions,
      timer: quiz.timer,
      resultMode: quiz.resultMode,
      totalQuestions: quiz.questions.length,
    });
  } catch (error) {
    console.error('Get quiz error:', error);
    res.status(500).json({ message: 'Error fetching quiz', error: error.message });
  }
};

// Submit quiz answers
exports.submitQuiz = async (req, res) => {
  try {
    const { quizId, answers } = req.body;

    if (!quizId || !answers) {
      return res.status(400).json({ message: 'Quiz ID and answers are required' });
    }

    const quiz = await Quiz.findById(quizId);
    if (!quiz) {
      return res.status(404).json({ message: 'Quiz not found' });
    }

    // Check for duplicate submission
    const existingResult = await QuizResult.findOne({
      studentId: req.user.id,
      quizId: quiz._id,
    });

    if (existingResult) {
      return res.status(400).json({ message: 'You have already submitted this quiz.' });
    }

    // Calculate score
    let score = 0;
    quiz.questions.forEach((q, i) => {
      if (answers[i] === q.correctAnswer) {
        score++;
      }
    });

    const totalQuestions = quiz.questions.length;
    const percentage = Math.round((score / totalQuestions) * 100);

    // Create result
    const result = new QuizResult({
      studentId: req.user.id,
      quizId: quiz._id,
      quizCode: quiz.quizCode,
      username: req.user.username,
      answers,
      score,
      totalQuestions,
      percentage,
    });

    await result.save();

    // Update quiz counters
    await Quiz.findByIdAndUpdate(quiz._id, {
      $inc: { submittedCount: 1, activeStudents: -1 },
    });

    // Determine what to return based on result mode
    const responseData = {
      message: 'Quiz submitted successfully',
      resultId: result._id,
    };

    if (quiz.resultMode === 'instant') {
      responseData.score = score;
      responseData.totalQuestions = totalQuestions;
      responseData.percentage = percentage;
      responseData.showResult = true;
    } else {
      responseData.showResult = false;
      responseData.message = 'Quiz submitted successfully. Results will be available once the faculty releases them.';
    }

    res.json(responseData);
  } catch (error) {
    console.error('Submit quiz error:', error);
    res.status(500).json({ message: 'Error submitting quiz', error: error.message });
  }
};

// Log cheating attempt
exports.logCheating = async (req, res) => {
  try {
    const { quizId, type } = req.body;

    if (!quizId || !type) {
      return res.status(400).json({ message: 'Quiz ID and cheating type are required' });
    }

    const quiz = await Quiz.findById(quizId);
    if (!quiz) {
      return res.status(404).json({ message: 'Quiz not found' });
    }

    let cheatingLog = await CheatingLog.findOne({
      studentId: req.user.id,
      quizId,
    });

    if (cheatingLog) {
      cheatingLog.attempts.push({ type, timestamp: new Date() });
      cheatingLog.totalAttempts = cheatingLog.attempts.length;
    } else {
      cheatingLog = new CheatingLog({
        studentId: req.user.id,
        quizId,
        username: req.user.username,
        quizCode: quiz.quizCode,
        attempts: [{ type, timestamp: new Date() }],
        totalAttempts: 1,
      });
    }

    await cheatingLog.save();

    res.json({
      message: 'Cheating attempt logged',
      totalAttempts: cheatingLog.totalAttempts,
    });
  } catch (error) {
    console.error('Log cheating error:', error);
    res.status(500).json({ message: 'Error logging cheating attempt', error: error.message });
  }
};

// Get quiz monitor data (for faculty)
exports.getQuizMonitor = async (req, res) => {
  try {
    const { quizId } = req.params;

    const quiz = await Quiz.findOne({ _id: quizId, createdBy: req.user.id });
    if (!quiz) {
      return res.status(404).json({ message: 'Quiz not found' });
    }

    const submittedCount = await QuizResult.countDocuments({ quizId });
    const cheatingLogs = await CheatingLog.find({ quizId }).select('username totalAttempts');

    res.json({
      title: quiz.title,
      quizCode: quiz.quizCode,
      totalQuestions: quiz.questions.length,
      activeStudents: quiz.activeStudents,
      submittedCount,
      remainingStudents: Math.max(0, quiz.activeStudents),
      cheatingLogs,
    });
  } catch (error) {
    console.error('Monitor error:', error);
    res.status(500).json({ message: 'Error fetching monitor data', error: error.message });
  }
};

// Release results (for hidden mode)
exports.releaseResults = async (req, res) => {
  try {
    const { quizId } = req.params;

    const quiz = await Quiz.findOneAndUpdate(
      { _id: quizId, createdBy: req.user.id },
      { isReleased: true },
      { new: true }
    );

    if (!quiz) {
      return res.status(404).json({ message: 'Quiz not found' });
    }

    res.json({ message: 'Results released successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Error releasing results', error: error.message });
  }
};

// Get all quizzes created by faculty
exports.getMyQuizzes = async (req, res) => {
  try {
    const quizzes = await Quiz.find({ createdBy: req.user.id })
      .select('title quizCode questions timer resultMode isPublished isReleased submittedCount createdAt')
      .sort({ createdAt: -1 });

    const quizData = quizzes.map((q) => ({
      id: q._id,
      title: q.title,
      quizCode: q.quizCode,
      questionCount: q.questions.length,
      timer: q.timer,
      resultMode: q.resultMode,
      isPublished: q.isPublished,
      isReleased: q.isReleased,
      submittedCount: q.submittedCount,
      createdAt: q.createdAt,
    }));

    res.json(quizData);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching quizzes', error: error.message });
  }
};
