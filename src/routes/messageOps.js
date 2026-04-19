const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { updateMessage, deleteMessage } = require('../controllers/messageController');

router.put('/:id', auth, updateMessage);
router.delete('/:id', auth, deleteMessage);

module.exports = router;