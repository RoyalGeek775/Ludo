// ============================================
// LUDO ROYAL — Lobby Logic
// ============================================

const DICE_EMOJIS = ['⚀','⚁','⚂','⚃','⚄','⚅'];

function generateRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from({length: 6}, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

function showToast(msg, type = '') {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = 'toast show ' + type;
  clearTimeout(t._timeout);
  t._timeout = setTimeout(() => { t.className = 'toast'; }, 3000);
}

function validateName(name) {
  const n = name.trim();
  if (!n) { showToast('Please enter your name', 'red'); return null; }
  if (n.length < 2) { showToast('Name must be at least 2 characters', 'red'); return null; }
  return n;
}

// Player count selector
let selectedCount = 2;
document.querySelectorAll('.pcs-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.pcs-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    selectedCount = parseInt(btn.dataset.count);
  });
});

// ============================================
// FIREBASE-BASED ROOM MANAGEMENT
// ============================================

function getDB() {
  return firebase.database();
}

// CREATE ROOM
document.getElementById('createRoomBtn').addEventListener('click', async () => {
  const name = validateName(document.getElementById('hostName').value);
  if (!name) return;

  const code = generateRoomCode();
  const playerId = 'p_' + Math.random().toString(36).substr(2, 9);

  // Store in sessionStorage
  sessionStorage.setItem('ludo_playerId', playerId);
  sessionStorage.setItem('ludo_playerName', name);
  sessionStorage.setItem('ludo_roomCode', code);
  sessionStorage.setItem('ludo_isHost', 'true');

  try {
    const db = getDB();
    const roomRef = db.ref(`rooms/${code}`);

    await roomRef.set({
      code,
      hostId: playerId,
      maxPlayers: selectedCount,
      status: 'waiting',
      createdAt: Date.now(),
      players: {
        [playerId]: {
          id: playerId,
          name,
          color: null,
          ready: false,
          joinedAt: Date.now()
        }
      }
    });

    // Set up cleanup on disconnect
    roomRef.onDisconnect().remove();

    showToast('Room created! 🎉', 'gold');
    window.location.href = `game.html?room=${code}`;
  } catch (err) {
    console.error('Create room error:', err);
    showToast('Could not create room. Check Firebase config.', 'red');
    showFirebaseHelp();
  }
});

// JOIN ROOM
document.getElementById('joinRoomBtn').addEventListener('click', async () => {
  const name = validateName(document.getElementById('joinName').value);
  if (!name) return;

  const code = document.getElementById('roomCodeInput').value.trim().toUpperCase();
  if (code.length !== 6) { showToast('Enter a valid 6-character room code', 'red'); return; }

  const playerId = 'p_' + Math.random().toString(36).substr(2, 9);

  try {
    const db = getDB();
    const roomRef = db.ref(`rooms/${code}`);
    const snapshot = await roomRef.get();

    if (!snapshot.exists()) {
      showToast('Room not found!', 'red'); return;
    }

    const roomData = snapshot.val();
    if (roomData.status !== 'waiting') {
      showToast('Game already started!', 'red'); return;
    }

    const players = roomData.players || {};
    const playerCount = Object.keys(players).length;

    if (playerCount >= roomData.maxPlayers) {
      showToast('Room is full!', 'red'); return;
    }

    // Join room
    await roomRef.child(`players/${playerId}`).set({
      id: playerId,
      name,
      color: null,
      ready: false,
      joinedAt: Date.now()
    });

    roomRef.child(`players/${playerId}`).onDisconnect().remove();

    sessionStorage.setItem('ludo_playerId', playerId);
    sessionStorage.setItem('ludo_playerName', name);
    sessionStorage.setItem('ludo_roomCode', code);
    sessionStorage.setItem('ludo_isHost', 'false');

    showToast('Joining room...', 'gold');
    window.location.href = `game.html?room=${code}`;
  } catch (err) {
    console.error('Join room error:', err);
    showToast('Could not join room. Check Firebase config.', 'red');
    showFirebaseHelp();
  }
});

// Enter key support
document.getElementById('roomCodeInput').addEventListener('keydown', e => {
  if (e.key === 'Enter') document.getElementById('joinRoomBtn').click();
});
document.getElementById('hostName').addEventListener('keydown', e => {
  if (e.key === 'Enter') document.getElementById('createRoomBtn').click();
});
document.getElementById('joinName').addEventListener('keydown', e => {
  if (e.key === 'Enter') document.getElementById('joinRoomBtn').click();
});

// Wait for Firebase to be ready
document.addEventListener('firebase-ready', () => {
  console.log('Firebase ready');
});

function showFirebaseHelp() {
  const existingHelp = document.getElementById('firebase-help');
  if (existingHelp) return;

  const help = document.createElement('div');
  help.id = 'firebase-help';
  help.style.cssText = `
    position: fixed; top: 20px; left: 50%; transform: translateX(-50%);
    background: #16132e; border: 1px solid #f4b942; border-radius: 16px;
    padding: 24px; max-width: 500px; width: 90%; z-index: 9999;
    font-family: 'Nunito', sans-serif; color: #f0eeff;
    box-shadow: 0 8px 32px rgba(0,0,0,0.5);
  `;
  help.innerHTML = `
    <h3 style="color:#f4b942; font-size:1.1rem; margin-bottom:12px;">⚙️ Firebase Setup Required</h3>
    <p style="font-size:0.9rem; color:#9b96c0; line-height:1.6;">
      To enable real-time multiplayer, you need a free Firebase project:
    </p>
    <ol style="font-size:0.85rem; color:#9b96c0; margin:12px 0; padding-left:20px; line-height:2;">
      <li>Go to <a href="https://console.firebase.google.com" target="_blank" style="color:#f4b942;">console.firebase.google.com</a></li>
      <li>Create a new project (it's free!)</li>
      <li>Add a Realtime Database → Start in <strong>test mode</strong></li>
      <li>Get your config from Project Settings → Your apps</li>
      <li>Update <code style="background:rgba(255,255,255,0.1); padding:2px 6px; border-radius:4px;">firebase-config.js</code> with your config</li>
    </ol>
    <div style="display:flex; gap:10px; margin-top:16px;">
      <button onclick="this.closest('#firebase-help').remove()" style="
        background: #f4b942; color: #000; border: none; border-radius: 8px;
        padding: 8px 16px; cursor: pointer; font-weight: 800; font-family: inherit;
      ">Got it!</button>
      <a href="https://console.firebase.google.com" target="_blank" style="
        background: transparent; color: #f4b942; border: 1px solid #f4b942;
        border-radius: 8px; padding: 8px 16px; font-weight: 700; text-decoration: none;
        font-size: 0.9rem; display: flex; align-items: center;
      ">Open Firebase →</a>
    </div>
  `;
  document.body.appendChild(help);
}
