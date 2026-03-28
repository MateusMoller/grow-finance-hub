import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    const baseUrl = import.meta.env.BASE_URL || "/";
    const serviceWorkerUrl = `${baseUrl}sw.js`;

    navigator.serviceWorker.register(serviceWorkerUrl, { scope: baseUrl }).catch((error) => {
      console.error("Service Worker registration failed:", error);
    });
  });
}

createRoot(document.getElementById("root")!).render(<App />);
