import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { registerSW } from "virtual:pwa-register";
import App from "./App";
import { requestPersistentStorage } from "./pwa/persist";
import "./styles.css";

// Service Worker（オフライン動作・自動更新）。
registerSW({ immediate: true });

// 消失対策：永続ストレージを早めに要求（ジェスチャ不要のブラウザが多い）。
requestPersistentStorage();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
