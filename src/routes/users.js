const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { getUserById, getUserByPhone, searchUsers, blockUser, unblockUser } = require('../controllers/userController');

// Les routes statiques DOIVENT être déclarées AVANT /:id
// sinon Express capture /search et /phone/xxx comme des alanyaID
router.get('/search',       auth, searchUsers);
router.get('/phone/:phone', auth, getUserByPhone);
router.get('/:id',          auth, getUserById);
router.post('/:id/block',   auth, blockUser);
router.delete('/:id/block', auth, unblockUser);

module.exports = router;