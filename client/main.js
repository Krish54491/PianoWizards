const NOTE_PATHS = {
  C3: "assets/notes/48.mp3",
  "C#3": "assets/notes/49.mp3",
  D3: "assets/notes/50.mp3",
  "D#3": "assets/notes/51.mp3",
  E3: "assets/notes/52.mp3",
  F3: "assets/notes/53.mp3",
  "F#3": "assets/notes/54.mp3",
  G3: "assets/notes/55.mp3",
  "G#3": "assets/notes/56.mp3",
  A3: "assets/notes/57.mp3",
  "A#3": "assets/notes/58.mp3",
  B3: "assets/notes/59.mp3",
  C4: "assets/notes/60.mp3",
  "C#4": "assets/notes/61.mp3",
  D4: "assets/notes/62.mp3",
  "D#4": "assets/notes/63.mp3",
  E4: "assets/notes/64.mp3",
  F4: "assets/notes/65.mp3",
  "F#4": "assets/notes/66.mp3",
  G4: "assets/notes/67.mp3",
  "G#4": "assets/notes/68.mp3",
  A4: "assets/notes/69.mp3",
  "A#4": "assets/notes/70.mp3",
  B4: "assets/notes/71.mp3",
  C5: "assets/notes/72.mp3",
};
// Key to note mapping
const KEY_MAP = {
  a: "C3",
  w: "C#3",
  s: "D3",
  e: "D#3",
  d: "E3",
  f: "F3",
  t: "F#3",
  g: "G3",
  y: "G#3",

  h: "A3",
  u: "A#3",
  j: "B3",

  k: "C4",
  o: "C#4",

  l: "D4",
  p: "D#4",

  ";": "E4",
  "'": "F4",
  "[": "F#4",
  z: "G4",
  "]": "G#4",

  x: "A4",
  v: "B4",
  c: "A#4",
  b: "C5",
};

// MIDI note number to note name mapping (MIDI C4 = 60)
const MIDI_NOTE_MAP = {
  48: "C3",
  49: "C#3",
  50: "D3",
  51: "D#3",
  52: "E3",
  53: "F3",
  54: "F#3",
  55: "G3",
  56: "G#3",
  57: "A3",
  58: "A#3",
  59: "B3",
  60: "C4",
  61: "C#4",
  62: "D4",
  63: "D#4",
  64: "E4",
  65: "F4",
  66: "F#4",
  67: "G4",
  68: "G#4",
  69: "A4",
  70: "A#4",
  71: "B4",
  72: "C5", // end of use for our midi
  73: "C#5",
  74: "D5",
  75: "D#5",
  76: "E5",
  77: "F5",
  78: "F#5",
  79: "G5",
  80: "G#5",
  81: "A5",
  82: "A#5",
  83: "B5",
};

let audioCtx = null;

function getAudioContext() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  return audioCtx;
}

function playNote(note, duration = 0.3) {
  // const ctx = getAudioContext();
  // const freq = NOTE_FREQS[note];
  // if (!freq) return;

  // const osc = ctx.createOscillator();
  // const gain = ctx.createGain();

  // osc.type = "sine";
  // osc.frequency.value = freq;

  // gain.gain.setValueAtTime(0.3, ctx.currentTime);
  // gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration);

  // osc.connect(gain);
  // gain.connect(ctx.destination);

  // osc.start();
  // osc.stop(ctx.currentTime + duration);
  const audio = new Audio(NOTE_PATHS[note]);
  audio.play();
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
const successAudio = new Audio(
  "assets/bryansantosbreton-christmas-vibes-windy-whoosh-magical-chimes-180863.mp3",
);

// DOM elements
const lobby = document.getElementById("lobby");
const createBtn = document.getElementById("create-btn");
const shareLink = document.getElementById("share-link");
const roomLinkInput = document.getElementById("room-link");

const game = document.getElementById("game");
const myLetters = document.getElementById("my-letters");
const oppLetters = document.getElementById("opp-letters");
const turnInfo = document.getElementById("turn-info");
const timerDiv = document.getElementById("timer");
const timeLeftSpan = document.getElementById("time-left");
const message = document.getElementById("message");

const recordBtn = document.getElementById("record-btn");
const doneBtn = document.getElementById("done-btn");
const listenBtn = document.getElementById("listen-btn");
const submitBtn = document.getElementById("submit-btn");

const gameOver = document.getElementById("game-over");
const resultText = document.getElementById("result-text");
const newGameBtn = document.getElementById("new-game-btn");

// Piano keys
const allKeys = document.querySelectorAll("#piano button");

function formatLetters(letters) {
  return (letters + "____").slice(0, 4);
}

function updateLetters(letters) {
  myLetters.textContent = formatLetters(letters[playerIndex]);
  oppLetters.textContent = formatLetters(letters[playerIndex === 0 ? 1 : 0]);
}

function showMessage(text) {
  message.textContent = text;
}

function hideAllControls() {
  recordBtn.style.display = "none";
  doneBtn.style.display = "none";
  listenBtn.style.display = "none";
  submitBtn.style.display = "none";
  timerDiv.style.display = "none";
}

function startTimer() {
  timeLeft = 50;
  timeLeftSpan.textContent = timeLeft;
  timerDiv.style.display = "block";

  timerInterval = setInterval(() => {
    timeLeft--;
    timeLeftSpan.textContent = timeLeft;
    if (timeLeft <= 0) {
      clearInterval(timerInterval);
      // Auto-submit empty attempt (will fail)
      ws.send(JSON.stringify({ type: "attempt-submit", notes: recordedNotes }));
    }
  }, 1000);
}

function stopTimer() {
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
  timerDiv.style.display = "none";
}

function connectWebSocket() {
  const protocol = location.protocol === "https:" ? "wss:" : "ws:";
  const wsUrl = `${protocol}//${location.hostname}:3001`;
  ws = new WebSocket(wsUrl);

  ws.onopen = () => {
    console.log("Connected to server");

    // Check if joining via URL
    const pathRoomId = location.pathname.slice(1);
    if (pathRoomId && pathRoomId.length === 8) {
      ws.send(JSON.stringify({ type: "join-room", roomId: pathRoomId }));
    }
  };

  ws.onmessage = (event) => {
    const msg = JSON.parse(event.data);
    handleMessage(msg);
  };

  ws.onclose = () => {
    console.log("Disconnected from server");
  };
}

function handleMessage(msg) {
  switch (msg.type) {
    case "room-created":
      roomId = msg.roomId;
      playerIndex = msg.playerIndex;
      roomLinkInput.value = `${location.origin}/${roomId}`;
      shareLink.style.display = "block";
      break;

    case "room-joined":
      roomId = msg.roomId;
      playerIndex = msg.playerIndex;
      lobby.style.display = "none";
      break;

    case "opponent-joined":
      lobby.style.display = "none";
      break;

    case "game-start":
      game.style.display = "block";
      gameOver.style.display = "none";
      updateLetters(msg.letters);

      if (msg.currentTurn === playerIndex) {
        turnInfo.textContent = "Your turn to record a melody!";
        hideAllControls();
        recordBtn.style.display = "inline-block";
      } else {
        turnInfo.textContent = "Opponent is recording a melody...";
        hideAllControls();
      }
      showMessage("");
      break;

    case "melody-received":
      receivedMelody = msg.notes;
      turnInfo.textContent = "Listen to the melody, then try to replay it!";
      hideAllControls();
      listenBtn.style.display = "inline-block";
      showMessage(`Melody has ${msg.notes.length} notes`);
      break;

    case "turn-result":
      stopTimer();
      updateLetters(msg.letters);

      const wasMyAttempt =
        msg.currentTurn === playerIndex
          ? true
          : isWithinHalfStep(msg.attemptedNote, msg.targetNote);
      if (wasMyAttempt) {
        // I just attempted, now I record
        showMessage(
          msg.success ? "Nice! You matched it!" : "Oops! You got a letter.",
        );
        // play magical sound
        if (msg.success) {
          successAudio.play();
        }
        turnInfo.textContent = "Your turn to record a melody!";
        hideAllControls();
        recordBtn.style.display = "inline-block";
      } else {
        // Opponent just attempted, now they record
        showMessage(
          msg.success
            ? "Opponent matched your melody!"
            : "Opponent failed! They got a letter.",
        );
        turnInfo.textContent = "Opponent is recording a melody...";
        hideAllControls();
      }
      break;

    case "game-over":
      stopTimer();
      game.style.display = "none";
      gameOver.style.display = "block";

      if (msg.loser === playerIndex) {
        resultText.textContent = "You spelled MAGE! You lose!";
      } else {
        resultText.textContent = "Opponent spelled MAGE! You win!";
      }
      break;

    case "opponent-disconnected":
      showMessage("Opponent disconnected!");
      turnInfo.textContent = "Game ended";
      hideAllControls();
      break;

    case "error":
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
    keyBtn.classList.add("active");
    setTimeout(() => keyBtn.classList.remove("active"), 150);
  }

  // Record if recording (max 30 notes)
  if (isRecording) {
    if (recordedNotes.length < 30) {
      recordedNotes.push({ note, timestamp: Date.now() });
    } else {
      showMessage("Maximum 30 notes reached! Click Done to submit.");
    }
  }
}

// Keyboard input
document.addEventListener("keydown", (e) => {
  if (e.repeat) return;
  const note = KEY_MAP[e.key.toLowerCase()];
  if (note) {
    handleNotePlay(note);
  }
});

// Click on piano keys
allKeys.forEach((btn) => {
  btn.addEventListener("mousedown", () => {
    const note = btn.dataset.note;
    if (note) {
      handleNotePlay(note);
    }
  });
});

// Controls
createBtn.addEventListener("click", () => {
  connectWebSocket();
  ws.onopen = () => {
    ws.send(JSON.stringify({ type: "create-room" }));

    const pathRoomId = location.pathname.slice(1);
    if (pathRoomId && pathRoomId.length === 8) {
      ws.send(JSON.stringify({ type: "join-room", roomId: pathRoomId }));
    }
  };
});

recordBtn.addEventListener("click", () => {
  isRecording = true;
  recordedNotes = [];
  recordBtn.style.display = "none";
  doneBtn.style.display = "inline-block";
  showMessage("Recording... play your melody!");
});

doneBtn.addEventListener("click", () => {
  isRecording = false;
  if (recordedNotes.length === 0) {
    showMessage("You need to play at least one note!");
    recordBtn.style.display = "inline-block";
    doneBtn.style.display = "none";
    return;
  }
  ws.send(JSON.stringify({ type: "melody-submit", notes: recordedNotes }));
  doneBtn.style.display = "none";
  turnInfo.textContent = "Waiting for opponent to replay...";
  showMessage(`Sent melody with ${recordedNotes.length} notes`);
});

listenBtn.addEventListener("click", () => {
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
        listenBtn.style.display = "inline-block";
        submitBtn.style.display = "inline-block";
        recordedNotes = [];
        isRecording = true;
        startTimer();
        showMessage("Now try to replay it! Recording...");
      }
    }, delay);
  });
});

submitBtn.addEventListener("click", () => {
  isRecording = false;
  stopTimer();
  ws.send(JSON.stringify({ type: "attempt-submit", notes: recordedNotes }));
  hideAllControls();
  turnInfo.textContent = "Checking your attempt...";
});

newGameBtn.addEventListener("click", () => {
  ws.send(JSON.stringify({ type: "new-game" }));
});

// Auto-connect if joining via URL
const pathRoomId = location.pathname.slice(1);
if (pathRoomId && pathRoomId.length === 8) {
  lobby.innerHTML = "<p>Joining game...</p>";
  connectWebSocket();
}

function setupMidi() {
  if (!window.WebMidi) {
    console.warn("WebMidi not available");
    return;
  }

  // If no MIDI devices
  if (WebMidi.inputs.length === 0) {
    console.warn("No MIDI input devices detected");
    return;
  }

  const input = WebMidi.inputs[0];
  console.log("Using MIDI input:", input.name);

  // Listen for note-on events
  input.addListener("noteon", "all", (e) => {
    const midiNumber = e.note.number; // e.g. 60
    const noteName = MIDI_NOTE_MAP[midiNumber];

    if (noteName) {
      handleNotePlay(noteName);
    }
  });
}
// Wait until WebMidi is ready
if (window.WebMidi) {
  if (WebMidi.enabled) {
    setupMidi();
  } else {
    WebMidi.enable()
      .then(setupMidi)
      .catch((err) => console.error("MIDI error:", err));
  }
}
input.addListener("noteon", "all", (e) => {
  if (e.velocity < 0.1) return;

  const noteName = MIDI_NOTE_MAP[e.note.number];
  if (noteName) {
    handleNotePlay(noteName);
  }
});
function isWithinHalfStep(noteA, noteB) {
  if (!noteA || !noteB) return false;

  // Reverse lookup: note name → MIDI number
  const noteToMidi = Object.entries(MIDI_NOTE_MAP).reduce(
    (acc, [midi, name]) => {
      acc[name] = Number(midi);
      return acc;
    },
    {},
  );

  const midiA = noteToMidi[noteA];
  const midiB = noteToMidi[noteB];

  if (midiA === undefined || midiB === undefined) return false;

  return Math.abs(midiA - midiB) <= 1;
}
