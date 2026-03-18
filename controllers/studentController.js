const Student = require('../models/Student');
const jwt = require('jsonwebtoken');
const { sendRegistrationEmail } = require('../utils/email');

// Register a new student
exports.register = async (req, res) => {
  try {
    const { username, email, password, confirmPassword } = req.body;

    // Validation
    if (!username || !email || !password || !confirmPassword) {
      return res.status(400).json({ message: 'All fields are required' });
    }

    if (password !== confirmPassword) {
      return res.status(400).json({ message: 'Passwords do not match' });
    }

    if (password.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters' });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ message: 'Invalid email format' });
    }

    // Check uniqueness
    const existingUsername = await Student.findOne({ username });
    if (existingUsername) {
      return res.status(400).json({ message: 'Username already exists' });
    }

    const existingEmail = await Student.findOne({ email: email.toLowerCase() });
    if (existingEmail) {
      return res.status(400).json({ message: 'Email already exists' });
    }

    // Create student
    const student = new Student({ username, email, password });
    await student.save();

    // Send registration email (non-blocking)
    sendRegistrationEmail(email, username).catch((err) =>
      console.error('Registration email failed:', err.message)
    );

    // Generate JWT
    const token = jwt.sign(
      { id: student._id, role: 'student', username: student.username },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.status(201).json({
      message: 'Registration successful',
      token,
      user: {
        id: student._id,
        username: student.username,
        email: student.email,
        role: 'student',
      },
    });
  } catch (error) {
    console.error('Student registration error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Login student
exports.login = async (req, res) => {
  try {
    const { identifier, password } = req.body;

    if (!identifier || !password) {
      return res.status(400).json({ message: 'All fields are required' });
    }

    // Find by username or email
    const student = await Student.findOne({
      $or: [{ username: identifier }, { email: identifier.toLowerCase() }],
    });

    if (!student) {
      return res.status(401).json({ message: 'Invalid Credentials' });
    }

    const isMatch = await student.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid Credentials' });
    }

    const token = jwt.sign(
      { id: student._id, role: 'student', username: student.username },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      message: 'Login successful',
      token,
      user: {
        id: student._id,
        username: student.username,
        email: student.email,
        role: 'student',
      },
    });
  } catch (error) {
    console.error('Student login error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Get student profile
exports.getProfile = async (req, res) => {
  try {
    const student = await Student.findById(req.user.id).select('-password');
    if (!student) {
      return res.status(404).json({ message: 'Student not found' });
    }
    res.json(student);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};
