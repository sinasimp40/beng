import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

let preloaderDismissed = false;

function dismissPreloader() {
  if (preloaderDismissed) return;
  preloaderDismissed = true;
  const preloader = document.getElementById('preloader');
  if (preloader) {
    preloader.classList.add('fade-out');
    preloader.setAttribute('aria-hidden', 'true');
    setTimeout(() => preloader.remove(), 600);
  }
}

(window as any).__dismissPreloader = dismissPreloader;

setTimeout(dismissPreloader, 5000);

createRoot(document.getElementById("root")!).render(<App />);
