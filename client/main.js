// Note frequencies (Hz)
const NOTE_FREQS = {
  'C4': 261.63, 'C#4': 277.18, 'D4': 293.66, 'D#4': 311.13,
  'E4': 329.63, 'F4': 349.23, 'F#4': 369.99, 'G4': 392.00,
  'G#4': 415.30, 'A4': 440.00, 'A#4': 466.16, 'B4': 493.88,
  'C5': 523.25, 'C#5': 554.37, 'D5': 587.33, 'D#5': 622.25
};

// Key to note mapping
const KEY_MAP = {
  'a': 'C4', 's': 'D4', 'd': 'E4', 'f': 'F4', 'g': 'G4',
  'h': 'A4', 'j': 'B4', 'k': 'C5', 'l': 'D5',
  'w': 'C#4', 'e': 'D#4', 't': 'F#4', 'y': 'G#4',
  'u': 'A#4', 'o': 'C#5', 'p': 'D#5'
};

// Audio context
let audioCtx = null;

function getAudioContext() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  return audioCtx;
}

function playNote(note, duration = 0.3) {
  const ctx = getAudioContext();
  const freq = NOTE_FREQS[note];
  if (!freq) return;

  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = 'sine';
  osc.frequency.value = freq;

  gain.gain.setValueAtTime(0.3, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration);

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start();
  osc.stop(ctx.currentTime + duration);
}

// State
let ws = null;
let playerIndex = null;
let roomId = null;
let isRecording = false;
let recordedNotes = [];
let receivedMelody = null;
let timerInterval = null;
let timeLeft = 50;

// DOM elements
const lobby = document.getElementById('lobby');
const createBtn = document.getElementById('create-btn');
const shareLink = document.getElementById('share-link');
const roomLinkInput = document.getElementById('room-link');

const game = document.getElementById('game');
const myLetters = document.getElementById('my-letters');
const oppLetters = document.getElementById('opp-letters');
const turnInfo = document.getElementById('turn-info');
const timerDiv = document.getElementById('timer');
const timeLeftSpan = document.getElementById('time-left');
const message = document.getElementById('message');

const recordBtn = document.getElementById('record-btn');
const doneBtn = document.getElementById('done-btn');
const listenBtn = document.getElementById('listen-btn');
const submitBtn = document.getElementById('submit-btn');

const gameOver = document.getElementById('game-over');
const resultText = document.getElementById('result-text');
const newGameBtn = document.getElementById('new-game-btn');

// Piano keys
const allKeys = document.querySelectorAll('#piano button');

function formatLetters(letters) {
  return (letters + '____').slice(0, 4);
}

function updateLetters(letters) {
  myLetters.textContent = formatLetters(letters[playerIndex]);
  oppLetters.textContent = formatLetters(letters[playerIndex === 0 ? 1 : 0]);
}

function showMessage(text) {
  message.textContent = text;
}

function hideAllControls() {
  recordBtn.style.display = 'none';
  doneBtn.style.display = 'none';
  listenBtn.style.display = 'none';
  submitBtn.style.display = 'none';
  timerDiv.style.display = 'none';
}

function startTimer() {
  timeLeft = 50;
  timeLeftSpan.textContent = timeLeft;
  timerDiv.style.display = 'block';

  timerInterval = setInterval(() => {
    timeLeft--;
    timeLeftSpan.textContent = timeLeft;
    if (timeLeft <= 0) {
      clearInterval(timerInterval);
      // Auto-submit empty attempt (will fail)
      ws.send(JSON.stringify({ type: 'attempt-submit', notes: recordedNotes }));
    }
  }, 1000);
}

function stopTimer() {
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
  timerDiv.style.display = 'none';
}

function connectWebSocket() {
  const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
  const wsUrl = `${protocol}//${location.hostname}:3001`;
  ws = new WebSocket(wsUrl);

  ws.onopen = () => {
    console.log('Connected to server');

    // Check if joining via URL
    const pathRoomId = location.pathname.slice(1);
    if (pathRoomId && pathRoomId.length === 8) {
      ws.send(JSON.stringify({ type: 'join-room', roomId: pathRoomId }));
    }
  };

  ws.onmessage = (event) => {
    const msg = JSON.parse(event.data);
    handleMessage(msg);
  };

  ws.onclose = () => {
    console.log('Disconnected from server');
  };
}

function handleMessage(msg) {
  switch (msg.type) {
    case 'room-created':
      roomId = msg.roomId;
      playerIndex = msg.playerIndex;
      roomLinkInput.value = `${location.origin}/${roomId}`;
      shareLink.style.display = 'block';
      break;

    case 'room-joined':
      roomId = msg.roomId;
      playerIndex = msg.playerIndex;
      lobby.style.display = 'none';
      break;

    case 'opponent-joined':
      lobby.style.display = 'none';
      break;

    case 'game-start':
      game.style.display = 'block';
      gameOver.style.display = 'none';
      updateLetters(msg.letters);

      if (msg.currentTurn === playerIndex) {
        turnInfo.textContent = 'Your turn to record a melody!';
        hideAllControls();
        recordBtn.style.display = 'inline-block';
      } else {
        turnInfo.textContent = 'Opponent is recording a melody...';
        hideAllControls();
      }
      showMessage('');
      break;

    case 'melody-received':
      receivedMelody = msg.notes;
      turnInfo.textContent = 'Listen to the melody, then try to replay it!';
      hideAllControls();
      listenBtn.style.display = 'inline-block';
      showMessage(`Melody has ${msg.notes.length} notes`);
      break;

    case 'turn-result':
      stopTimer();
      updateLetters(msg.letters);

      const wasMyAttempt = msg.currentTurn === playerIndex;
      if (wasMyAttempt) {
        // I just attempted, now I record
        showMessage(msg.success ? 'Nice! You matched it!' : 'Oops! You got a letter.');
        turnInfo.textContent = 'Your turn to record a melody!';
        hideAllControls();
        recordBtn.style.display = 'inline-block';
      } else {
        // Opponent just attempted, now they record
        showMessage(msg.success ? 'Opponent matched your melody!' : 'Opponent failed! They got a letter.');
        turnInfo.textContent = 'Opponent is recording a melody...';
        hideAllControls();
      }
      break;

    case 'game-over':
      stopTimer();
      game.style.display = 'none';
      gameOver.style.display = 'block';

      if (msg.loser === playerIndex) {
        resultText.textContent = 'You spelled MAGE! You lose!';
      } else {
        resultText.textContent = 'Opponent spelled MAGE! You win!';
      }
      break;

    case 'opponent-disconnected':
      showMessage('Opponent disconnected!');
      turnInfo.textContent = 'Game ended';
      hideAllControls();
      break;

    case 'error':
      alert(msg.message);
      break;
  }
}

// Piano interaction
function handleNotePlay(note) {
  playNote(note);

  // Visual feedback
  const keyBtn = document.querySelector(`button[data-note="${note}"]`);
  if (keyBtn) {
    keyBtn.classList.add('active');
    setTimeout(() => keyBtn.classList.remove('active'), 150);
  }

  // Record if recording
  if (isRecording) {
    recordedNotes.push({ note, timestamp: Date.now() });
  }
}

// Keyboard input
document.addEventListener('keydown', (e) => {
  if (e.repeat) return;
  const note = KEY_MAP[e.key.toLowerCase()];
  if (note) {
    handleNotePlay(note);
  }
});

// Click on piano keys
allKeys.forEach((btn) => {
  btn.addEventListener('mousedown', () => {
    const note = btn.dataset.note;
    if (note) {
      handleNotePlay(note);
    }
  });
});

// Controls
createBtn.addEventListener('click', () => {
  connectWebSocket();
  ws.onopen = () => {
    ws.send(JSON.stringify({ type: 'create-room' }));

    const pathRoomId = location.pathname.slice(1);
    if (pathRoomId && pathRoomId.length === 8) {
      ws.send(JSON.stringify({ type: 'join-room', roomId: pathRoomId }));
    }
  };
});

recordBtn.addEventListener('click', () => {
  isRecording = true;
  recordedNotes = [];
  recordBtn.style.display = 'none';
  doneBtn.style.display = 'inline-block';
  showMessage('Recording... play your melody!');
});

doneBtn.addEventListener('click', () => {
  isRecording = false;
  if (recordedNotes.length === 0) {
    showMessage('You need to play at least one note!');
    recordBtn.style.display = 'inline-block';
    doneBtn.style.display = 'none';
    return;
  }
  ws.send(JSON.stringify({ type: 'melody-submit', notes: recordedNotes }));
  doneBtn.style.display = 'none';
  turnInfo.textContent = 'Waiting for opponent to replay...';
  showMessage(`Sent melody with ${recordedNotes.length} notes`);
});

listenBtn.addEventListener('click', () => {
  if (!receivedMelody || receivedMelody.length === 0) return;

  listenBtn.disabled = true;

  // Play back the melody
  const startTime = receivedMelody[0].timestamp;
  receivedMelody.forEach((n, i) => {
    const delay = n.timestamp - startTime;
    setTimeout(() => {
      handleNotePlay(n.note);
      if (i === receivedMelody.length - 1) {
        // Done playing, enable recording attempt
        listenBtn.disabled = false;
        listenBtn.style.display = 'inline-block';
        submitBtn.style.display = 'inline-block';
        recordedNotes = [];
        isRecording = true;
        startTimer();
        showMessage('Now try to replay it! Recording...');
      }
    }, delay);
  });
});

submitBtn.addEventListener('click', () => {
  isRecording = false;
  stopTimer();
  ws.send(JSON.stringify({ type: 'attempt-submit', notes: recordedNotes }));
  hideAllControls();
  turnInfo.textContent = 'Checking your attempt...';
});

newGameBtn.addEventListener('click', () => {
  ws.send(JSON.stringify({ type: 'new-game' }));
});

// Auto-connect if joining via URL
const pathRoomId = location.pathname.slice(1);
if (pathRoomId && pathRoomId.length === 8) {
  lobby.innerHTML = '<p>Joining game...</p>';
  connectWebSocket();
}

