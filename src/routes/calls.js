const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { getCalls, createCall, endCall } = require('../controllers/callController');

router.get('/', auth, getCalls);
router.post('/', auth, createCall);
router.put('/:id/end', auth, endCall);

module.exports = router;