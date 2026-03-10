// ============================================
// LUDO ROYAL — Game Page Logic
// Real-time multiplayer via Firebase
// ============================================

// ============================================
// STATE
// ============================================
let db, roomRef, gameRef, chatRef;
let engine = null;
let renderer = null;
let myPlayerId, myPlayerName, roomCode, isHost;
let myColor = null;
let playerColors = {};  // playerId -> color
let roomData = null;
let pendingRoll = null;
let gameStarted = false;
let gameListenerActive = false;
let chatListenerActive = false;

const DICE_EMOJIS = ['⚀','⚁','⚂','⚃','⚄','⚅'];

// ============================================
// INIT
// ============================================
document.addEventListener('firebase-ready', init);

async function init() {
  const params = new URLSearchParams(window.location.search);
  roomCode = params.get('room') || sessionStorage.getItem('ludo_roomCode');
  myPlayerId = sessionStorage.getItem('ludo_playerId');
  myPlayerName = sessionStorage.getItem('ludo_playerName');
  isHost = sessionStorage.getItem('ludo_isHost') === 'true';

  if (!roomCode || !myPlayerId) {
    window.location.href = 'index.html';
    return;
  }

  db = firebase.database();
  roomRef = db.ref(`rooms/${roomCode}`);
  gameRef = db.ref(`games/${roomCode}`);
  chatRef = db.ref(`chats/${roomCode}`);

  // Init canvas renderer
  const canvas = document.getElementById('ludoCanvas');
  renderer = new LudoRenderer(canvas);
  renderer.drawBoard(null, null);

  // Set room code display
  document.getElementById('displayRoomCode').textContent = roomCode;
  document.getElementById('roomCodeDisplay').textContent = roomCode;

  // Copy buttons
  document.getElementById('copyCodeBtn').addEventListener('click', copyCode);
  document.getElementById('copyBtn2').addEventListener('click', copyCode);

  // Start listening to room
  listenToRoom();

  // Disconnect cleanup
  roomRef.child(`players/${myPlayerId}`).onDisconnect().remove();

  // Handle game over buttons
  document.getElementById('playAgainBtn').addEventListener('click', playAgain);
  document.getElementById('backToLobbyBtn').addEventListener('click', () => { window.location.href = 'index.html'; });
  document.getElementById('leaveWaitingBtn').addEventListener('click', leaveRoom);

  // Chat
  document.getElementById('sendChatBtn').addEventListener('click', sendChat);
  document.getElementById('chatInput').addEventListener('keydown', e => {
    if (e.key === 'Enter') sendChat();
  });

  // Roll dice button
  document.getElementById('rollDiceBtn').addEventListener('click', handleRollDice);

  // Listen for chat
  listenToChat();
}

function copyCode() {
  navigator.clipboard.writeText(roomCode).then(() => {
    showToast('Room code copied! 📋', 'gold');
  });
}

// ============================================
// ROOM LISTENER
// ============================================
function listenToRoom() {
  roomRef.on('value', (snapshot) => {
    if (!snapshot.exists()) {
      showToast('Room closed', 'red');
      setTimeout(() => { window.location.href = 'index.html'; }, 2000);
      return;
    }

    roomData = snapshot.val();
    updateWaitingRoom(roomData);

    if (roomData.status === 'playing' && !gameStarted) {
      gameStarted = true;
      startGame(roomData);
    }
  });
}

function updateWaitingRoom(data) {
  const players = data.players || {};
  const playerList = Object.values(players).sort((a, b) => a.joinedAt - b.joinedAt);

  const colorKeys = ['red', 'blue', 'green', 'yellow'];
  const slotsEl = document.getElementById('playerSlots');
  slotsEl.innerHTML = '';

  for (let i = 0; i < data.maxPlayers; i++) {
    const p = playerList[i];
    const color = colorKeys[i];
    const colorDef = COLORS[color];
    const slot = document.createElement('div');
    slot.className = `player-slot ${p ? 'filled' : ''}`;
    slot.style.color = colorDef.primary;
    slot.innerHTML = `
      <div class="slot-dot"></div>
      <span class="slot-name">${p ? escapeHtml(p.name) : 'Waiting...'}</span>
      <span class="slot-label">${colorDef.label} ${p?.id === myPlayerId ? '(You)' : ''}</span>
    `;
    slotsEl.appendChild(slot);
  }

  const count = playerList.length;
  const needed = data.maxPlayers;
  document.getElementById('waitingInfo').textContent =
    count < needed ? `${count}/${needed} players joined` : 'All players joined!';

  // Show start button for host
  const startBtn = document.getElementById('startGameBtn');
  if (isHost && count >= 2) {
    startBtn.style.display = 'flex';
    startBtn.onclick = () => startGameAsHost(data, playerList);
  } else {
    startBtn.style.display = 'none';
  }

  if (data.status !== 'waiting') {
    document.getElementById('waitingOverlay').classList.add('hidden');
  }
}

async function startGameAsHost(data, playerList) {
  const colorKeys = ['red', 'blue', 'green', 'yellow'];
  const assignedColors = {};
  const pColors = [];

  playerList.forEach((p, i) => {
    assignedColors[p.id] = colorKeys[i];
    pColors.push(colorKeys[i]);
  });

  // Initialize engine
  const eng = new LudoEngine(pColors);
  const gameState = eng.serialize();

  await gameRef.set({
    playerColors: assignedColors,
    colors: pColors,
    state: gameState,
    startedAt: Date.now(),
    turn: eng.currentColor,
    diceRolled: false
  });

  await roomRef.update({ status: 'playing' });
}

// ============================================
// GAME START
// ============================================
function startGame(roomData) {
  document.getElementById('waitingOverlay').classList.add('hidden');

  gameRef.get().then(snap => {
    if (!snap.exists()) return;
    const gameData = snap.val();

    // Find my color
    const assigned = gameData.playerColors || {};
    myColor = assigned[myPlayerId] || null;

    // Build engine from state
    engine = LudoEngine.deserialize(gameData.state);

    // Build player color map
    playerColors = gameData.playerColors;

    renderer.drawBoard(engine, myColor);
    updatePlayersPanel();
    updateTurnUI();

    // Listen for game state changes
    if (!gameListenerActive) {
      gameListenerActive = true;
      gameRef.on('value', onGameUpdate);
    }
  });
}

// ============================================
// GAME STATE LISTENER
// ============================================
function onGameUpdate(snapshot) {
  if (!snapshot.exists()) return;
  const gameData = snapshot.val();
  if (!gameData.state) return;

  // Rebuild engine
  engine = LudoEngine.deserialize(gameData.state);

  if (!myColor) {
    const assigned = gameData.playerColors || {};
    myColor = assigned[myPlayerId] || null;
    playerColors = gameData.playerColors;
  }

  renderer.drawBoard(engine, myColor);
  updatePlayersPanel();
  updateTurnUI();

  if (engine.gameOver) {
    showGameOver();
  }
}

// ============================================
// TURN UI
// ============================================
function updateTurnUI() {
  if (!engine) return;

  const currentColor = engine.currentColor;
  const colorDef = COLORS[currentColor];
  const isMyTurn = (currentColor === myColor);

  // Turn text
  const turnText = document.getElementById('turnText');
  if (isMyTurn) {
    turnText.textContent = 'Your Turn!';
    turnText.style.color = colorDef.primary;
  } else {
    const currentPlayerName = getPlayerNameByColor(currentColor);
    turnText.textContent = `${currentPlayerName}'s Turn`;
    turnText.style.color = colorDef.primary;
  }

  // Roll button
  const rollBtn = document.getElementById('rollDiceBtn');
  const diceResult = document.getElementById('diceResult');

  if (isMyTurn && !engine.gameOver) {
    // Check if this player needs to pick a piece (roll already done)
    gameRef.get().then(snap => {
      if (!snap.exists()) return;
      const gd = snap.val();
      if (gd.diceRolled && gd.pendingMove && gd.pendingMove.color === myColor) {
        rollBtn.disabled = true;
        rollBtn.textContent = 'Choose Piece';
        diceResult.textContent = `You rolled a ${gd.pendingMove.roll}`;
        showMoveModal(gd.pendingMove.roll);
      } else if (!gd.diceRolled) {
        rollBtn.disabled = false;
        rollBtn.textContent = '🎲 Roll Dice';
        diceResult.textContent = '';
      }
    });
  } else {
    rollBtn.disabled = true;
    rollBtn.textContent = isMyTurn ? '🎲 Roll Dice' : 'Wait...';
  }
}

function getPlayerNameByColor(color) {
  if (!playerColors) return color;
  const playerId = Object.keys(playerColors).find(id => playerColors[id] === color);
  if (!playerId) return color;
  const players = (roomData && roomData.players) || {};
  return players[playerId]?.name || color;
}

function updatePlayersPanel() {
  if (!engine || !playerColors) return;

  const panel = document.getElementById('playerInfoList');
  panel.innerHTML = '';

  engine.playerColors.forEach(color => {
    const colorDef = COLORS[color];
    const isCurrentTurn = (color === engine.currentColor);
    const playerId = Object.keys(playerColors).find(id => playerColors[id] === color);
    const players = (roomData && roomData.players) || {};
    const playerName = players[playerId]?.name || colorDef.label;
    const isMe = playerId === myPlayerId;

    const finished = engine.pieces[color].filter(p => p.isFinished()).length;
    const active  = engine.pieces[color].filter(p => p.isActive()).length;
    const home    = engine.pieces[color].filter(p => p.isHome()).length;

    const item = document.createElement('div');
    item.className = `player-info-item ${isCurrentTurn ? 'active-turn' : ''}`;
    item.style.color = colorDef.primary;
    item.innerHTML = `
      <div class="player-color-dot" style="background:${colorDef.primary}"></div>
      <div>
        <div class="player-info-name">
          ${escapeHtml(playerName)}
          ${isMe ? '<span class="you-badge">YOU</span>' : ''}
        </div>
        <div class="player-info-pieces">🏠${home} 🚀${active} ✅${finished}</div>
      </div>
    `;
    panel.appendChild(item);
  });
}

// ============================================
// DICE ROLLING
// ============================================
async function handleRollDice() {
  if (!engine || engine.gameOver) return;
  if (engine.currentColor !== myColor) return;

  const rollBtn = document.getElementById('rollDiceBtn');
  rollBtn.disabled = true;

  // Animate dice
  const die = document.getElementById('die1');
  die.classList.add('rolling');

  await new Promise(r => setTimeout(r, 550));
  die.classList.remove('rolling');

  const roll = Math.floor(Math.random() * 6) + 1;
  die.textContent = DICE_EMOJIS[roll - 1];

  document.getElementById('diceResult').textContent = `Rolled: ${roll}`;
  showToast(`You rolled a ${roll}!`, roll === 6 ? 'gold' : '');

  // Check if any piece can move
  const movable = engine.getMovablePieces(myColor, roll);

  if (movable.length === 0) {
    // No moves, skip turn
    showToast('No moves available, turn skipped', '');

    // Send system message
    sendSystemMessage(`${myPlayerName} rolled ${roll} but had no moves.`);

    // Advance turn in DB
    const newEngine = LudoEngine.deserialize(engine.serialize());
    newEngine.lastRoll = null;
    if (roll !== 6) {
      newEngine.advanceTurn();
    }

    await gameRef.update({
      state: newEngine.serialize(),
      turn: newEngine.currentColor,
      diceRolled: false,
      pendingMove: null
    });
    return;
  }

  if (movable.length === 1) {
    // Auto-move the only piece
    await performMove(roll, movable[0].id, false);
    return;
  }

  // Multiple movable pieces - show modal
  await gameRef.update({
    diceRolled: true,
    pendingMove: { color: myColor, roll, timestamp: Date.now() }
  });

  showMoveModal(roll);
}

function showMoveModal(roll) {
  if (!engine) return;
  const movable = engine.getMovablePieces(myColor, roll);
  if (movable.length === 0) return;

  document.getElementById('rolledValue').textContent = roll;
  document.getElementById('moveModalText').innerHTML =
    `You rolled a <strong>${DICE_EMOJIS[roll-1]} ${roll}</strong>. Select which piece to move:`;

  const optionsEl = document.getElementById('moveOptions');
  optionsEl.innerHTML = '';

  const colorDef = COLORS[myColor];

  movable.forEach(piece => {
    const btn = document.createElement('button');
    btn.className = 'move-option-btn';
    btn.style.color = colorDef.primary;
    btn.style.borderColor = colorDef.primary;

    let label = '';
    if (piece.isHome()) {
      label = `Piece ${piece.id + 1} (Enter board)`;
    } else {
      const [r, c] = piece.getGridPos();
      const newIdx = piece.pathIndex + roll;
      if (newIdx >= 57) {
        label = `Piece ${piece.id + 1} → 🏁 Finish!`;
      } else {
        label = `Piece ${piece.id + 1} (Move ${roll} steps)`;
      }
    }

    btn.textContent = label;
    btn.addEventListener('click', async () => {
      hideModal('moveModal');
      await performMove(roll, piece.id, true);
    });
    optionsEl.appendChild(btn);
  });

  document.getElementById('skipMoveBtn').onclick = async () => {
    hideModal('moveModal');
    const newEngine = LudoEngine.deserialize(engine.serialize());
    newEngine.advanceTurn();
    await gameRef.update({
      state: newEngine.serialize(),
      turn: newEngine.currentColor,
      diceRolled: false,
      pendingMove: null
    });
  };

  showModal('moveModal');
}

async function performMove(roll, pieceId, fromModal) {
  const newEngine = LudoEngine.deserialize(engine.serialize());
  const result = newEngine.movePiece(myColor, pieceId, roll);

  let msg = `${myPlayerName} moved ${COLORS[myColor].label} Piece ${pieceId + 1}`;

  if (result.result === 'finished') {
    msg += ` 🏁 finished!`;
    showToast('Piece reached home! 🏁', 'gold');
  } else if (result.result === 'entered') {
    msg += ` entered the board!`;
    showToast('Piece entered the board!', 'gold');
  }

  if (result.killedPiece) {
    const killedColor = COLORS[result.killedPiece.color].label;
    msg += ` (killed ${killedColor} piece!)`;
    showToast(`You killed a ${killedColor} piece! 💀`, 'gold');
  }

  if (result.giveExtraTurn && result.result !== 'finished') {
    showToast('Got a 6! Extra turn! 🎲', 'gold');
  }

  sendSystemMessage(msg);

  await gameRef.update({
    state: newEngine.serialize(),
    turn: newEngine.currentColor,
    diceRolled: false,
    pendingMove: null
  });

  if (newEngine.gameOver) {
    await gameRef.update({ gameOver: true });
  }
}

// ============================================
// GAME OVER
// ============================================
function showGameOver() {
  if (!engine) return;

  const rankings = engine.rankings;
  const rankingsEl = document.getElementById('rankings');
  rankingsEl.innerHTML = '';

  const medals = ['🥇', '🥈', '🥉', '4️⃣'];

  rankings.forEach((r, i) => {
    const colorDef = COLORS[r.color];
    const playerName = getPlayerNameByColor(r.color);
    const item = document.createElement('div');
    item.className = 'ranking-item';
    item.innerHTML = `
      <span class="ranking-pos">${medals[i] || (i+1)}</span>
      <div class="ranking-dot" style="background:${colorDef.primary}"></div>
      <span class="ranking-name">${escapeHtml(playerName)} ${r.color === myColor ? '(You)' : ''}</span>
    `;
    rankingsEl.appendChild(item);
  });

  const winner = rankings[0];
  if (winner) {
    const winnerName = getPlayerNameByColor(winner.color);
    document.getElementById('gameOverTitle').textContent = `${winnerName} Wins! 🎉`;
    document.getElementById('gameOverSubtitle').textContent =
      winner.color === myColor ? 'Congratulations!' : `Better luck next time!`;
  }

  document.getElementById('gameOverOverlay').classList.remove('hidden');
}

async function playAgain() {
  document.getElementById('gameOverOverlay').classList.add('hidden');
  if (isHost) {
    await roomRef.update({ status: 'waiting' });
    gameStarted = false;
    await gameRef.remove();
  }
  window.location.reload();
}

// ============================================
// CHAT
// ============================================
function listenToChat() {
  if (chatListenerActive) return;
  chatListenerActive = true;

  chatRef.limitToLast(100).on('child_added', (snap) => {
    const msg = snap.val();
    displayChatMessage(msg);
  });
}

function sendChat() {
  const input = document.getElementById('chatInput');
  const text = input.value.trim();
  if (!text) return;
  input.value = '';

  chatRef.push({
    senderId: myPlayerId,
    senderName: myPlayerName,
    senderColor: myColor || 'red',
    text,
    timestamp: Date.now(),
    type: 'chat'
  });
}

function sendSystemMessage(text) {
  chatRef.push({
    senderId: 'system',
    text,
    timestamp: Date.now(),
    type: 'system'
  });
}

function displayChatMessage(msg) {
  const container = document.getElementById('chatMessages');
  const div = document.createElement('div');

  if (msg.type === 'system') {
    div.className = 'chat-msg system';
    div.textContent = msg.text;
  } else {
    const isOwn = msg.senderId === myPlayerId;
    div.className = `chat-msg ${isOwn ? 'own' : ''}`;

    const colorDef = COLORS[msg.senderColor] || { primary: '#9b96c0' };
    const time = new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    div.innerHTML = `
      <div class="chat-msg-name" style="color:${colorDef.primary}">${escapeHtml(msg.senderName)}</div>
      <div class="chat-msg-text">${escapeHtml(msg.text)}</div>
      <div class="chat-msg-time">${time}</div>
    `;
  }

  container.appendChild(div);
  container.scrollTop = container.scrollHeight;
}

// ============================================
// UTILITY
// ============================================
function showModal(id) {
  document.getElementById(id).classList.remove('hidden');
}
function hideModal(id) {
  document.getElementById(id).classList.add('hidden');
}

function showToast(msg, type = '') {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = 'toast show ' + type;
  clearTimeout(t._timeout);
  t._timeout = setTimeout(() => { t.className = 'toast'; }, 3200);
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

async function leaveRoom() {
  await roomRef.child(`players/${myPlayerId}`).remove();
  window.location.href = 'index.html';
}
