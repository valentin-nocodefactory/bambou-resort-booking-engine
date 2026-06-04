import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";

// NB : pas de <StrictMode> — en dev il double-invoque les effets (donc chaque appel
// Mews apparaîtrait 2× dans le Dev Panel). On le retire pour un journal d'appels fidèle
// au comportement de production (un appel = une ligne).
ReactDOM.createRoot(document.getElementById("root")!).render(<App />);
