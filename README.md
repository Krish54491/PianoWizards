# Piano MAGE Duel

A simple real-time multiplayer piano game. Take turns playing melodies - one player records, the other tries to replay it. Fail and you get a letter (M-A-G-E). First to spell MAGE loses!

## Setup

```bash
# Install dependencies
npm install
cd client && npm install
cd ../server && npm install
cd ..

# Run both server and client
npm run dev
```

Or run separately:
```bash
# Terminal 1 - Server
cd server && node index.js

# Terminal 2 - Client
cd client && npm run dev
```

## How to Play

1. Open http://localhost:5173
2. Click "Create Game" and share the link with a friend
3. Player 1 records a melody using keyboard keys, then clicks "Done"
4. Player 2 listens to the melody, then tries to replay it within 50 seconds
5. If they fail, they get a letter toward MAGE
6. Roles switch - now Player 2 records and Player 1 replays
7. First to spell MAGE loses!

## Controls

**White keys (bottom row):** A S D F G H J K L → C4 D4 E4 F4 G4 A4 B4 C5 D5

**Black keys (top row):** W E T Y U O P → C#4 D#4 F#4 G#4 A#4 C#5 D#5

## Tech Stack

- Frontend: Vite + Vanilla JS + Web Audio API
- Backend: Node.js + WebSocket (ws library)
- No database - rooms stored in memory

