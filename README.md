# Talky Signaling Server — Déploiement sur Render

## Étapes

### 1. Créer un repo GitHub
```bash
cd talky_signaling_server
git init
git add .
git commit -m "Talky signaling server"
# Créer un repo sur github.com et pousser
git remote add origin https://github.com/TON_USERNAME/talky-signaling.git
git push -u origin main
```

### 2. Déployer sur Render
1. Va sur [render.com](https://render.com) → Sign up (gratuit)
2. **New** → **Web Service**
3. Connecte ton repo GitHub `talky-signaling`
4. Configure :
   - **Name** : `talky-signaling`
   - **Runtime** : Node
   - **Build Command** : `npm install`
   - **Start Command** : `npm start`
   - **Plan** : Free
5. Clique **Create Web Service**

### 3. Récupérer l'URL
Render te donne une URL du type :
```
https://talky-signaling.onrender.com
```

👉 **Copie cette URL** et remplace `SIGNALING_SERVER_URL` dans `call_service.dart`

## Notes
- Le plan gratuit de Render **s'endort** après 15 min d'inactivité
- Premier appel après inactivité = ~30s de délai (cold start)
- Pour éviter ça : upgrade à $7/mois ou utiliser Railway