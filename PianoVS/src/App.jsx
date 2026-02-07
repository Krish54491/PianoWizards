import { useState } from "react";
import Horse from "./Horse.jsx";
export default function App() {
  const [gameMode, setGameMode] = useState("menu");
  switch (gameMode) {
    case "menu":
      // put menu code here and make sure you can change game mode
      // temp
      return (
        <button onClick={() => setGameMode("horse")}>Start Horse Game</button>
      );
    case "horse":
      return <Horse setGameMode={setGameMode} />;
    default:
      return <div>ERROR</div>;
  }
}
