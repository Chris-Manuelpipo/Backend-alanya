const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const {
  getConversations,
  getConversationById,
  createConversation,
  createGroup,
  updateConversation,
  deleteConversation,
  markAsRead,
  leaveGroup,
} = require('../controllers/conversationController');

router.get('/', auth, getConversations);
router.post('/', auth, createConversation);
router.post('/group', auth, createGroup);
router.get('/:id', auth, getConversationById);
router.put('/:id', auth, updateConversation);
router.delete('/:id', auth, deleteConversation);
router.post('/:id/read', auth, markAsRead);
router.post('/:id/leave', auth, leaveGroup);

module.exports = router;