import { Renderer, Stave, StaveNote, Voice, Formatter, Accidental } from 'vexflow';

// Note audio file paths (C2-C4, octave lower)
const NOTE_PATHS = {
  'C3': '/assets/notes/36.mp3',
  'C#3': '/assets/notes/37.mp3',
  'D3': '/assets/notes/38.mp3',
  'D#3': '/assets/notes/39.mp3',
  'E3': '/assets/notes/40.mp3',
  'F3': '/assets/notes/41.mp3',
  'F#3': '/assets/notes/42.mp3',
  'G3': '/assets/notes/43.mp3',
  'G#3': '/assets/notes/44.mp3',
  'A3': '/assets/notes/45.mp3',
  'A#3': '/assets/notes/46.mp3',
  'B3': '/assets/notes/47.mp3',
  'C4': '/assets/notes/48.mp3',
  'C#4': '/assets/notes/49.mp3',
  'D4': '/assets/notes/50.mp3',
  'D#4': '/assets/notes/51.mp3',
  'E4': '/assets/notes/52.mp3',
  'F4': '/assets/notes/53.mp3',
  'F#4': '/assets/notes/54.mp3',
  'G4': '/assets/notes/55.mp3',
  'G#4': '/assets/notes/56.mp3',
  'A4': '/assets/notes/57.mp3',
  'A#4': '/assets/notes/58.mp3',
  'B4': '/assets/notes/59.mp3',
  'C5': '/assets/notes/60.mp3'
};

// Key to note mapping (PianoWizards layout - C3-C5)
const KEY_MAP = {
  'a': 'C3', 'w': 'C#3', 's': 'D3', 'e': 'D#3', 'd': 'E3',
  'f': 'F3', 't': 'F#3', 'g': 'G3', 'y': 'G#3', 'h': 'A3',
  'u': 'A#3', 'j': 'B3', 'k': 'C4', 'o': 'C#4', 'l': 'D4',
  'p': 'D#4', ';': 'E4', "'": 'F4', '[': 'F#4', 'z': 'G4',
  ']': 'G#4', 'x': 'A4', 'c': 'A#4', 'v': 'B4', 'b': 'C5'
};

// MIDI note number to note name mapping (C3-C5)
const MIDI_NOTE_MAP = {
  48: 'C3', 49: 'C#3', 50: 'D3', 51: 'D#3',
  52: 'E3', 53: 'F3', 54: 'F#3', 55: 'G3',
  56: 'G#3', 57: 'A3', 58: 'A#3', 59: 'B3',
  60: 'C4', 61: 'C#4', 62: 'D4', 63: 'D#4',
  64: 'E4', 65: 'F4', 66: 'F#4', 67: 'G4',
  68: 'G#4', 69: 'A4', 70: 'A#4', 71: 'B4',
  72: 'C5'
};

// Simple audio - just play the sound, let it ring naturally
function playSound(note) {
  if (!NOTE_PATHS[note]) return;
  const audio = new Audio(NOTE_PATHS[note]);
  audio.play().catch(() => {});
}

// State
let ws = null;
let playerIndex = null;
let roomId = null;
let isRecording = false;
let waitingForFirstNote = false;
let recordedNotes = [];
let receivedMelody = null;
let timerInterval = null;
let timeLeft = 50;

// Maximum notes/chords in a melody (excluding rests)
const MAX_MELODY_NOTES = 10;

// Victory sound
const victorySound = new Audio('/assets/bryansantosbreton-christmas-vibes-windy-whoosh-magical-chimes-180863.mp3');

// Duration tracking
const noteStartTimes = new Map();

// Polyphony/chord tracking
const CHORD_THRESHOLD_MS = 80; // Notes within 80ms are considered a chord
const REST_THRESHOLD_MS = 500; // Gap > 500ms (quarter note ~= 500ms at 120bpm) is a rest
let pendingChordNotes = []; // Notes waiting to be grouped into a chord
let chordTimer = null;
let lastNoteEndTime = null; // For rest detection

// DOM elements
const lobby = document.getElementById('lobby');
const createBtn = document.getElementById('create-btn');
const shareLink = document.getElementById('share-link');
const roomLinkInput = document.getElementById('room-link');

const gameContainer = document.getElementById('game-container');
const game = document.getElementById('game');
const myLettersContainer = document.getElementById('my-letters-container');
const oppLettersContainer = document.getElementById('opp-letters-container');
const turnInfo = document.getElementById('turn-info');
const timerDiv = document.getElementById('timer');
const timeLeftSpan = document.getElementById('time-left');
const message = document.getElementById('message');

const doneBtn = document.getElementById('done-btn');
const listenBtn = document.getElementById('listen-btn');
const submitBtn = document.getElementById('submit-btn');
const forfeitBtn = document.getElementById('forfeit-btn');

// Hand animation elements
const handLeft = document.getElementById('hand-left');
const handRight = document.getElementById('hand-right');

const gameOver = document.getElementById('game-over');
const resultText = document.getElementById('result-text');
const newGameBtn = document.getElementById('new-game-btn');

// Staff container
const staffContainer = document.getElementById('staff');

// Piano keys
const allKeys = document.querySelectorAll('#piano button');

// ==================== VexFlow Staff Rendering ====================

// Quantize duration to VexFlow note type
function quantizeDuration(ms) {
  if (ms <= 187) return '16';   // sixteenth
  if (ms <= 375) return '8';    // eighth
  if (ms <= 750) return 'q';    // quarter
  if (ms <= 1500) return 'h';   // half
  return 'w';                    // whole
}

// Convert note name to VexFlow key format
function noteToVexKey(noteName) {
  // noteName like "C#4" -> "c#/4"
  const match = noteName.match(/^([A-G]#?)(\d)$/);
  if (!match) return null;
  return `${match[1].toLowerCase()}/${match[2]}`;
}

// Check if note should be on bass clef (C3-B3) or treble clef (C4+)
function isBasClef(noteName) {
  const match = noteName.match(/^([A-G]#?)(\d)$/);
  if (!match) return false;
  return parseInt(match[2]) <= 3;
}

// Initialize empty staff
function initStaff() {
  renderStaff([]);
}

// Render notes on grand staff - maintains chronological order
function renderStaff(notes) {
  // Clear previous rendering
  staffContainer.innerHTML = '';

  const width = 470;
  const height = 180;

  const renderer = new Renderer(staffContainer, Renderer.Backends.SVG);
  renderer.resize(width, height);
  const context = renderer.getContext();

  // Set transparent background and off-white stroke/fill for chalkboard look
  context.setBackgroundFillStyle('transparent');
  context.setStrokeStyle('#f5f5dc');
  context.setFillStyle('#f5f5dc');

  // Create treble staff
  const trebleStave = new Stave(10, 20, width - 20);
  trebleStave.addClef('treble');
  trebleStave.setContext(context).draw();

  // Create bass staff
  const bassStave = new Stave(10, 100, width - 20);
  bassStave.addClef('bass');
  bassStave.setContext(context).draw();

  if (notes.length === 0) {
    return;
  }

  // Build parallel treble and bass arrays maintaining chronological order
  const trebleNotes = [];
  const bassNotes = [];

  notes.forEach((n) => {
    const duration = quantizeDuration(n.duration || 300);

    // Handle rest events - add to treble only
    if (n.type === 'rest') {
      trebleNotes.push({
        keys: ['b/4'],
        duration: duration + 'r',
        isRest: true
      });
      // Add matching rest to bass to keep alignment
      bassNotes.push({
        keys: ['d/3'],
        duration: duration + 'r',
        isRest: true
      });
      return;
    }

    // Handle chord events
    if (n.type === 'chord' && n.notes) {
      const trebleKeys = [];
      const bassKeys = [];
      const trebleAccidentals = [];
      const bassAccidentals = [];

      n.notes.forEach((noteName) => {
        const vexKey = noteToVexKey(noteName);
        if (!vexKey) return;

        if (isBasClef(noteName)) {
          bassKeys.push(vexKey);
          if (noteName.includes('#')) bassAccidentals.push(bassKeys.length - 1);
        } else {
          trebleKeys.push(vexKey);
          if (noteName.includes('#')) trebleAccidentals.push(trebleKeys.length - 1);
        }
      });

      // Add actual notes or placeholder rests to maintain alignment
      if (trebleKeys.length > 0) {
        trebleNotes.push({
          keys: trebleKeys,
          duration: duration,
          accidentalIndices: trebleAccidentals
        });
      } else {
        // Placeholder rest on treble
        trebleNotes.push({
          keys: ['b/4'],
          duration: duration + 'r',
          isRest: true
        });
      }

      if (bassKeys.length > 0) {
        bassNotes.push({
          keys: bassKeys,
          duration: duration,
          accidentalIndices: bassAccidentals
        });
      } else {
        // Placeholder rest on bass
        bassNotes.push({
          keys: ['d/3'],
          duration: duration + 'r',
          isRest: true
        });
      }
      return;
    }

    // Handle single note
    const noteName = n.note;
    const vexKey = noteToVexKey(noteName);
    if (!vexKey) return;

    const isBass = isBasClef(noteName);

    if (isBass) {
      bassNotes.push({
        keys: [vexKey],
        duration: duration,
        accidentalIndices: noteName.includes('#') ? [0] : []
      });
      // Placeholder rest on treble
      trebleNotes.push({
        keys: ['b/4'],
        duration: duration + 'r',
        isRest: true
      });
    } else {
      trebleNotes.push({
        keys: [vexKey],
        duration: duration,
        accidentalIndices: noteName.includes('#') ? [0] : []
      });
      // Placeholder rest on bass
      bassNotes.push({
        keys: ['d/3'],
        duration: duration + 'r',
        isRest: true
      });
    }
  });

  // Render both staves
  if (trebleNotes.length > 0) {
    renderNotesOnStave(context, trebleStave, trebleNotes, 'treble');
  }
  if (bassNotes.length > 0) {
    renderNotesOnStave(context, bassStave, bassNotes, 'bass');
  }
}

function renderNotesOnStave(context, stave, notesData, clef) {
  const staveNotes = notesData.map((nd) => {
    const note = new StaveNote({
      keys: nd.keys,
      duration: nd.duration,
      clef: clef
    });

    // Add accidentals for sharps (supports multiple keys in chords)
    if (nd.accidentalIndices && nd.accidentalIndices.length > 0) {
      nd.accidentalIndices.forEach((idx) => {
        note.addModifier(new Accidental('#'), idx);
      });
    }

    return note;
  });

  // Calculate total beats for voice
  const beatValue = {
    'w': 4, 'h': 2, 'q': 1, '8': 0.5, '16': 0.25,
    'wr': 4, 'hr': 2, 'qr': 1, '8r': 0.5, '16r': 0.25 // Rest durations
  };

  let totalBeats = notesData.reduce((sum, nd) => sum + (beatValue[nd.duration] || 1), 0);
  // Round up to nearest measure (4 beats)
  const numBeats = Math.max(4, Math.ceil(totalBeats / 4) * 4);

  try {
    const voice = new Voice({ num_beats: numBeats, beat_value: 4 }).setStrict(false);
    voice.addTickables(staveNotes);

    new Formatter().joinVoices([voice]).format([voice], stave.getWidth() - 50);
    voice.draw(context, stave);
  } catch (e) {
    console.error('VexFlow render error:', e);
  }
}

// ==================== Game Logic ====================

const MAGIC_LETTERS = ['m', 'a', 'g', 'i', 'c'];

function updateLetterImages(container, letterCount) {
  const letterDivs = container.querySelectorAll('[data-letter]');
  letterDivs.forEach((div, index) => {
    const letter = div.dataset.letter;
    if (index < letterCount) {
      // Show filled letter
      div.style.backgroundImage = `url('/src/menu/${letter}.png')`;
    } else {
      // Show blank letter
      div.style.backgroundImage = `url('/src/menu/${letter}_blank.png')`;
    }
  });
}

function updateLetters(letters) {
  const myLetterCount = letters[playerIndex].length;
  const oppLetterCount = letters[playerIndex === 0 ? 1 : 0].length;

  updateLetterImages(myLettersContainer, myLetterCount);
  updateLetterImages(oppLettersContainer, oppLetterCount);
}

function showMessage(text) {
  message.textContent = text;
}

function hideAllControls() {
  doneBtn.style.display = 'none';
  listenBtn.style.display = 'none';
  submitBtn.style.display = 'none';
  timerDiv.style.display = 'none';
}

function showHands() {
  handLeft.style.opacity = '1';
  handRight.style.opacity = '1';
}

function hideHands() {
  handLeft.style.opacity = '0';
  handRight.style.opacity = '0';
}

// Setup recording mode - waits for first note to auto-start
function setupRecordingMode() {
  recordedNotes = [];
  noteStartTimes.clear();
  pendingChordNotes = [];
  chordTimer = null;
  lastNoteEndTime = null;
  isRecording = false;
  waitingForFirstNote = true;
  doneBtn.style.display = 'inline-block';
  showMessage('Play your melody (starts on first note)');
  renderStaff([]);
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
  const wsUrl = `${protocol}//api.pianowizards.andrewklundt.com`;
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
      gameContainer.style.display = 'flex';
      gameOver.style.display = 'none';
      updateLetters(msg.letters);
      initStaff(); // Initialize empty staff

      if (msg.currentTurn === playerIndex) {
        turnInfo.textContent = 'Your turn to record a melody!';
        hideAllControls();
        setupRecordingMode();
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
      showMessage('');
      renderStaff([]); // Clear staff before listening
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
        setupRecordingMode();
      } else {
        // Opponent just attempted, now they record
        showMessage(msg.success ? 'Opponent matched your melody!' : 'Opponent failed! They got a letter.');
        turnInfo.textContent = 'Opponent is recording a melody...';
        hideAllControls();
        renderStaff([]); // Clear staff while waiting
      }
      break;

    case 'game-over':
      stopTimer();
      gameContainer.style.display = 'none';
      gameOver.style.display = 'block';

      if (msg.loser === playerIndex) {
        resultText.textContent = 'You spelled MAGIC! You lose!';
      } else {
        resultText.textContent = 'Opponent spelled MAGIC! You win!';
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

// ==================== Piano Interaction ====================

function handleNoteStart(note) {
  if (!NOTE_PATHS[note]) return;

  playSound(note);

  // Visual feedback
  const keyBtn = document.querySelector(`button[data-note="${note}"]`);
  if (keyBtn) {
    keyBtn.classList.add('active');
  }

  // Auto-start recording on first note
  if (waitingForFirstNote) {
    waitingForFirstNote = false;
    isRecording = true;
    showMessage('Recording...');
  }

  // Track start time for duration calculation
  if (isRecording && !noteStartTimes.has(note)) {
    noteStartTimes.set(note, Date.now());
  }
}

function handleNoteEnd(note) {
  if (!NOTE_PATHS[note]) return;

  // Visual feedback off
  const keyBtn = document.querySelector(`button[data-note="${note}"]`);
  if (keyBtn) {
    keyBtn.classList.remove('active');
  }

  // Record note with duration
  if (isRecording && noteStartTimes.has(note)) {
    const startTime = noteStartTimes.get(note);
    const duration = Date.now() - startTime;
    noteStartTimes.delete(note);

    // Add to pending chord notes
    pendingChordNotes.push({
      note,
      timestamp: startTime,
      duration: Math.max(duration, 100) // Minimum 100ms
    });

    // Debounce chord finalization
    if (chordTimer) clearTimeout(chordTimer);
    chordTimer = setTimeout(finalizeChord, CHORD_THRESHOLD_MS);
  }
}

function finalizeChord() {
  if (pendingChordNotes.length === 0) return;

  // Check for rest (gap since last note ended)
  if (lastNoteEndTime !== null) {
    const gap = pendingChordNotes[0].timestamp - lastNoteEndTime;
    if (gap >= REST_THRESHOLD_MS) {
      // Insert a rest event
      recordedNotes.push({
        type: 'rest',
        timestamp: lastNoteEndTime,
        duration: gap
      });
    }
  }

  // Group pending notes into a chord or single note
  if (pendingChordNotes.length === 1) {
    // Single note
    const n = pendingChordNotes[0];
    recordedNotes.push({
      type: 'note',
      note: n.note,
      timestamp: n.timestamp,
      duration: n.duration
    });
  } else {
    // Chord - multiple notes played together
    // Use earliest timestamp and longest duration
    const timestamp = Math.min(...pendingChordNotes.map(n => n.timestamp));
    const duration = Math.max(...pendingChordNotes.map(n => n.duration));
    const notes = pendingChordNotes.map(n => n.note);

    recordedNotes.push({
      type: 'chord',
      notes: notes,
      timestamp: timestamp,
      duration: duration
    });
  }

  // Update last note end time for rest detection
  lastNoteEndTime = Math.max(...pendingChordNotes.map(n => n.timestamp + n.duration));

  // Clear pending notes
  pendingChordNotes = [];
  chordTimer = null;

  // Update staff in real-time
  renderStaff(recordedNotes);

  // Check if we're in attempt mode (receivedMelody exists) - real-time match checking
  if (receivedMelody && isRecording) {
    if (checkMelodyMatch()) {
      // Instant victory!
      isRecording = false;
      stopTimer();
      victorySound.play();
      showMessage('Perfect! You matched it!');

      // Send attempt to server
      ws.send(JSON.stringify({ type: 'attempt-submit', notes: recordedNotes }));
      receivedMelody = null; // Clear to prevent issues when transitioning to recording
      hideAllControls();
      turnInfo.textContent = 'Great job! Get ready to record...';

      // After 1.5 seconds, setup for next recording turn
      setTimeout(() => {
        // The server will send turn-result which will trigger setupRecordingMode
      }, 1500);
      return;
    }

    // Check attempt note limit
    const attemptNoteCount = recordedNotes.filter(n => n.type !== 'rest').length;
    if (attemptNoteCount >= MAX_MELODY_NOTES) {
      showMessage('Max 10 notes reached - submitting attempt');
      isRecording = false;
      stopTimer();
      ws.send(JSON.stringify({ type: 'attempt-submit', notes: recordedNotes }));
      hideAllControls();
      turnInfo.textContent = 'Checking your attempt...';
      return;
    }
  }

  // Check melody note limit (only when recording a new melody, not attempting)
  if (!receivedMelody && isRecording) {
    const noteCount = recordedNotes.filter(n => n.type !== 'rest').length;
    if (noteCount >= MAX_MELODY_NOTES) {
      showMessage('Max 10 notes reached - submitting melody');
      // Auto-submit the melody
      isRecording = false;
      ws.send(JSON.stringify({ type: 'melody-submit', notes: recordedNotes }));
      doneBtn.style.display = 'none';
      turnInfo.textContent = 'Waiting for opponent to replay...';
    }
  }
}

// Check if recorded notes match received melody (note-only comparison)
function checkMelodyMatch() {
  if (!receivedMelody) return false;

  // Get only note/chord events (exclude rests)
  const targetNotes = receivedMelody.filter(n => n.type === 'chord' || n.type === 'note' || n.note);
  const playedNotes = recordedNotes.filter(n => n.type === 'chord' || n.type === 'note' || n.note);

  // Must have same number of notes
  if (playedNotes.length !== targetNotes.length) return false;

  // Compare each note/chord
  for (let i = 0; i < targetNotes.length; i++) {
    const target = targetNotes[i];
    const played = playedNotes[i];

    // Get notes array from each event
    const targetNotesArr = (target.notes || [target.note]).sort();
    const playedNotesArr = (played.notes || [played.note]).sort();

    // Check if notes match
    if (targetNotesArr.length !== playedNotesArr.length) return false;
    for (let j = 0; j < targetNotesArr.length; j++) {
      if (targetNotesArr[j] !== playedNotesArr[j]) return false;
    }
  }

  return true;
}

// Keyboard input
const activeKeys = new Set();

document.addEventListener('keydown', (e) => {
  if (e.repeat) return;
  const note = KEY_MAP[e.key.toLowerCase()];
  if (note && !activeKeys.has(e.key.toLowerCase())) {
    activeKeys.add(e.key.toLowerCase());
    handleNoteStart(note);
  }
});

document.addEventListener('keyup', (e) => {
  const note = KEY_MAP[e.key.toLowerCase()];
  if (note) {
    activeKeys.delete(e.key.toLowerCase());
    handleNoteEnd(note);
  }
});

// Click/touch on piano keys
allKeys.forEach((btn) => {
  const note = btn.dataset.note;
  if (!note) return;

  btn.addEventListener('mousedown', (e) => {
    e.preventDefault();
    handleNoteStart(note);
  });

  btn.addEventListener('mouseup', () => {
    handleNoteEnd(note);
  });

  btn.addEventListener('mouseleave', () => {
    if (noteStartTimes.has(note)) {
      handleNoteEnd(note);
    }
  });

  // Touch events for mobile
  btn.addEventListener('touchstart', (e) => {
    e.preventDefault();
    handleNoteStart(note);
  });

  btn.addEventListener('touchend', () => {
    handleNoteEnd(note);
  });
});

// ==================== Controls ====================

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

doneBtn.addEventListener('click', () => {
  isRecording = false;
  waitingForFirstNote = false;

  // Finalize any pending chord notes
  if (chordTimer) {
    clearTimeout(chordTimer);
    chordTimer = null;
  }
  if (pendingChordNotes.length > 0) {
    finalizeChord();
  }

  noteStartTimes.clear();
  pendingChordNotes = [];
  lastNoteEndTime = null;

  if (recordedNotes.length === 0) {
    showMessage('You need to play at least one note!');
    setupRecordingMode();
    return;
  }
  ws.send(JSON.stringify({ type: 'melody-submit', notes: recordedNotes }));
  doneBtn.style.display = 'none';
  turnInfo.textContent = 'Waiting for opponent to replay...';
  showMessage('');
});

listenBtn.addEventListener('click', () => {
  if (!receivedMelody || receivedMelody.length === 0) return;

  listenBtn.disabled = true;

  // Show hands animation during playback
  showHands();

  // Show the melody on staff while playing
  renderStaff(receivedMelody);

  // Play back the melody
  const startTime = receivedMelody[0].timestamp;
  receivedMelody.forEach((n, i) => {
    const delay = n.timestamp - startTime;
    setTimeout(() => {
      // Skip rests (no audio, just timing gap)
      if (n.type === 'rest') {
        // Check if this is the last event
        if (i === receivedMelody.length - 1) {
          setTimeout(() => {
            enableRecordingAttempt();
          }, n.duration || 300);
        }
        return;
      }

      // Handle chord events (multiple notes)
      if (n.type === 'chord' && n.notes) {
        n.notes.forEach((noteName) => {
          playSound(noteName);
          const keyBtn = document.querySelector(`button[data-note="${noteName}"]`);
          if (keyBtn) {
            keyBtn.classList.add('active');
            setTimeout(() => keyBtn.classList.remove('active'), n.duration || 150);
          }
        });
      } else {
        // Single note
        const noteName = n.note;
        playSound(noteName);
        const keyBtn = document.querySelector(`button[data-note="${noteName}"]`);
        if (keyBtn) {
          keyBtn.classList.add('active');
          setTimeout(() => keyBtn.classList.remove('active'), n.duration || 150);
        }
      }

      if (i === receivedMelody.length - 1) {
        // Done playing, enable recording attempt
        setTimeout(() => {
          enableRecordingAttempt();
        }, n.duration || 300);
      }
    }, delay);
  });
});

function enableRecordingAttempt() {
  // Hide hands after melody playback
  hideHands();

  listenBtn.disabled = false;
  listenBtn.style.display = 'inline-block';
  submitBtn.style.display = 'inline-block';
  recordedNotes = [];
  noteStartTimes.clear();
  pendingChordNotes = [];
  chordTimer = null;
  lastNoteEndTime = null;
  isRecording = false;
  waitingForFirstNote = true;
  startTimer();
  showMessage('Now try to replay it! (starts on first note)');
  // Keep staff visible with the melody for sight reading - don't clear it!
}

submitBtn.addEventListener('click', () => {
  isRecording = false;
  waitingForFirstNote = false;

  // Finalize any pending chord notes
  if (chordTimer) {
    clearTimeout(chordTimer);
    chordTimer = null;
  }
  if (pendingChordNotes.length > 0) {
    finalizeChord();
  }

  noteStartTimes.clear();
  pendingChordNotes = [];
  lastNoteEndTime = null;
  stopTimer();
  ws.send(JSON.stringify({ type: 'attempt-submit', notes: recordedNotes }));
  hideAllControls();
  turnInfo.textContent = 'Checking your attempt...';
});

newGameBtn.addEventListener('click', () => {
  ws.send(JSON.stringify({ type: 'new-game' }));
});

forfeitBtn.addEventListener('click', () => {
  if (ws && ws.readyState === 1) {
    ws.send(JSON.stringify({ type: 'forfeit' }));
  }
});

// Auto-connect if joining via URL
const pathRoomId = location.pathname.slice(1);
if (pathRoomId && pathRoomId.length === 8) {
  lobby.innerHTML = '<p>Joining game...</p>';
  connectWebSocket();
}

// ==================== MIDI Input ====================

// Track active MIDI notes for note-on/note-off
const activeMidiNotes = new Set();

function setupMidi() {
  if (!window.WebMidi) {
    console.warn('WebMidi not available');
    return;
  }

  // If no MIDI devices, just continue silently
  if (WebMidi.inputs.length === 0) {
    console.log('No MIDI input devices detected - continuing without MIDI');
    return;
  }

  const input = WebMidi.inputs[0];
  console.log('Using MIDI input:', input.name);

  // Listen for note-on events
  input.addListener('noteon', (e) => {
    const midiNumber = e.note.number;
    const noteName = MIDI_NOTE_MAP[midiNumber];

    if (noteName && !activeMidiNotes.has(midiNumber)) {
      activeMidiNotes.add(midiNumber);
      handleNoteStart(noteName);
    }
  });

  // Listen for note-off events
  input.addListener('noteoff', (e) => {
    const midiNumber = e.note.number;
    const noteName = MIDI_NOTE_MAP[midiNumber];

    if (noteName && activeMidiNotes.has(midiNumber)) {
      activeMidiNotes.delete(midiNumber);
      handleNoteEnd(noteName);
    }
  });
}

// Initialize WebMidi silently - no alerts if no device found
if (window.WebMidi) {
  WebMidi.enable()
    .then(setupMidi)
    .catch((err) => console.log('MIDI not available:', err.message));
}
