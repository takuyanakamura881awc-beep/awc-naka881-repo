import { useEffect, useState } from "react";
import { GameProvider, useGame } from "./state/GameContext";
import { Home } from "./ui/screens/Home";
import { HorseForm } from "./ui/screens/HorseForm";
import { HorseDetail } from "./ui/screens/HorseDetail";
import { LogForm } from "./ui/screens/LogForm";
import { Settings } from "./ui/screens/Settings";
import { getLog } from "./db/repo";
import type { RaceLog } from "./domain/types";
import type { View } from "./ui/nav";

function Router() {
  const { loading, horses } = useGame();
  const [view, setView] = useState<View>("home");

  if (loading) return <div className="screen center">読み込み中…</div>;

  if (view === "home") return <Home go={setView} />;
  if (view === "create") return <HorseForm go={setView} />;
  if (view === "settings") return <Settings go={setView} />;

  if (typeof view === "object" && "horse" in view) {
    return <HorseDetail id={view.horse} go={setView} />;
  }
  if (typeof view === "object" && "edit" in view) {
    const horse = horses.find((h) => h.id === view.edit);
    if (!horse) return <Home go={setView} />;
    return <HorseForm existing={horse} go={setView} />;
  }
  if (typeof view === "object" && "log" in view) {
    return <LogRoute horseId={view.log.horseId} logId={view.log.logId} go={setView} />;
  }
  return <Home go={setView} />;
}

function LogRoute({
  horseId,
  logId,
  go,
}: {
  horseId: string;
  logId?: string;
  go: (v: View) => void;
}) {
  const [existing, setExisting] = useState<RaceLog | undefined>();
  const [ready, setReady] = useState(!logId);

  useEffect(() => {
    if (!logId) return;
    (async () => {
      setExisting(await getLog(logId));
      setReady(true);
    })();
  }, [logId]);

  if (!ready) return <div className="screen center">読み込み中…</div>;
  return <LogForm horseId={horseId} existing={existing} go={go} />;
}

export default function App() {
  return (
    <GameProvider>
      <div className="app">
        <header className="app-header">
          <span className="app-title">Stable Saga</span>
          <span className="app-sub">スタホR 管理ツール</span>
        </header>
        <main>
          <Router />
        </main>
      </div>
    </GameProvider>
  );
}
