# 🚀 Talky Backend — Serveur Messaging + WebRTC

## 📋 Vue d'ensemble

**Talky Backend** est un serveur Node.js/Express fournissant une plateforme complète de messagerie instantanée avec support WebRTC pour appels vidéo/audio, réunions programmées, et statuts éphémères.

### Caractéristiques principales
- **Authentification** : Firebase (OTP/Google) + JWT + Mapping Firebase ↔ MySQL
- **Base de données** : MySQL 5.7+ avec pool de connexions
- **Communication temps réel** : Socket.IO (WebSocket)
- **Appels vidéo/audio** : Signaling WebRTC (1-à-1 et de groupe)
- **Notifications** : Firebase Cloud Messaging (FCM) avec data-only
- **API** : REST (10+ routes) + WebSocket (événements temps réel)
- **Environnement** : Node.js 18+, Express 4.22+

---

## 🏗️ Architecture

```
┌────────────────────────────────────────────────────┐
│       Application Flutter (Talky)                  │
└─────────────────────┬────────────────────────────┘
                      │
          ┌───────────┴──────────┐
          ▼                      ▼
     REST API                Socket.IO
  (HTTP/JWT)          (WebSocket temps réel)
          │                      │
          └───────────┬──────────┘
                      ▼
         ┌──────────────────────────┐
         │   Express.js Server      │
         │   (port 3000)            │
         └──────────┬───────────────┘
                    │
      ┌─────────────┼────────────────┐
      ▼             ▼                ▼
  ┌────────┐   ┌────────────┐   ┌──────────────┐
  │ MySQL  │   │  Firebase  │   │ Socket.IO    │
  │ (conn  │   │  (Auth)    │   │ (Broadcasting│
  │ pool:  │   │            │   │  Socket map) │
  │ 10)    │   └────────────┘   └──────────────┘
  └────────┘
     Data          Auth            Real-time
```

### Composants clés
- **Express Server** : Routage HTTP, middlewares d'authentification
- **Socket.IO** : Gestion temps réel (chat, appels, réunions)
- **Firebase Admin** : Vérification des tokens, FCM
- **MySQL Pool** : Gestion des connexions persistantes (10 connexions max)

---

## ⚙️ Installation & Configuration

### 1. Prérequis
- **Node.js** : 18.0.0 minimum
- **npm** : 9+
- **MySQL** : 5.7+
- **Compte Firebase** : Projet `talky-2026` avec credentials
- **Compte Ubuntu/VPS** : Pour héberger le serveur

### 2. Installation locale

```bash
# Clone du repository
git clone <url-repo>
cd Serveur

# Installation des dépendances
npm install

# (Optionnel pour développement)
npm install --save-dev nodemon
```

### 3. Configuration `.env`

Créez un fichier `.env` à la racine du projet :

```env
# ─── Database MySQL ───
DB_HOST=163.123.183.89
DB_PORT=3306
DB_NAME=alanyBD2027
DB_USER=Chris
DB_PASSWORD=KENDRA2026

# ─── Server ───
PORT=3000
NODE_ENV=production

# ─── JWT (générer une clé aléatoire 32 bytes base64)
JWT_SECRET=nmpexO60gYH7AtkxpcMu8oipT5SDxfxOu85ZbfxQ1Xg=

# ─── Firebase Service Account (JSON stringifié)
# IMPORTANT: Les \n doivent rester comme \n dans le JSON (pas d'expansion)
FIREBASE_SERVICE_ACCOUNT={"type":"service_account","project_id":"talky-2026",...}
```

### 4. Démarrage

```bash
# Mode production
npm start

# Mode développement (auto-reload avec nodemon)
npm run dev
```

Le serveur sera accessible sur `http://localhost:3000`

### 5. Vérification de la connexion

```bash
# Test baseURL + token invalide (doit retourner 401)
curl http://localhost:3000/api/users/search?q=test

# Voir les logs Socket.IO
curl http://localhost:3000
```

---

## 📂 Structure du projet

```
Serveur/
├── src/
│   ├── config/
│   │   └── db.js                    # Pool de connexions MySQL
│   │
│   ├── controllers/                 # Logique métier (traitements)
│   │   ├── authController.js        # Authentification & profil
│   │   ├── userController.js        # Recherche, blocage users
│   │   ├── conversationController.js # Conversations 1-à-1/groupe
│   │   ├── messageController.js     # Messages + édition/suppression
│   │   ├── callController.js        # Historique appels
│   │   ├── meetingController.js     # Réunions programmées
│   │   └── statutController.js      # Statuts/Stories
│   │
│   ├── middleware/
│   │   ├── auth.js                  # Vérification JWT + Firebase token
│   │   ├── authFirebase.js          # Authentification Firebase
│   │   └── errorHandler.js          # Gestion centralisée des erreurs
│   │
│   ├── routes/                      # Définition endpoints REST
│   │   ├── auth.js                  # /api/auth
│   │   ├── users.js                 # /api/users
│   │   ├── conversations.js         # /api/conversations
│   │   ├── messages.js              # /api/conversations/:id/messages
│   │   ├── messageOps.js            # /api/messages (édition/suppression)
│   │   ├── calls.js                 # /api/calls
│   │   ├── meetings.js              # /api/meetings
│   │   ├── status.js                # /api/status (stories)
│   │   ├── notify.js                # /api/notify (notifications)
│   │   └── pays.js                  # /api/pays (countries)
│   │
│   ├── services/
│   │   ├── notificationService.js   # Envoi FCM data-only
│   │   ├── webrtcService.js         # Gestion signaling WebRTC
│   │   └── meetingScheduler.js      # Scheduler réunions (cron)
│   │
│   └── socket/
│       └── handlers/                # Gestion événements Socket.IO
│           ├── auth.js              # socket.on('auth')
│           ├── chat.js              # message:send, typing, presence
│           ├── calls.js             # call_user, answer_call, etc.
│           └── meetings.js          # meeting:create, meeting:start, etc.
│
├── server.js                        # Point d'entrée (init Express + Socket.IO)
├── package.json                     # Dépendances + scripts
├── .env                             # Variables d'environnement (À créer)
├── .env.example                     # Template .env (recommandé)
└── README.md                        # Cette documentation
```

### Flux de données typique

1. **Client Flutter** envoie requête `POST /api/messages` avec JWT token
2. **Middleware `auth.js`** vérifie le token Firebase + trouveUser en BD
3. **Route `messages.js`** valide l'entrée avec `express-validator`
4. **Controller `messageController.js`** exécute la logique (insert BD, etc)
5. **Socket.IO `notificationService.js`** envoie FCM aux destinataires
6. **Client reçoit** notification + message via Socket.IO ou FCM

## 🎯 Fonctionnalités principales

### 🔐 Authentification & Profil
- **Inscription** : Firebase OTP ou Google Sign-In
- **Mapping Firebase ↔ MySQL** : Via claim `talky_phone` (custom claim Firebase)
- **JWT Tokens** : Stockage en header `Authorization: Bearer <token>`
- **Profil utilisateur** : nom, pseudo, avatar, FCM token, status online/offline
- **Support biométrique** : Biométrie gérée côté Flutter, serveur stateless

### 💬 Messagerie
- **Conversations** : 1-à-1 et groupes (plusieurs participants)
- **Types de messages** : texte, images, vidéos, audio, fichiers
- **Édition/Suppression** : Récupération via `editedAt`, `deletedAt`
- **Réponses en chaîne** : Lien `replyTo` vers message parent
- **États de lecture** : sent → delivered → read
- **Participants dynamiques** : `conv_participants` table

### 📞 Appels Vidéo/Audio
- **Appels 1-à-1** : Audio ou vidéo, signaling WebRTC complet
- **Appels de groupe** : Mesh topology (P2P multiples avec SFU possible)
- **Signaling** : SDP Offers/Answers + ICE candidates via Socket.IO
- **Historique** : Durée, type, statut (répondu/rejeté/manqué)
- **Timeout** : Appel marqué manqué après 30s (configurable)

### 📅 Réunions programmées
- **Types** : Audio, vidéo, screen share
- **Invitations** : Liste de participants avec status accept/decline
- **Scheduler** : Cron job qui rappelle 5 min avant
- **Participants** : Table `participant` avec status per réunion
- **Chat in-meeting** : Messages isolés par réunion

### 📸 Statuts (Stories)
- **Formats** : Texte, image, vidéo
- **Expiration** : 24h automatique via trigger ou job
- **Personnalisation** : Couleur de fond, police
- **Tracking** : Table `statut_views` pour "qui a vu"
- **Visibilité** : Visible uniquement aux contacts non bloqués

### 👥 Contacts & Blocage
- **Recherche** : Par nom, pseudo, téléphone (wildcard)
- **Blocage** : Table `blocked` (bidirectionnel optionnel)
- **Exclusion** : Status `is_excluded` pour utilisateur supprimé
- **Presence** : `is_online`, `last_seen` mis à jour via Socket.IO
- **Favoris** : Table `preferredContact` pour contacts épinglés

### 🔔 Notifications Push
- **Service** : Firebase Cloud Messaging (FCM)
- **Type** : Data-only (pas de notification système, Flutter gère via `onMessage`)
- **Déclencheurs** : 
  - Appel entrant
  - Nouveau message
  - Statut vu
  - Réunion en 5 min
- **Payload** : Contient type, sender, conversationID, etc.

### 🌍 Autres
- **Pays** : Liste complète en table `pays`
- **Logs** : Table `userAccess` pour audit

---

## 📡 API REST Endpoints

Tous les endpoints (sauf `/api/auth/register` et `/api/pay`) nécessitent un header JWT:
```
Authorization: Bearer <firebase-id-token>
```

### 🔐 Authentification (`/api/auth`)

| Méthode | Endpoint | Description | Auth | Body |
|---------|----------|-------------|------|------|
| POST | `/auth/register` | Créer/MAJ user | ❌ | `{ uid, phone, nom, pseudo, avatar_url, fcm_token }` |
| POST | `/auth/verify` | Vérifier token JWT | ✅ | `{ token }` |
| GET | `/auth/me` | Profil de l'user courant | ✅ | - |
| PUT | `/auth/me` | MAJ profil courant | ✅ | `{ nom?, pseudo?, avatar_url?, fcm_token? }` |
| GET | `/auth/phone-exists/:phone` | Vérifier si tel existe | ❌ | - |

### 👤 Utilisateurs (`/api/users`)

| Méthode | Endpoint | Description | Auth | Query |
|---------|----------|-------------|------|-------|
| GET | `/users/:id` | Récupérer user par ID | ✅ | - |
| GET | `/users/phone/:phone` | Récupérer user par tél | ✅ | - |
| GET | `/users/search` | Rechercher users | ✅ | `q=<nom\|pseudo\|tel>` |
| POST | `/users/:id/block` | Bloquer user | ✅ | - |
| DELETE | `/users/:id/block` | Débloquer user | ✅ | - |

### 💬 Conversations (`/api/conversations`)

| Méthode | Endpoint | Description | Auth | Body/Query |
|---------|----------|-------------|------|------------|
| GET | `/conversations` | Lister conv | ✅ | `limit=20, offset=0` |
| POST | `/conversations` | Créer conv | ✅ | `{ participantIDs: [id1, id2], name? }` |
| GET | `/conversations/:id` | Détails conv | ✅ | - |
| PUT | `/conversations/:id` | MAJ conv | ✅ | `{ name?, is_pinned?, is_archived? }` |
| DELETE | `/conversations/:id` | Quitter conv | ✅ | - |
| POST | `/conversations/:id/leave` | Quitter conv (alt) | ✅ | - |
| POST | `/conversations/:id/read` | Marquer lu | ✅ | - |

### 📨 Messages (`/api/conversations/:id/messages` + `/api/messages`)

| Méthode | Endpoint | Description | Auth | Body |
|---------|----------|-------------|------|------|
| GET | `/conversations/:id/messages` | Historique (pagination) | ✅ | `limit=50, offset=0` |
| POST | `/conversations/:id/messages` | Envoyer message | ✅ | `{ content, type: 0, mediaUrl?, replyTo_ID? }` |
| PUT | `/messages/:id` | Éditer message | ✅ | `{ content }` |
| DELETE | `/messages/:id` | Supprimer message | ✅ | - |

**Message types** : `0=text`, `1=image`, `2=video`, `3=audio`, `4=file`

### 📞 Appels (`/api/calls`)

| Méthode | Endpoint | Description | Auth | Body |
|---------|----------|-------------|------|------|
| GET | `/calls` | Historique appels | ✅ | `limit=20, offset=0` |
| POST | `/calls` | Créer log appel | ✅ | `{ callerID, recipientID, call_type: "audio\|video" }` |
| PUT | `/calls/:id/end` | Terminer appel | ✅ | `{ duration_seconds, status: "missed\|answered\|rejected" }` |

### 📅 Réunions (`/api/meetings`)

| Méthode | Endpoint | Description | Auth | Body |
|---------|----------|-------------|------|------|
| GET | `/meetings` | Lister réunions | ✅ | - |
| POST | `/meetings` | Créer réunion | ✅ | `{ title, description?, scheduled_at, duration_min, meeting_type, participantIDs: [] }` |
| GET | `/meetings/:id` | Détails réunion | ✅ | - |
| PUT | `/meetings/:id` | MAJ réunion | ✅ | `{ title?, scheduled_at?, duration_min?, participantIDs? }` |
| DELETE | `/meetings/:id` | Supprimer réunion | ✅ | - |
| POST | `/meetings/:id/join` | Rejoindre réunion | ✅ | - |
| POST | `/meetings/:id/accept/:userId` | Accepter invitation | ✅ | - |
| POST | `/meetings/:id/decline/:userId` | Refuser invitation | ✅ | - |

### 📸 Statuts (`/api/status`)

| Méthode | Endpoint | Description | Auth | Body |
|---------|----------|-------------|------|------|
| GET | `/status` | Statuts des contacts | ✅ | - |
| GET | `/status/:id` | Détails statut | ✅ | - |
| POST | `/status` | Créer statut | ✅ | `{ content, type: "text\|image\|video", background_color?, media_url? }` |
| DELETE | `/status/:id` | Supprimer statut | ✅ | - |
| POST | `/status/:id/view` | Marquer vu | ✅ | - |

### 🌍 Autres endpoints

| Méthode | Endpoint | Description | Auth |
|---------|----------|-------------|------|
| GET | `/api/pays` | Liste des pays | ❌ |
| POST | `/api/notify/test` | Envoyer notif test | ✅ |

---

## 🔌 Socket.IO Events (Temps réel)

### Connexion & Authentification

```javascript
// Client → Server
socket.emit('auth', { token: '<firebase-id-token>' });

// Server → Client
socket.on('authenticated', { user_id: '123', phone: '+33...' });
socket.on('auth_error', { message: 'Invalid token' });
```

### Messagerie (`chat` namespace)

```javascript
// Rejoindre une conversation
socket.emit('join_conversation', { conversationID: 'conv_123' });

// Envoyer message (émis en temps réel)
socket.emit('message:send', { 
  conversationID, 
  content, 
  type: 0,        // 0=text, 1=image, 2=video, 3=audio, 4=file
  mediaUrl: null,
  replyTo_ID: null
});

// Recevoir message (serveur broadcast à tous les participants)
socket.on('message:received', {
  message_ID, conversationID, senderID, senderName,
  content, type, mediaUrl, sentAt, editedAt, deletedAt, replyTo_ID
});

// Indicateur "en train d'écrire"
socket.emit('typing:start', { conversationID });
socket.emit('typing:stop', { conversationID });

socket.on('typing:happening', { userID, userName });
socket.on('typing:stopped', { userID });

// Présence online/offline
socket.emit('presence:online', { userID });
socket.emit('presence:offline', { userID });

socket.on('presence:updated', { userID, is_online, last_seen });
```

### Appels 1-à-1 (WebRTC Signaling)

```javascript
// ─── Appelant ───
socket.emit('call_user', {
  targetUserId,
  callerId,
  callerName,
  callerPhoto,
  isVideo: true,           // false = audio only
  offer: <RTCSessionDescription>  // SDP
});

// ─── Appelé (reçoit) ───
socket.on('incoming_call', {
  callerId,
  callerName,
  callerPhoto,
  isVideo,
  offer
});

// ─── Appelé (accepte) ───
socket.emit('answer_call', {
  callerId,
  answer: <RTCSessionDescription>
});

socket.on('call_answered', {
  from: callerId,
  answer
});

// ─── Appelé (rejette) ───
socket.emit('reject_call', { callerId });

socket.on('call_rejected', { from, reason: 'busy|declined|timeout' });

// ─── Les deux (échange ICE candidates) ───
socket.emit('ice_candidate', {
  to: otherUserId,
  from: myUserId,
  candidate: <RTCIceCandidate>
});

socket.on('ice_candidate', { from, candidate });

// ─── Les deux (termine appel) ───
socket.emit('end_call', {
  to: otherUserId,
  from: myUserId
});

socket.on('call_ended', { from });
```

### Appels de groupe (Group Mesh)

```javascript
// Créer groupe
socket.emit('create_group_call', { roomId: 'group_123' });

// Rejoindre groupe
socket.emit('join_group_call', { roomId, userId });
socket.on('user_joined_group', { roomId, userId, userName });

// Signaling de groupe (P2P multiples)
socket.emit('group_offer', {
  roomId,
  to: otherUserIds,  // Array
  offer: <RTCSessionDescription>
});

socket.on('group_offer', { from, offer });

socket.emit('group_answer', {
  roomId,
  to: otherUserId,   // String
  answer: <RTCSessionDescription>
});

socket.on('group_answer', { from, answer });

socket.emit('group_ice_candidate', {
  roomId,
  to: otherUserId,
  candidate: <RTCIceCandidate>
});

socket.on('group_ice_candidate', { from, candidate });

// Quitter groupe
socket.emit('leave_group_call', { roomId });
socket.on('user_left_group', { roomId, userId });

// Terminer groupe
socket.emit('end_group_call', { roomId });
```

### Réunions programmées

```javascript
// Créer réunion
socket.emit('meeting:create', {
  meetingId,
  title,
  participants: [{ userId, userName }]
});

// Demander à rejoindre
socket.emit('meeting:join_request', { meetingId });
socket.on('meeting:join_request', { userId, userName });

// Accepter/Refuser
socket.emit('meeting:join_accept', { meetingId, userId });
socket.emit('meeting:join_decline', { meetingId, userId });

socket.on('meeting:accepted', { meetingId });

// Démarrer réunion
socket.emit('meeting:start', { meetingId });
socket.on('meeting:started', { meetingId });

// Chat dans réunion
socket.emit('meeting:chat', {
  meetingId,
  message: { text, senderID, senderName }
});

socket.on('meeting:new_message', { meetingId, message });

// Quitter/Terminer
socket.emit('meeting:leave', { meetingId });
socket.emit('meeting:end', { meetingId });
```

### Gestion de la déconnexion

```javascript
socket.on('disconnect', () => {
  // Utilisateur marqué offline
  // Presence:offline émis automatiquement
  // Appels en cours interrompus
});
```

---

## � Authentification & Sécurité

### Flux d'authentification

```
┌── Client Flutter ──────────────────┐
│                                    │
│  1. firebase.auth().signInWithOTP()│
│     ou google.signIn()             │
│                                    │
└─────────────────┬──────────────────┘
                  │
                  ▼
      ┌─ Firebase Auth SDK ─┐
      │ Valide credentials  │
      │ Génère ID token     │
      └────────┬────────────┘
                │
                ▼
┌─ Client envoie POST /api/auth/register ──┐
│ Body: {                                   │
│   uid: "<firebase-uid>",                  │
│   phone: "<phone-number>",                │
│   fcm_token: "<device-fcm>"               │
│   ...                                     │
│ }                                         │
│ Header: Authorization: Bearer <id-token> │
└────────┬─────────────────────────────────┘
         │
         ▼
┌─ Serveur /auth/register ────────────────────┐
│ 1. Vérifie ID token via Firebase Admin      │
│ 2. Récupère phone du token (claim)          │
│ 3. Insère/MAJ user dans MySQL               │
│ 4. Retourne user_id, JWT token courant      │
│                                              │
│ Réponse: { alanyaID, token }                │
└────────┬─────────────────────────────────┘
         │
         ▼
┌─ Utilisateur authentifié ─────────────┐
│ Utilise token dans tous les requests  │
│ Header: Authorization: Bearer <token> │
└──────────────────────────────────────┘
```

### Mapping Firebase → MySQL

⚠️ **Point critique** : Il y a deux sources pour le phone :

1. **OTP Firebase** : `decoded.phone_number` (claim natif)
2. **Google Sign-In** : `decoded.talky_phone` (custom claim, posé par `/auth/register`)

Code du middleware [auth.js](src/middleware/auth.js) :
```javascript
const phone = decoded.phone_number ?? decoded.talky_phone ?? null;
```

### Sécurité implémentée

| Aspect | Implémentation | Status |
|--------|-----------------|--------|
| **Authentification** | Firebase Admin SDK (vérification ID token) | ✅ |
| **JWT Verification** | Middleware sur toutes les routes protégées | ✅ |
| **CORS** | Configuré (actuellement tout accepté) | ⚠️ |
| **Validation entrées** | express-validator sur routes | ✅ |
| **Gestion erreurs centralisée** | Middleware errorHandler.js | ✅ |
| **Password hashing** | N/A (Firebase handles) | ✅ |
| **Rate limiting** | ❌ À implémenter |
| **HTTPS/SSL** | À activer en production | ✅ |
| **Secrets** | Variables d'env (.env) | ✅ |

### À sécuriser avant production

```
[ ] Restreindre CORS accept list aux domaines connus
[ ] Implémenter rate limiting (express-rate-limit)
[ ] Activer HTTPS/SSL (certificat Let's Encrypt)
[ ] Configurer sauvegardes BD régulières
[ ] Monitorer logs et erreurs
[ ] Ajouter logging détaillé des actions critiques
[ ] Implémenter 2FA optionnel
[ ] Audit des permissions Firebase
[ ] Tester injection SQL/XSS
```

---

## � Base de Données MySQL

### Tables principales

```sql
-- Utilisateurs
users (
  alanyaID,         -- PK (UUID)
  Firebase_UID,     -- FK Firebase
  alanyaPhone,      -- Unique, used for mapping
  nom,
  pseudo,
  avatar_url,
  fcm_token,        -- Pour notifications push
  is_online,        -- Boolean, mis à jour par Socket.IO
  last_seen,        -- Timestamp
  is_excluded,      -- Soft delete
  created_at,
  updated_at
)

-- Conversations (1-à-1 et groupes)
conversation (
  conversationID,   -- PK (UUID)
  name,             -- Null pour 1-à-1, requis pour groupes
  type,             -- "direct" ou "group"
  created_by_ID,    -- FK users.alanyaID
  is_pinned,
  is_archived,
  created_at
)

-- Participants des conversations
conv_participants (
  conversation_participant_ID,  -- PK
  conversationID,   -- FK conversation
  userID,           -- FK users.alanyaID
  joined_at
)

-- Messages
message (
  message_ID,       -- PK (UUID)
  conversationID,   -- FK conversation
  senderID,         -- FK users.alanyaID
  content,
  type,             -- 0=text, 1=image, 2=video, 3=audio, 4=file
  mediaUrl,
  replyTo_ID,       -- FK message (nullable, threading)
  editedAt,
  deletedAt,        -- Soft delete
  sentAt,
  status_sent,      -- "sent", "delivered", "read"
  created_at
)

-- Statuts/Stories
statut (
  statutID,         -- PK
  userID,           -- FK users.alanyaID
  content,
  type,             -- "text", "image", "video"
  background_color, -- Hex color ou path
  created_at,
  expires_at        -- 24h après creation
)

-- Vues des statuts
statut_views (
  view_ID,
  statutID,         -- FK statut
  viewerID,         -- FK users.alanyaID
  viewed_at
)

-- Historique appels
callHistory (
  callHistoryID,    -- PK
  callerID,         -- FK users.alanyaID
  recipientID,      -- FK users.alanyaID
  call_type,        -- "audio", "video", "screen-share"
  duration_seconds,
  status,           -- "missed", "answered", "rejected"
  startedAt,
  endedAt
)

-- Réunions
meeting (
  meetingID,        -- PK
  title,
  description,
  created_by_ID,    -- FK users.alanyaID
  scheduled_at,
  duration_min,
  meeting_type,     -- "audio", "video", "screen"
  started_at,
  ended_at,
  created_at
)

-- Participants des réunions
participant (
  participantID,    -- PK
  meetingID,        -- FK meeting
  userID,           -- FK users.alanyaID
  status,           -- "invited", "accepted", "declined", "attended"
  joined_at
)

-- Utilisateurs bloqués
blocked (
  blockedID,        -- PK
  blocker_ID,       -- FK users.alanyaID
  blocked_user_ID,  -- FK users.alanyaID
  created_at
)

-- Autres
pays (id, name, code, flag_emoji)
preferredContact (id, userID, contactID)
userAccess (id, userID, login_at, logout_at)
```

### Indexes recommandés

```sql
-- Pour recherche
CREATE INDEX idx_users_phone ON users(alanyaPhone);
CREATE INDEX idx_users_pseudo ON users(pseudo);

-- Pour conversations
CREATE INDEX idx_conv_user_participants ON conv_participants(userID);
CREATE INDEX idx_message_conversation ON message(conversationID);
CREATE INDEX idx_message_sender ON message(senderID);

-- Pour statut
CREATE INDEX idx_statut_user ON statut(userID);
CREATE INDEX idx_statut_expires ON statut(expires_at);

-- Pour appels
CREATE INDEX idx_callHistory_caller ON callHistory(callerID);
CREATE INDEX idx_callHistory_recipient ON callHistory(recipientID);
```

---

## 🚀 Déploiement

### Sur Render (gratuit)
1. Crée repo GitHub avec ce code
2. Va sur [render.com](https://render.com)
3. **New** → **Web Service**
4. Select repo `talky-backend`
5. Configure :
   - **Name** : `talky-backend`
   - **Runtime** : Node
   - **Build Command** : `npm install`
   - **Start Command** : `npm start`
6. Clique **Create Web Service**
7. Récupère l'URL : `https://talky-backend.onrender.com`

### Variables d'environnement sur Render
Ajoute dans les **Environment Variables** :
```
DB_HOST=163.123.183.89
DB_PORT=3306
DB_NAME=alanyBD2027
DB_USER=Chris
DB_PASSWORD=KENDRA2026
PORT=3000
NODE_ENV=production
JWT_SECRET=<ta-clé-secrète>
FIREBASE_SERVICE_ACCOUNT=<json-stringifié>
```

### Alternative : Railway
Plus rapide et plus fiable que le plan gratuit Render.

---

## 🧪 Tests

### Test connexion BD
```bash
mysql -h 163.123.183.89 -u Chris -p alanyBD2027 -e "SELECT COUNT(*) FROM users;"
```

### Test serveur
```bash
curl http://localhost:3000/api/users/search?q=test
# Doit retourner 401 (pas de token)
```

### Test Socket.IO
```javascript
const io = require('socket.io-client');
const socket = io('http://localhost:3000');
socket.on('connect', () => console.log('Connected!'));
```

---

## 📝 Logs & Debugging

Activer plus de logs :
```bash
DEBUG=* npm start
```

Les erreurs sont capturées par le middleware centralisé dans `src/middleware/errorHandler.js`.

---

## 📦 Dependencies principales

| Package | Version | Rôle |
|---------|---------|------|
| express | 4.22.1 | Framework HTTP |
| socket.io | 4.7.5 | WebSocket real-time |
| firebase-admin | 13.7.0 | Auth + FCM |
| mysql2 | 3.22.1 | Database |
| jsonwebtoken | 9.0.3 | JWT tokens |
| express-validator | 7.3.2 | Validation |
| cors | 2.8.6 | Cross-origin |
| dotenv | 17.3.1 | Config env |

---

## ❓ FAQ & Dépannage

### Q: Pourquoi MySQL et pas Firestore ?
**A:** Performance, coûts contrôlés, queries complexes, et possibilité de JOINs sophistiqués.

### Q: Comment fonctionne le mapping Firebase → MySQL ?
**A:** 
- **OTP Firebase** : `decoded.phone_number` (claim natif)
- **Google Sign-In** : `decoded.talky_phone` (custom claim posé par `/auth/register`)
- Le middleware [auth.js](src/middleware/auth.js) utilise : `phone = decoded.phone_number ?? decoded.talky_phone`

### Q: Les appels fonctionnent hors ligne ?
**A:** 
- FCM les notifie même offline
- Les clients doivent accepter l'appel dans les ~30 secondes
- Passé ce délai, marked comme "missed"

### Q: Comment scaler à 100k+ users ?
**A:**
- Redis pour caching (sessions, conversations)
- DB read replicas + load balancing
- Socket.IO clustering (redis adapter)
- CDN pour assets/images
- Sharding de la BD (par userID)

### Q: Erreur "No phone claim in token"
**A:** 
- Vérifier que Firebase custom claims sont posés correctement
- Pour OTP : Firebase doit posséder `phone_number`
- Pour Google : POST `/auth/register` doit poser `talky_phone`

### Q: Socket.IO events ne s'émettent pas
**A:**
- Vérifier token JWT dans `socket.io`
- Debug event listeners : `socket.onAny((event, ...args) => console.log(event, args));`
- Vérifier userSockets map : `app.get('userSockets').get(userId)`

### Q: FCM notifications ne partent pas
**A:**
- Vérifier `fcm_token` en BD : `SELECT fcm_token FROM users WHERE alanyaID = '...';`
- Vérifier credentials Firebase bien loadés
- Test avec `/api/notify/test` endpoint

### Q: Impossible de se connecter à MySQL
**A:**
```bash
# Test connexion
mysql -h 163.123.183.89 -u Chris -p alanyBD2027 -e "SHOW TABLES;"

# Ou depuis Node
const pool = require('./src/config/db');
pool.execute('SELECT 1').catch(e => console.error(e.message));
```

---

## 🔗 Ressources & Références

- [Express.js Documentation](https://expressjs.com/)
- [Socket.IO Guide](https://socket.io/docs/)
- [Firebase Admin SDK](https://firebase.google.com/docs/admin/setup)
- [WebRTC API](https://developer.mozilla.org/en-US/docs/Web/API/WebRTC_API)
- [MySQL Connection Pooling](https://github.com/mysqljs/mysql)

---

## 🤝 Support & Issues

Pour signaler un bug ou suggérer une fonctionnalité :
1. Ouvre une issue GitHub
2. Décris le problème + étapes de reproduction
3. Mentionne la version Node.js, OS, et dépendances

Ou contacte l'équipe de développement.

---

## 📄 Licence

MIT - Libre d'utilisation et de modification