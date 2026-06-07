import { useState } from "react";
import { GameProvider, useGame } from "./state/GameContext";
import { Home } from "./ui/screens/Home";
import { CreateHorse } from "./ui/screens/CreateHorse";
import { HorseDetail } from "./ui/screens/HorseDetail";
import { Settings } from "./ui/screens/Settings";
import type { View } from "./ui/nav";

function Router() {
  const { loading } = useGame();
  const [view, setView] = useState<View>("home");

  if (loading) {
    return <div className="screen center">読み込み中…</div>;
  }

  if (view === "home") return <Home go={setView} />;
  if (view === "create") return <CreateHorse go={setView} />;
  if (view === "settings") return <Settings go={setView} />;
  if (typeof view === "object" && "horse" in view) {
    return <HorseDetail id={view.horse} go={setView} />;
  }
  return <Home go={setView} />;
}

export default function App() {
  return (
    <GameProvider>
      <div className="app">
        <header className="app-header">
          <span className="app-title">Stable Saga</span>
          <span className="app-sub">育成シミュレーション</span>
        </header>
        <main>
          <Router />
        </main>
      </div>
    </GameProvider>
  );
}
