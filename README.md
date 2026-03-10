# 🎲 Ludo Royal — Free Online Multiplayer Ludo

A complete, real-time multiplayer Ludo game built with vanilla HTML/CSS/JS and Firebase Realtime Database.

## ✨ Features
- 🎮 **2–4 Player Multiplayer** via Room Codes
- ⚡ **Real-Time Gameplay** — moves sync instantly
- 💬 **In-Game Chat** with player colors
- 🏆 **Full Ludo Rules** — safe squares, kills, home stretch, rankings
- 🎲 **Animated Dice** with extra-turn on 6
- 🆓 **100% Free** — Firebase free tier + GitHub Pages

---

## 🚀 Setup Guide (5 minutes)

### 1. Firebase Setup (Free)
1. Go to [https://console.firebase.google.com](https://console.firebase.google.com)
2. Click **"Add project"** → Name it (e.g. `ludo-royal`)
3. Disable Google Analytics (optional) → Create project
4. In the left sidebar: **Build → Realtime Database**
5. Click **"Create Database"** → Choose a region → Start in **"test mode"**
6. Go to **Project Settings** (⚙️ icon) → **Your apps** → `</>` (Web)
7. Register your app → Copy the `firebaseConfig` object

### 2. Update firebase-config.js
Replace the config in `firebase-config.js` with yours:

```javascript
const FIREBASE_CONFIG = {
  apiKey: "your-api-key",
  authDomain: "your-project.firebaseapp.com",
  databaseURL: "https://your-project-default-rtdb.firebaseio.com",
  projectId: "your-project",
  storageBucket: "your-project.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abc123"
};
```

### 3. Firebase Security Rules
In Realtime Database → Rules, use:

```json
{
  "rules": {
    ".read": true,
    ".write": true
  }
}
```
> ⚠️ This is test mode. For production, add proper auth rules.

### 4. Deploy to GitHub Pages
1. Create a new GitHub repository
2. Push all files to the repo
3. Go to **Settings → Pages**
4. Set source to **Deploy from branch → main / root**
5. Your game is live at `https://yourusername.github.io/repo-name/`

---

## 🎯 How to Play
1. One player creates a room and shares the 6-character code
2. Other players enter the code to join
3. Host clicks **Start Game** when everyone is ready
4. Players take turns rolling dice
5. Roll a **6** to get a piece on the board
6. Race all 4 pieces to the center!
7. **Kill** opponents by landing on their square
8. **Safe squares** (⭐) protect pieces from being killed

---

## 📁 File Structure
```
ludo-game/
├── index.html          # Lobby / home page
├── game.html           # Game page
├── style.css           # All styles
├── firebase-config.js  # Firebase setup (edit this!)
├── game-engine.js      # Ludo rules & canvas rendering
├── lobby.js            # Room create/join logic
├── game.js             # Real-time game logic & chat
└── README.md
```

---

## 🔧 Tech Stack
- **Frontend**: HTML5, CSS3, Vanilla JavaScript
- **Realtime**: Firebase Realtime Database (free tier)
- **Hosting**: GitHub Pages (free)
- **Rendering**: HTML5 Canvas

---

## 📜 License
MIT — free to use and modify!
