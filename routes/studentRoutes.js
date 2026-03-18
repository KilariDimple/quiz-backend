const express = require('express');
const router = express.Router();
const { register, login, getProfile } = require('../controllers/studentController');
const { auth, roleAuth } = require('../middleware/auth');

router.post('/register', register);
router.post('/login', login);
router.get('/profile', auth, roleAuth('student'), getProfile);

module.exports = router;
