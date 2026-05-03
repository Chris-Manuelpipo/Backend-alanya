const express = require('express');
const router  = express.Router();
const auth    = require('../middleware/auth');
const {
  getPreferredContacts,
  addPreferredContact,
  removePreferredContact,
  checkIsContact,
} = require('../controllers/preferredContactController');

// GET    /api/contacts           — liste mes contacts préférés
// POST   /api/contacts/:id       — ajouter l'user :id comme contact préféré
// DELETE /api/contacts/:id       — retirer l'user :id de mes contacts
// GET    /api/contacts/check/:id — vérifier si :id est dans mes contacts

// IMPORTANT : /check/:id DOIT être avant /:id
router.get('/check/:id', auth, checkIsContact);
router.get('/',          auth, getPreferredContacts);
router.post('/:id',      auth, addPreferredContact);
router.delete('/:id',    auth, removePreferredContact);

module.exports = router;