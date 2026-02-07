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
  // Generous comparison: allow ~300ms timing variance, ±1 extra/missing notes
  if (Math.abs(original.length - attempt.length) > 1) {
    return false;
  }

  const minLen = Math.min(original.length, attempt.length);
  let mismatches = 0;

  for (let i = 0; i < minLen; i++) {
    const o = original[i];
    const a = attempt[i];

    // Check note match
    if (o.note !== a.note) {
      mismatches++;
      if (mismatches > 1) return false;
      continue;
    }

    // Check timing (relative to first note)
    const oTime = o.timestamp - original[0].timestamp;
    const aTime = a.timestamp - attempt[0].timestamp;
    if (Math.abs(oTime - aTime) > 300) {
      mismatches++;
      if (mismatches > 1) return false;
    }
  }

  return true;
}

function getNextLetter(currentLetters) {
  const MAGE = 'MAGE';
  return MAGE[currentLetters.length] || '';
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
        if (room.letters[playerIndex].length >= 4) {
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

