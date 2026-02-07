import React, { useEffect, useState } from "react";

function Piano() {
  // Keep the original keyboardtoNote mapping exactly as requested
  const keyboardtoNote = {
    1: "C2",
    "!": "C#2",
    2: "D2",
    "@": "D#2",
    3: "E2",
    4: "F2",
    $: "F#2",
    5: "G2",
    "%": "G#2",
    6: "A2",
    "^": "A#2",
    7: "B2",
    8: "C3",
    "*": "C#3",
    9: "D3",
    "(": "D#3",
    0: "E3",
    q: "F3",
    Q: "F#3",
    w: "G3",
    W: "G#3",
    e: "A3",
    E: "A#3",
    r: "B3",
    t: "C4",
    T: "C#4",
    y: "D4",
    Y: "D#4",
    u: "E4",
    i: "F4",
    I: "F#4",
    o: "G4",
    O: "G#4",
    p: "A4",
    P: "A#4",
    a: "B4",
    s: "C5",
    S: "C#5",
    d: "D5",
    D: "D#5",
    f: "E5",
    g: "F5",
    G: "F#5",
    h: "G5",
    H: "G#5",
    j: "A5",
    J: "A#5",
    k: "B5",
    l: "C6",
    L: "C#6",
    z: "D6",
    Z: "D#6",
    x: "E6",
    c: "F6",
    C: "F#6",
    v: "G6",
    V: "G#6",
    b: "A6",
    B: "A#6",
    n: "B6",
    m: "C7",
  };

  // Sets in javascript are cringe, so we need to repeat the notes
  const orderedNotes = [
    "C2",
    "C#2",
    "D2",
    "D#2",
    "E2",
    "F2",
    "F#2",
    "G2",
    "G#2",
    "A2",
    "A#2",
    "B2",
    "C3",
    "C#3",
    "D3",
    "D#3",
    "E3",
    "F3",
    "F#3",
    "G3",
    "G#3",
    "A3",
    "A#3",
    "B3",
    "C4",
    "C#4",
    "D4",
    "D#4",
    "E4",
    "F4",
    "F#4",
    "G4",
    "G#4",
    "A4",
    "A#4",
    "B4",
    "C5",
    "C#5",
    "D5",
    "D#5",
    "E5",
    "F5",
    "F#5",
    "G5",
    "G#5",
    "A5",
    "A#5",
    "B5",
    "C6",
    "C#6",
    "D6",
    "D#6",
    "E6",
    "F6",
    "F#6",
    "G6",
    "G#6",
    "A6",
    "A#6",
    "B6",
    "C7",
  ];

  // invert mapping: note -> triggering key(s)
  const noteToKeys = {};
  Object.keys(keyboardtoNote).forEach((k) => {
    const note = keyboardtoNote[k];
    if (!note) return;
    if (!noteToKeys[note]) noteToKeys[note] = [];
    noteToKeys[note].push(String(k));
  });

  const [keysPressed, setKeysPressed] = useState(() => new Set());

  useEffect(() => {
    function onKeyDown(e) {
      const key = e.key;
      const note = keyboardtoNote[key];
      if (note) {
        setKeysPressed((prev) => {
          const s = new Set(prev);
          s.add(note);
          return s;
        });
      }
    }

    function onKeyUp(e) {
      const key = e.key;
      const note = keyboardtoNote[key];
      if (note) {
        setKeysPressed((prev) => {
          const s = new Set(prev);
          s.delete(note);
          return s;
        });
      }
    }

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, []);

  // helper for mouse interactions (makes clicking keys add/remove to pressed set)
  function pressNote(note) {
    setKeysPressed((prev) => {
      const s = new Set(prev);
      s.add(note);
      return s;
    });
  }
  function releaseNote(note) {
    setKeysPressed((prev) => {
      const s = new Set(prev);
      s.delete(note);
      return s;
    });
  }
  const textSize = 14;
  return (
    <div style={{ userSelect: "none" }}>
      <style>{`
        .piano { position: relative; height: 180px; padding: 12px; background: #222; border-radius: 6px; }
        .white-keys { display: flex; height: 160px; }
        .white { width: 40px; height: 160px;color:black; background: #fff; border: 1px solid #333; box-sizing: border-box; position: relative; display: flex; align-items: flex-end; justify-content: center; font-size: ${textSize}px; font-weight: bold; }
        .black { width: 28px; height: 100px; background: linear-gradient(#111,#444); position: absolute; z-index: 2; border-radius:4px; box-shadow: 0 4px 6px rgba(0,0,0,0.6); color: white; display: flex; align-items: center; justify-content: center; font-size: ${textSize}px; font-weight: bold; }
        .key-dim { filter: brightness(0.6); }
      `}</style>

      <div className="piano">
        <div className="white-keys">
          {orderedNotes
            .filter((n) => !n.includes("#"))
            .map((note) => {
              const isActive = keysPressed.has(note);
              const labels = noteToKeys[note] ? noteToKeys[note].join(",") : "";
              return (
                <div
                  key={note}
                  className={"white" + (isActive ? " key-dim" : "")}
                  onMouseDown={() => pressNote(note)}
                  onMouseUp={() => releaseNote(note)}
                  onMouseLeave={() => releaseNote(note)}
                >
                  {labels}
                </div>
              );
            })}
        </div>

        {/* black keys overlay */}
        {orderedNotes.map((note, idx) => {
          if (!note.includes("#")) return null;
          const whiteNotes = orderedNotes.filter((n) => !n.includes("#"));
          const base = note.replace("#", "");
          const i = whiteNotes.indexOf(base);
          const left = 12 + i * 40 + 28;
          const isActive = keysPressed.has(note);
          const labels = noteToKeys[note] ? noteToKeys[note].join(",") : "";
          return (
            <div
              key={note}
              className={"black" + (isActive ? " key-dim" : "")}
              style={{ left: left + "px", top: "12px" }}
              onMouseDown={() => pressNote(note)}
              onMouseUp={() => releaseNote(note)}
              onMouseLeave={() => releaseNote(note)}
              title={labels}
            >
              {labels}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function Horse({ setGameMode }) {
  return (
    <>
      <button onClick={() => setGameMode("menu")}>Back to Menu</button>
      <div className="">
        <Piano />
      </div>
    </>
  );
}
