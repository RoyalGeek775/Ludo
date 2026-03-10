// ============================================
// LUDO ROYAL — Game Engine
// Complete Ludo game logic & canvas rendering
// ============================================

const COLORS = {
  red:    { primary: '#e63946', light: '#ffd6d9', dark: '#b02030', label: 'Red',    emoji: '🔴' },
  blue:   { primary: '#1d6fa4', light: '#d0e9f7', dark: '#155280', label: 'Blue',   emoji: '🔵' },
  green:  { primary: '#2a9d5c', light: '#c8f0dc', dark: '#1e7044', label: 'Green',  emoji: '🟢' },
  yellow: { primary: '#f4b942', light: '#fef3cc', dark: '#c48a10', label: 'Yellow', emoji: '🟡' }
};

const COLOR_KEYS = ['red', 'blue', 'green', 'yellow'];

// Board is 15x15 grid
const BOARD_SIZE = 15;
const SAFE_SQUARES = [1, 9, 14, 22, 27, 35, 40, 48]; // indices on path

// Each color's home positions (grid cells), home column, start square
const COLOR_CONFIG = {
  red: {
    homeBase: [[1,1],[1,2],[2,1],[2,2]], // top-left
    startSquare: 1,   // index on path
    homeColumn: 'left',
    homeRowCol: { row: 1, col: 1 },
    pieces: [0,1,2,3]
  },
  blue: {
    homeBase: [[1,12],[1,13],[2,12],[2,13]],
    startSquare: 14,
    homeColumn: 'top',
    homeRowCol: { row: 1, col: 13 },
    pieces: [0,1,2,3]
  },
  green: {
    homeBase: [[12,12],[12,13],[13,12],[13,13]],
    startSquare: 27,
    homeColumn: 'right',
    homeRowCol: { row: 13, col: 13 },
    pieces: [0,1,2,3]
  },
  yellow: {
    homeBase: [[12,1],[12,2],[13,1],[13,2]],
    startSquare: 40,
    homeColumn: 'bottom',
    homeRowCol: { row: 13, col: 1 },
    pieces: [0,1,2,3]
  }
};

// 52-step outer path (row, col) — clockwise from top-left corner square
const OUTER_PATH = [
  // Top section going right (row 6)
  [6,1],[6,2],[6,3],[6,4],[6,5],
  // Left side going up (col 6)
  [5,6],[4,6],[3,6],[2,6],[1,6],[0,6],
  // Top going right (row 0)
  [0,7],
  // Right side of top going down (col 8)
  [0,8],[1,8],[2,8],[3,8],[4,8],[5,8],
  // Top right going right (row 6)
  [6,9],[6,10],[6,11],[6,12],[6,13],[6,14],
  // Right side going down (col 14 -> row 8)
  [7,14],
  // Right going left (row 8)
  [8,14],[8,13],[8,12],[8,11],[8,10],[8,9],
  // Bottom right going down (col 8)
  [9,8],[10,8],[11,8],[12,8],[13,8],[14,8],
  // Bottom going left (row 14)
  [14,7],
  // Bottom going up (col 6)
  [14,6],[13,6],[12,6],[11,6],[10,6],[9,6],
  // Bottom left going left (row 8)
  [8,5],[8,4],[8,3],[8,2],[8,1],[8,0],
  // Left side going up (col 0 -> row 7)
  [7,0]
];

// Home stretch paths for each color (6 squares leading to center)
const HOME_PATHS = {
  red:    [[7,1],[7,2],[7,3],[7,4],[7,5],[7,6]],
  blue:   [[1,7],[2,7],[3,7],[4,7],[5,7],[6,7]],
  green:  [[7,13],[7,12],[7,11],[7,10],[7,9],[7,8]],
  yellow: [[13,7],[12,7],[11,7],[10,7],[9,7],[8,7]]
};

// Start index on OUTER_PATH for each color
const COLOR_START_IDX = { red: 0, blue: 13, green: 26, yellow: 39 };

// ============================================
// PIECE CLASS
// ============================================
class Piece {
  constructor(color, id) {
    this.color = color;
    this.id = id;
    this.state = 'home';      // 'home' | 'active' | 'finished'
    this.pathIndex = -1;      // -1 = in home, 0-51 = outer path, 52-57 = home stretch + center
    this.x = 0; this.y = 0;  // canvas coords for animation
  }

  isHome()     { return this.state === 'home'; }
  isActive()   { return this.state === 'active'; }
  isFinished() { return this.state === 'finished'; }

  // Get grid position based on pathIndex
  getGridPos() {
    if (this.isHome()) {
      const bases = COLOR_CONFIG[this.color].homeBase;
      return bases[this.id];
    }
    if (this.isFinished()) {
      return [7, 7]; // center
    }
    const pi = this.pathIndex;
    if (pi < 52) {
      const startIdx = COLOR_START_IDX[this.color];
      const outerIdx = (startIdx + pi) % 52;
      return OUTER_PATH[outerIdx];
    } else {
      // home stretch
      const stretchIdx = pi - 52;
      const hp = HOME_PATHS[this.color];
      if (stretchIdx < hp.length) return hp[stretchIdx];
      return [7, 7];
    }
  }

  canMove(roll) {
    if (this.isFinished()) return false;
    if (this.isHome()) return roll === 6;
    const newIndex = this.pathIndex + roll;
    return newIndex <= 57; // 52 outer + 5 home stretch + 1 center = 58 total (0-57)
  }

  move(roll) {
    if (this.isHome() && roll === 6) {
      this.state = 'active';
      this.pathIndex = 0;
      return 'entered';
    }
    this.pathIndex += roll;
    if (this.pathIndex >= 57) {
      this.pathIndex = 57;
      this.state = 'finished';
      return 'finished';
    }
    return 'moved';
  }
}

// ============================================
// LUDO ENGINE
// ============================================
class LudoEngine {
  constructor(playerColors) {
    this.playerColors = playerColors; // array of color strings
    this.pieces = {};
    this.currentPlayerIdx = 0;
    this.lastRoll = null;
    this.extraTurn = false;
    this.gameOver = false;
    this.rankings = [];
    this.finishedPlayers = [];

    // Initialize pieces for each color
    playerColors.forEach(color => {
      this.pieces[color] = [0,1,2,3].map(id => new Piece(color, id));
    });
  }

  get currentColor() {
    return this.playerColors[this.currentPlayerIdx];
  }

  // Returns movable pieces given a roll
  getMovablePieces(color, roll) {
    return this.pieces[color].filter(p => p.canMove(roll));
  }

  // Move a piece, returns result object
  movePiece(color, pieceId, roll) {
    const piece = this.pieces[color][pieceId];
    const result = piece.move(roll);

    let killedPiece = null;
    let isSafe = false;
    let giveExtraTurn = false;

    if (result === 'finished') {
      giveExtraTurn = true;
      if (!this.finishedPlayers.includes(color)) {
        this.finishedPlayers.push(color);
        this.rankings.push({ color, position: this.rankings.length + 1 });
      }
      // Check all 4 pieces of this color are done
      const allDone = this.pieces[color].every(p => p.isFinished());
      if (allDone && !this.gameOver) {
        // This player completed!
      }
    } else if (result === 'entered' || result === 'moved') {
      // Check if we kill someone
      if (piece.pathIndex < 52) { // only on outer path
        killedPiece = this.checkKill(color, piece);
      }
      if (roll === 6) giveExtraTurn = true;
    }

    // Check game over (all players but one done... or 3 places taken)
    if (this.rankings.length >= this.playerColors.length - 1) {
      // Find remaining
      const remaining = this.playerColors.filter(c =>
        !this.finishedPlayers.includes(c)
      );
      if (remaining.length === 1) {
        this.rankings.push({ color: remaining[0], position: this.playerColors.length });
        this.finishedPlayers.push(remaining[0]);
        this.gameOver = true;
      }
    }

    this.extraTurn = giveExtraTurn;
    this.lastRoll = null;

    if (!giveExtraTurn) {
      this.advanceTurn();
    }

    return { result, killedPiece, giveExtraTurn };
  }

  checkKill(attackerColor, attackerPiece) {
    const [ar, ac] = attackerPiece.getGridPos();

    for (const color of this.playerColors) {
      if (color === attackerColor) continue;
      for (const piece of this.pieces[color]) {
        if (!piece.isActive()) continue;
        if (piece.pathIndex >= 52) continue; // home stretch is safe
        const [pr, pc] = piece.getGridPos();
        if (pr === ar && pc === ac) {
          // Check if it's a safe square
          if (this.isSafeSquare(ar, ac)) continue;
          // Kill!
          piece.state = 'home';
          piece.pathIndex = -1;
          return { color, pieceId: piece.id };
        }
      }
    }
    return null;
  }

  isSafeSquare(row, col) {
    // Safe squares are star-marked positions
    const safeCoords = [
      [6,2],[2,8],[8,12],[12,6], // near start positions
      [1,6],[6,13],[13,8],[8,1]  // other safe squares
    ];
    return safeCoords.some(([r, c]) => r === row && c === col);
  }

  advanceTurn() {
    let nextIdx = (this.currentPlayerIdx + 1) % this.playerColors.length;
    // Skip finished players
    let attempts = 0;
    while (this.finishedPlayers.includes(this.playerColors[nextIdx]) && attempts < this.playerColors.length) {
      nextIdx = (nextIdx + 1) % this.playerColors.length;
      attempts++;
    }
    this.currentPlayerIdx = nextIdx;
  }

  isCurrentPlayerDone() {
    return this.finishedPlayers.includes(this.currentColor);
  }

  rollDice() {
    return Math.floor(Math.random() * 6) + 1;
  }

  // Serialize state for Firebase
  serialize() {
    const piecesData = {};
    for (const color of this.playerColors) {
      piecesData[color] = this.pieces[color].map(p => ({
        state: p.state,
        pathIndex: p.pathIndex
      }));
    }
    return {
      playerColors: this.playerColors,
      pieces: piecesData,
      currentPlayerIdx: this.currentPlayerIdx,
      lastRoll: this.lastRoll,
      extraTurn: this.extraTurn,
      gameOver: this.gameOver,
      rankings: this.rankings,
      finishedPlayers: this.finishedPlayers
    };
  }

  // Load state from Firebase
  static deserialize(data) {
    const engine = new LudoEngine(data.playerColors);
    engine.currentPlayerIdx = data.currentPlayerIdx;
    engine.lastRoll = data.lastRoll;
    engine.extraTurn = data.extraTurn;
    engine.gameOver = data.gameOver;
    engine.rankings = data.rankings || [];
    engine.finishedPlayers = data.finishedPlayers || [];

    for (const color of data.playerColors) {
      if (data.pieces[color]) {
        data.pieces[color].forEach((pd, id) => {
          engine.pieces[color][id].state = pd.state;
          engine.pieces[color][id].pathIndex = pd.pathIndex;
        });
      }
    }
    return engine;
  }
}

// ============================================
// CANVAS RENDERER
// ============================================
class LudoRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.size = canvas.width;
    this.cellSize = this.size / BOARD_SIZE;
    this.animFrame = null;
    this.selectedPiece = null;
    this.highlightedCells = [];
  }

  cell(c) { return c * this.cellSize; }

  drawBoard(engine, myColor) {
    const ctx = this.ctx;
    const cs = this.cellSize;
    ctx.clearRect(0, 0, this.size, this.size);

    this.drawBackground();
    this.drawGrid();
    this.drawHomeAreas();
    this.drawPath();
    this.drawHomeStretches();
    this.drawCenterStar();
    this.drawSafeMarkers();
    if (engine) this.drawPieces(engine, myColor);
  }

  drawBackground() {
    const ctx = this.ctx;
    ctx.fillStyle = '#f5f0e8';
    ctx.fillRect(0, 0, this.size, this.size);

    // Subtle grid lines
    ctx.strokeStyle = 'rgba(0,0,0,0.08)';
    ctx.lineWidth = 0.5;
    for (let i = 0; i <= BOARD_SIZE; i++) {
      const pos = i * this.cellSize;
      ctx.beginPath(); ctx.moveTo(pos, 0); ctx.lineTo(pos, this.size); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, pos); ctx.lineTo(this.size, pos); ctx.stroke();
    }
  }

  drawGrid() {
    // Board border
    const ctx = this.ctx;
    ctx.strokeStyle = '#8a7a60';
    ctx.lineWidth = 3;
    ctx.strokeRect(2, 2, this.size - 4, this.size - 4);

    // Center cross dividers
    ctx.strokeStyle = '#8a7a60';
    ctx.lineWidth = 2;
    const m = 6 * this.cellSize;
    const m2 = 9 * this.cellSize;
    // Vertical
    ctx.beginPath(); ctx.moveTo(m, 0); ctx.lineTo(m, this.size); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(m2, 0); ctx.lineTo(m2, this.size); ctx.stroke();
    // Horizontal
    ctx.beginPath(); ctx.moveTo(0, m); ctx.lineTo(this.size, m); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, m2); ctx.lineTo(this.size, m2); ctx.stroke();
  }

  drawHomeAreas() {
    const ctx = this.ctx;
    const cs = this.cellSize;

    const homes = [
      { color: '#e63946', x: 0,      y: 0,      label: 'R' },
      { color: '#1d6fa4', x: 9*cs,   y: 0,      label: 'B' },
      { color: '#2a9d5c', x: 9*cs,   y: 9*cs,   label: 'G' },
      { color: '#f4b942', x: 0,      y: 9*cs,   label: 'Y' },
    ];

    homes.forEach(({ color, x, y, label }) => {
      // Outer rectangle
      ctx.fillStyle = color;
      ctx.fillRect(x, y, 6*cs, 6*cs);

      // Inner white area for pieces
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      const pad = cs * 0.4;
      ctx.fillRect(x + pad, y + pad, 6*cs - 2*pad, 6*cs - 2*pad);

      // Inner colored border
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.strokeRect(x + pad, y + pad, 6*cs - 2*pad, 6*cs - 2*pad);

      // Circle slots for pieces
      const positions = [[1,1],[1,3],[3,1],[3,3]];
      positions.forEach(([pi, pj]) => {
        ctx.beginPath();
        ctx.arc(x + (pi+0.5)*cs, y + (pj+0.5)*cs, cs*0.4, 0, Math.PI*2);
        ctx.fillStyle = 'rgba(255,255,255,0.6)';
        ctx.fill();
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.stroke();
      });
    });
  }

  drawPath() {
    const ctx = this.ctx;
    const cs = this.cellSize;

    // Draw each path cell
    OUTER_PATH.forEach(([row, col], idx) => {
      const x = col * cs;
      const y = row * cs;

      ctx.fillStyle = '#fff';
      ctx.fillRect(x + 1, y + 1, cs - 2, cs - 2);

      // Colored start squares
      const coloredStarts = [
        { idx: 0,  color: '#e63946' },  // red start
        { idx: 13, color: '#1d6fa4' },  // blue start
        { idx: 26, color: '#2a9d5c' },  // green start
        { idx: 39, color: '#f4b942' }   // yellow start
      ];
      const cs_entry = coloredStarts.find(e => e.idx === idx);
      if (cs_entry) {
        ctx.fillStyle = cs_entry.color;
        ctx.fillRect(x + 1, y + 1, cs - 2, cs - 2);
      }
    });
  }

  drawHomeStretches() {
    const ctx = this.ctx;
    const cs = this.cellSize;

    const stretches = [
      { path: HOME_PATHS.red,    color: '#e63946' },
      { path: HOME_PATHS.blue,   color: '#1d6fa4' },
      { path: HOME_PATHS.green,  color: '#2a9d5c' },
      { path: HOME_PATHS.yellow, color: '#f4b942' }
    ];

    stretches.forEach(({ path, color }) => {
      path.forEach(([row, col], idx) => {
        const x = col * cs;
        const y = row * cs;
        // Gradient intensity
        const alpha = 0.4 + (idx / path.length) * 0.5;
        ctx.fillStyle = color;
        ctx.globalAlpha = alpha;
        ctx.fillRect(x + 1, y + 1, cs - 2, cs - 2);
        ctx.globalAlpha = 1;

        // Arrow direction hint
        if (idx < path.length - 1) {
          const [nr, nc] = path[idx + 1];
          this.drawArrow(x + cs/2, y + cs/2, nc * cs + cs/2, nr * cs + cs/2, color, 0.6);
        }
      });
    });
  }

  drawArrow(x1, y1, x2, y2, color, alpha) {
    const ctx = this.ctx;
    const cs = this.cellSize;
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    const angle = Math.atan2(y2 - y1, x2 - x1);
    const len = 8;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
    // Arrowhead
    ctx.beginPath();
    ctx.moveTo(x2, y2);
    ctx.lineTo(x2 - len * Math.cos(angle - 0.4), y2 - len * Math.sin(angle - 0.4));
    ctx.lineTo(x2 - len * Math.cos(angle + 0.4), y2 - len * Math.sin(angle + 0.4));
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  drawCenterStar() {
    const ctx = this.ctx;
    const cs = this.cellSize;
    const cx = 7.5 * cs;
    const cy = 7.5 * cs;
    const size = 1.5 * cs;

    // Triangle from each color
    const triangles = [
      { color: '#e63946', points: [[-size,0],[0,-size/2],[size,0]] }, // left → center
      { color: '#1d6fa4', points: [[0,-size],[-size/2,0],[0,size]] }, // top → center
      { color: '#2a9d5c', points: [[size,0],[0,size/2],[-size,0]] },  // right → center
      { color: '#f4b942', points: [[0,size],[size/2,0],[0,-size]] },  // bottom → center
    ];

    triangles.forEach(({ color, points }) => {
      ctx.beginPath();
      ctx.moveTo(cx + points[0][0], cy + points[0][1]);
      ctx.lineTo(cx + points[1][0], cy + points[1][1]);
      ctx.lineTo(cx + points[2][0], cy + points[2][1]);
      ctx.closePath();
      ctx.fillStyle = color;
      ctx.fill();
    });

    // Center star
    this.drawStar(cx, cy, cs * 0.5, '#f0c040', '#c48a10');
  }

  drawStar(cx, cy, r, fill, stroke) {
    const ctx = this.ctx;
    const points = 5;
    const outer = r;
    const inner = r * 0.4;

    ctx.beginPath();
    for (let i = 0; i < points * 2; i++) {
      const rad = (i * Math.PI) / points - Math.PI / 2;
      const d = i % 2 === 0 ? outer : inner;
      ctx.lineTo(cx + d * Math.cos(rad), cy + d * Math.sin(rad));
    }
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }

  drawSafeMarkers() {
    const ctx = this.ctx;
    const cs = this.cellSize;

    const safeCoords = [
      [6,2],[2,8],[8,12],[12,6],
      [1,6],[6,13],[13,8],[8,1]
    ];

    safeCoords.forEach(([row, col]) => {
      const x = col * cs + cs/2;
      const y = row * cs + cs/2;
      // Star marker on safe squares
      this.drawStar(x, y, cs * 0.32, '#ffe082', '#c48a10');
    });
  }

  drawPieces(engine, myColor) {
    const ctx = this.ctx;
    const cs = this.cellSize;

    // Group pieces by grid position to handle stacking
    const cellOccupancy = {};

    engine.playerColors.forEach(color => {
      engine.pieces[color].forEach(piece => {
        const [row, col] = piece.getGridPos();
        const key = `${row},${col}`;
        if (!cellOccupancy[key]) cellOccupancy[key] = [];
        cellOccupancy[key].push({ color, piece });
      });
    });

    // Draw each cell's pieces
    Object.entries(cellOccupancy).forEach(([key, pieces]) => {
      const [row, col] = key.split(',').map(Number);
      const baseX = col * cs + cs/2;
      const baseY = row * cs + cs/2;

      pieces.forEach((item, stackIdx) => {
        const { color, piece } = item;
        const offset = this.getStackOffset(stackIdx, pieces.length, cs);
        this.drawPiece(
          baseX + offset.x, baseY + offset.y,
          color, piece,
          color === myColor,
          cs
        );
      });
    });
  }

  getStackOffset(idx, total, cs) {
    if (total === 1) return { x: 0, y: 0 };
    const r = cs * 0.22;
    const angle = (idx / total) * Math.PI * 2 - Math.PI/2;
    return { x: r * Math.cos(angle), y: r * Math.sin(angle) };
  }

  drawPiece(cx, cy, color, piece, isOwn, cs) {
    const ctx = this.ctx;
    const r = cs * 0.32;
    const colorDef = COLORS[color];

    // Shadow
    ctx.shadowColor = 'rgba(0,0,0,0.4)';
    ctx.shadowBlur = 6;
    ctx.shadowOffsetY = 3;

    // Outer circle
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = colorDef.primary;
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.shadowColor = 'transparent';

    // Inner highlight
    ctx.beginPath();
    ctx.arc(cx - r*0.2, cy - r*0.25, r * 0.45, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.fill();

    // Piece ID dot
    ctx.beginPath();
    ctx.arc(cx, cy, r * 0.25, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    ctx.fill();

    // Highlight for own pieces
    if (isOwn) {
      ctx.beginPath();
      ctx.arc(cx, cy, r + 3, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(255,255,255,0.7)';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([3, 2]);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }

  // Highlight movable pieces
  highlightMovable(engine, color, roll) {
    const movable = engine.getMovablePieces(color, roll);
    // Canvas: re-draw with highlights
    // (handled by the calling code via selection UI)
    return movable;
  }

  getCellFromClick(x, y) {
    const rect = this.canvas.getBoundingClientRect();
    const scaleX = this.size / rect.width;
    const scaleY = this.size / rect.height;
    const canvasX = (x - rect.left) * scaleX;
    const canvasY = (y - rect.top) * scaleY;
    return {
      col: Math.floor(canvasX / this.cellSize),
      row: Math.floor(canvasY / this.cellSize)
    };
  }
}

// Export
window.LudoEngine = LudoEngine;
window.LudoRenderer = LudoRenderer;
window.COLORS = COLORS;
window.COLOR_KEYS = COLOR_KEYS;
