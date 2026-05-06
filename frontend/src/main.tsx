import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { registerSW } from "virtual:pwa-register";
import App from "./App";
import { STANDALONE } from "./api/client";
import "./styles/index.css";

registerSW({ immediate: true });

async function boot() {
  if (STANDALONE) {
    const { bootstrapSeedIfNeeded } = await import("./lib/seed");
    try {
      const r = await bootstrapSeedIfNeeded();
      if (r.loaded > 0) console.info(`[fc26] seed cargado: ${r.loaded} sorteos`);
    } catch (e) {
      console.error("[fc26] seed bootstrap falló", e);
    }
  }
  ReactDOM.createRoot(document.getElementById("root")!).render(
    <React.StrictMode>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </React.StrictMode>,
  );
}

boot();
