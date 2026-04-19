# 📋 Plan de Refonte Backend Talky

> Objectif : Remplacer Firestore par MySQL + API REST + garder WebRTC signaling

---

## 📁 Structure des Fichiers

```
Serveur/
├── package.json          → Mettre à jour avec mysql2, express-validator, cors, jsonwebtoken
├── .env                  → ⚠️ À REMPLIR avec tes infos BDD
├── server.js             → Refonte complète
├── src/
│   ├── config/
│   │   └── db.js         → Connexion MySQL
│   ├── middleware/
│   │   ├── auth.js       → Validation Firebase token
│   │   └── errorHandler.js
│   ├── controllers/
│   │   ├── authController.js
│   │   ├── userController.js
│   │   ├── conversationController.js
│   │   ├── messageController.js
│   │   ├── statutController.js
│   │   ├── callController.js
│   │   └── meetingController.js
│   ├── routes/
│   │   ├── auth.js
│   │   ├── users.js
│   │   ├── conversations.js
│   │   ├── messages.js
│   │   ├── status.js
│   │   ├── calls.js
│   │   └── meetings.js
│   ├── services/
│   │   ├── notificationService.js
│   │   └── webrtcService.js
│   └── socket/
│       └── handlers/
│           ├── auth.js
│           ├── chat.js
│           ├── calls.js
│           └── meetings.js
└── talky/
    └── schema.sql       → Copier depuis docs/talky_schema.sql
```

---

## ⚠️ Fichier `.env` à remplir

```
PORT=3000
NODE_ENV=production

# MySQL — À REMPLIR
DB_HOST=
DB_PORT=3306
DB_NAME=talky
DB_USER=
DB_PASSWORD=

# Firebase (garder existant)
FIREBASE_SERVICE_ACCOUNT=... (déjà dans le .env actuel)

# JWT — Générer une clé secrète aléatoire
JWT_SECRET=

# FCM (garder existant)
FCM_SERVER_KEY=
```

---

## 📦 Dependencies à installer

```bash
npm install express socket.io mysql2 firebase-admin dotenv express-validator cors jsonwebtoken
```

---

## 🔧 Étapes d'Implémentation

### 1. Préparation
```bash
mkdir -p src/config src/middleware src/controllers src/routes src/services src/socket/handlers

# Importer le schéma SQL sur le serveur MySQL
mysql -h HOST -u USER -p talky < talky_schema.sql
```

### 2. Ordre d'implémentation
1. **config/db.js** — Connexion MySQL
2. **middleware/auth.js** — Vérif token Firebase
3. **middleware/errorHandler.js** — Gestion erreurs
4. **controllers/** — Un par un (7 fichiers)
5. **routes/** — Un par un (7 fichiers)
6. **services/** — notificationService + webrtcService
7. **socket/handlers/** — auth, chat, calls, meetings
8. **server.js** — Intégrer tout ensemble

---

## 📡 Endpoints API REST

| Méthode | Endpoint | Controller |
|---------|----------|------------|
| POST | `/api/auth/verify` | authController |
| GET/PUT | `/api/auth/me` | authController |
| GET | `/api/users/:id` | userController |
| GET | `/api/users/phone/:phone` | userController |
| GET | `/api/users/search?q=` | userController |
| POST/DELETE | `/api/users/:id/block` | userController |
| GET/POST | `/api/conversations` | conversationController |
| POST | `/api/conversations/group` | conversationController |
| GET/PUT/DELETE | `/api/conversations/:id` | conversationController |
| POST | `/api/conversations/:id/read` | conversationController |
| POST | `/api/conversations/:id/leave` | conversationController |
| GET | `/api/conversations/:id/messages` | messageController |
| POST | `/api/conversations/:id/messages` | messageController |
| PUT/DELETE | `/api/messages/:id` | messageController |
| GET/POST/DELETE | `/api/status` | statutController |
| POST | `/api/status/:id/view` | statutController |
| GET/POST | `/api/calls` | callController |
| PUT | `/api/calls/:id/end` | callController |
| GET/POST/PUT/DELETE | `/api/meetings` | meetingController |
| POST | `/api/meetings/:id/join` | meetingController |
| POST | `/api/meetings/:id/accept/:userId` | meetingController |
| POST | `/api/meetings/:id/decline/:userId` | meetingController |

---

## 🔌 Socket.io Events

### Events existants (GARDER)
- `register`, `call_user`, `answer_call`, `reject_call`
- `ice_candidate`, `end_call`
- `create_group_call`, `join_group_call`
- `group_offer`, `group_answer`, `group_ice_candidate`
- `leave_group_call`, `end_group_call`

### NOUVEAUX Events
- `join_conversation`, `message:send`, `typing:start`, `typing:stop`
- `presence:online`, `presence:offline`
- `meeting:create`, `meeting:join_request`, `meeting:join_accept`, `meeting:join_decline`
- `meeting:start`, `meeting:end`, `meeting:chat`

---

## ✅ Checklist

- [ ] MySQL connecté + schéma importé
- [ ] npm install exécuté
- [ ] /api/auth/verify fonctionne
- [ ] /api/users/:id fonctionne
- [ ] /api/conversations fonctionne
- [ ] Socket.io messages temps réel
- [ ] FCM notifications fonctionnent
- [ ] WebRTC signaling inchangé
- [ ] Déploiement Render OK