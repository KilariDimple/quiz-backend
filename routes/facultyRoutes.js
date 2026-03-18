const express = require('express');
const router = express.Router();
const { register, login, getProfile } = require('../controllers/facultyController');
const { auth, roleAuth } = require('../middleware/auth');

router.post('/register', register);
router.post('/login', login);
router.get('/profile', auth, roleAuth('faculty'), getProfile);

module.exports = router;
