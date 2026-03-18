const Faculty = require('../models/Faculty');
const jwt = require('jsonwebtoken');
const { sendRegistrationEmail } = require('../utils/email');

// Register faculty
exports.register = async (req, res) => {
  try {
    const { facultyId, email, password, confirmPassword } = req.body;

    if (!facultyId || !email || !password || !confirmPassword) {
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

    const existingId = await Faculty.findOne({ facultyId });
    if (existingId) {
      return res.status(400).json({ message: 'Faculty ID already exists' });
    }

    const existingEmail = await Faculty.findOne({ email: email.toLowerCase() });
    if (existingEmail) {
      return res.status(400).json({ message: 'Email already exists' });
    }

    const faculty = new Faculty({ facultyId, email, password });
    await faculty.save();

    // Send registration email
    sendRegistrationEmail(email, facultyId).catch((err) =>
      console.error('Registration email failed:', err.message)
    );

    const token = jwt.sign(
      { id: faculty._id, role: 'faculty', facultyId: faculty.facultyId },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.status(201).json({
      message: 'Registration successful',
      token,
      user: {
        id: faculty._id,
        facultyId: faculty.facultyId,
        email: faculty.email,
        role: 'faculty',
      },
    });
  } catch (error) {
    console.error('Faculty registration error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Login faculty
exports.login = async (req, res) => {
  try {
    const { identifier, password } = req.body;

    if (!identifier || !password) {
      return res.status(400).json({ message: 'All fields are required' });
    }

    const faculty = await Faculty.findOne({
      $or: [{ facultyId: identifier }, { email: identifier.toLowerCase() }],
    });

    if (!faculty) {
      return res.status(401).json({ message: 'Invalid Credentials' });
    }

    const isMatch = await faculty.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid Credentials' });
    }

    const token = jwt.sign(
      { id: faculty._id, role: 'faculty', facultyId: faculty.facultyId },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      message: 'Login successful',
      token,
      user: {
        id: faculty._id,
        facultyId: faculty.facultyId,
        email: faculty.email,
        role: 'faculty',
      },
    });
  } catch (error) {
    console.error('Faculty login error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Get faculty profile
exports.getProfile = async (req, res) => {
  try {
    const faculty = await Faculty.findById(req.user.id).select('-password');
    if (!faculty) {
      return res.status(404).json({ message: 'Faculty not found' });
    }
    res.json(faculty);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};
