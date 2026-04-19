const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { getMessages, sendMessage, updateMessage, deleteMessage } = require('../controllers/messageController');

router.get('/:id/messages', auth, getMessages);
router.post('/:id/messages', auth, sendMessage);

module.exports = router;