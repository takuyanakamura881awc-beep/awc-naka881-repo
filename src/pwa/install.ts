// ホーム画面インストール促進。beforeinstallprompt を捕捉して任意のタイミングで提示する。

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

let deferred: BeforeInstallPromptEvent | null = null;
const listeners = new Set<(available: boolean) => void>();

window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  deferred = e as BeforeInstallPromptEvent;
  listeners.forEach((l) => l(true));
});

window.addEventListener("appinstalled", () => {
  deferred = null;
  listeners.forEach((l) => l(false));
});

export function canInstall(): boolean {
  return deferred !== null;
}

export function onInstallAvailabilityChange(
  cb: (available: boolean) => void,
): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export async function promptInstall(): Promise<boolean> {
  if (!deferred) return false;
  await deferred.prompt();
  const choice = await deferred.userChoice;
  deferred = null;
  listeners.forEach((l) => l(false));
  return choice.outcome === "accepted";
}

// スタンドアロン（インストール済み）で開かれているか。
export function isStandalone(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    // iOS Safari
    (navigator as unknown as { standalone?: boolean }).standalone === true
  );
}
