import { WebSocketServer } from 'ws';
import { createServer } from 'http';
import { randomBytes } from 'crypto';

const PORT = 3001;
const rooms = new Map();

const server = createServer();
const wss = new WebSocketServer({ server });

function generateRoomId() {
  return randomBytes(4).toString('hex');
}

// Duration quantization (matches client)
function quantizeDuration(ms) {
  if (ms <= 187) return 0; // sixteenth
  if (ms <= 375) return 1; // eighth
  if (ms <= 750) return 2; // quarter
  if (ms <= 1500) return 3; // half
  return 4; // whole
}

function broadcast(room, message, excludeWs = null) {
  const data = JSON.stringify(message);
  room.players.forEach((player) => {
    if (player.ws !== excludeWs && player.ws.readyState === 1) {
      player.ws.send(data);
    }
  });
}

function sendTo(ws, message) {
  if (ws.readyState === 1) {
    ws.send(JSON.stringify(message));
  }
}

function compareNotes(original, attempt) {
  // Safety check - if either is null/undefined, return false
  if (!original || !attempt) {
    return false;
  }

  // Filter to get only chord/note events (exclude rests for length comparison)
  const origChords = original.filter(e => e.type === 'chord' || e.notes || e.note);
  const attemptChords = attempt.filter(e => e.type === 'chord' || e.notes || e.note);

  // Generous comparison: allow ±1 extra/missing chord events
  if (Math.abs(origChords.length - attemptChords.length) > 1) {
    return false;
  }

  const minLen = Math.min(origChords.length, attemptChords.length);
  let mismatches = 0;

  for (let i = 0; i < minLen; i++) {
    const o = origChords[i];
    const a = attemptChords[i];

    // Get notes array from each event (handle both old and new format)
    const oNotes = (o.notes || [o.note]).sort();
    const aNotes = (a.notes || [a.note]).sort();

    // Check chord notes match (order-independent)
    if (!arraysEqual(oNotes, aNotes)) {
      mismatches++;
      if (mismatches > 1) return false;
      continue;
    }

    // Check timing (relative to first event)
    const oTime = o.timestamp - origChords[0].timestamp;
    const aTime = a.timestamp - attemptChords[0].timestamp;
    if (Math.abs(oTime - aTime) > 300) {
      mismatches++;
      if (mismatches > 1) return false;
    }

    // Check duration (generous: same or adjacent category)
    const oDur = quantizeDuration(o.duration || 300);
    const aDur = quantizeDuration(a.duration || 300);
    if (Math.abs(oDur - aDur) > 1) {
      mismatches++;
      if (mismatches > 1) return false;
    }
  }

  // Also check rest patterns (lenient - just check if rests exist in similar positions)
  const origRests = original.filter(e => e.type === 'rest');
  const attemptRests = attempt.filter(e => e.type === 'rest');

  // If original has rests, attempt should have at least some rests (within tolerance)
  if (origRests.length > 0 && attemptRests.length === 0) {
    mismatches++;
  }

  return mismatches <= 1;
}

// Helper to compare arrays (order-independent after sorting)
function arraysEqual(a, b) {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

function getNextLetter(currentLetters) {
  const MAGIC = 'MAGIC';
  return MAGIC[currentLetters.length] || '';
}

wss.on('connection', (ws) => {
  let playerRoomId = null;
  let playerIndex = null;

  ws.on('message', (data) => {
    let msg;
    try {
      msg = JSON.parse(data);
    } catch {
      return;
    }

    switch (msg.type) {
      case 'create-room': {
        const roomId = generateRoomId();
        rooms.set(roomId, {
          players: [{ ws, name: msg.name || 'Player 1' }],
          currentTurn: 0,
          melody: null,
          letters: ['', ''],
          phase: 'waiting', // waiting, recording, replaying
        });
        playerRoomId = roomId;
        playerIndex = 0;
        sendTo(ws, { type: 'room-created', roomId, playerIndex: 0 });
        break;
      }

      case 'join-room': {
        const room = rooms.get(msg.roomId);
        if (!room) {
          sendTo(ws, { type: 'error', message: 'Room not found' });
          return;
        }
        if (room.players.length >= 2) {
          sendTo(ws, { type: 'error', message: 'Room is full' });
          return;
        }
        room.players.push({ ws, name: msg.name || 'Player 2' });
        playerRoomId = msg.roomId;
        playerIndex = 1;

        sendTo(ws, {
          type: 'room-joined',
          roomId: msg.roomId,
          playerIndex: 1,
          opponentName: room.players[0].name
        });

        // Notify player 1 that player 2 joined
        sendTo(room.players[0].ws, {
          type: 'opponent-joined',
          opponentName: room.players[1].name
        });

        // Start the game - player 0 records first
        room.phase = 'recording';
        broadcast(room, {
          type: 'game-start',
          currentTurn: 0,
          letters: room.letters
        });
        break;
      }

      case 'melody-submit': {
        const room = rooms.get(playerRoomId);
        if (!room || room.currentTurn !== playerIndex) return;

        room.melody = msg.notes;
        room.phase = 'replaying';

        // Send melody to opponent for playback
        const opponentIndex = playerIndex === 0 ? 1 : 0;
        sendTo(room.players[opponentIndex].ws, {
          type: 'melody-received',
          notes: msg.notes
        });
        break;
      }

      case 'attempt-submit': {
        const room = rooms.get(playerRoomId);
        if (!room || room.currentTurn === playerIndex) return;

        const success = compareNotes(room.melody, msg.notes);

        if (!success) {
          // Add letter to the player who failed
          room.letters[playerIndex] += getNextLetter(room.letters[playerIndex]);
        }

        // Check for game over
        if (room.letters[playerIndex].length >= 5) {
          broadcast(room, {
            type: 'game-over',
            loser: playerIndex,
            letters: room.letters
          });
          room.phase = 'ended';
          return;
        }

        // Switch turns - the one who just attempted now records
        room.currentTurn = playerIndex;
        room.melody = null;
        room.phase = 'recording';

        broadcast(room, {
          type: 'turn-result',
          success,
          letters: room.letters,
          currentTurn: room.currentTurn
        });
        break;
      }

      case 'new-game': {
        const room = rooms.get(playerRoomId);
        if (!room) return;

        room.letters = ['', ''];
        room.currentTurn = 0;
        room.melody = null;
        room.phase = 'recording';

        broadcast(room, {
          type: 'game-start',
          currentTurn: 0,
          letters: room.letters
        });
        break;
      }

      case 'forfeit': {
        const room = rooms.get(playerRoomId);
        if (!room) return;

        // Player who forfeits loses
        broadcast(room, {
          type: 'game-over',
          loser: playerIndex,
          letters: room.letters
        });
        room.phase = 'ended';
        break;
      }
    }
  });

  ws.on('close', () => {
    if (playerRoomId) {
      const room = rooms.get(playerRoomId);
      if (room) {
        broadcast(room, { type: 'opponent-disconnected' }, ws);
        rooms.delete(playerRoomId);
      }
    }
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`WebSocket server running on ws://0.0.0.0:${PORT}`);
});

