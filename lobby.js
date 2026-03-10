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

// Wait until Firebase is ready before wiring up buttons
function onFirebaseReady() {
  const db = firebase.database();

  // CREATE ROOM
  document.getElementById('createRoomBtn').addEventListener('click', async () => {
    const name = validateName(document.getElementById('hostName').value);
    if (!name) return;

    const code = generateRoomCode();
    const playerId = 'p_' + Math.random().toString(36).substr(2, 9);

    sessionStorage.setItem('ludo_playerId', playerId);
    sessionStorage.setItem('ludo_playerName', name);
    sessionStorage.setItem('ludo_roomCode', code);
    sessionStorage.setItem('ludo_isHost', 'true');

    try {
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

      roomRef.onDisconnect().remove();
      showToast('Room created! 🎉', 'gold');
      window.location.href = `game.html?room=${code}`;
    } catch (err) {
      console.error('Create room error:', err);
      if (err.code === 'PERMISSION_DENIED') {
        showToast('Permission denied — check Firebase rules!', 'red');
        showRulesHelp();
      } else {
        showToast('Error: ' + err.message, 'red');
      }
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
      if (err.code === 'PERMISSION_DENIED') {
        showToast('Permission denied — check Firebase rules!', 'red');
        showRulesHelp();
      } else {
        showToast('Error: ' + err.message, 'red');
      }
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

  console.log('✅ Firebase connected and lobby ready');
}

// Listen for firebase-ready event
document.addEventListener('firebase-ready', onFirebaseReady);

// Fallback: if firebase-ready already fired before this script ran
if (window._firebaseReady) {
  onFirebaseReady();
}

function showRulesHelp() {
  if (document.getElementById('rules-help')) return;
  const help = document.createElement('div');
  help.id = 'rules-help';
  help.style.cssText = `
    position: fixed; top: 20px; left: 50%; transform: translateX(-50%);
    background: #16132e; border: 2px solid #f4b942; border-radius: 16px;
    padding: 24px; max-width: 480px; width: 90%; z-index: 9999;
    font-family: 'Nunito', sans-serif; color: #f0eeff;
    box-shadow: 0 8px 32px rgba(0,0,0,0.6);
  `;
  help.innerHTML = `
    <h3 style="color:#f4b942; margin-bottom:12px;">🔒 Fix Firebase Rules</h3>
    <p style="color:#9b96c0; font-size:0.9rem; line-height:1.6; margin-bottom:12px;">
      Your database is blocking writes. Fix it in 30 seconds:
    </p>
    <ol style="color:#9b96c0; font-size:0.88rem; padding-left:20px; line-height:2.2;">
      <li>Open <a href="https://console.firebase.google.com/project/ludo-f404e/database" target="_blank" style="color:#f4b942;">Firebase Console → Realtime Database</a></li>
      <li>Click the <strong style="color:#fff">Rules</strong> tab</li>
      <li>Replace everything with:</li>
    </ol>
    <pre style="background:rgba(0,0,0,0.4); border:1px solid #2e2a55; border-radius:8px; padding:12px; margin:12px 0; font-size:0.85rem; color:#ffe082; overflow-x:auto;">{
  "rules": {
    ".read": true,
    ".write": true
  }
}</pre>
    <ol start="4" style="color:#9b96c0; font-size:0.88rem; padding-left:20px; line-height:2.2;">
      <li>Click <strong style="color:#fff">Publish</strong></li>
      <li>Come back and try again!</li>
    </ol>
    <button onclick="this.closest('#rules-help').remove()" style="
      margin-top:8px; background:#f4b942; color:#000; border:none; border-radius:8px;
      padding:10px 20px; cursor:pointer; font-weight:800; font-family:inherit; font-size:0.95rem;
    ">Got it!</button>
  `;
  document.body.appendChild(help);
}
