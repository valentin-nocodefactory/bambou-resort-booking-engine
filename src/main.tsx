import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";
import { initLang } from "./lib/lang";
import { initCurrency } from "./lib/currency";
import { initUtm } from "./lib/utm";

// Langue résolue AVANT le rendu et tout appel réseau (?lang= > localStorage > fr) :
// figée pour ce chargement, elle pilote t(), les formats Intl et la langue Mews.
initLang();
// Devise d'affichage résolue AVANT le rendu (?cur= > localStorage > EUR) pour éviter tout
// « flash » de prix. Purement cosmétique : la transaction reste en EUR. La géo IP peut la
// pré-régler ensuite (US→USD, CA→CAD) si le visiteur n'a rien choisi.
initCurrency();
// UTM capturés AVANT que l'URL ne soit réécrite (sinon perdus) → joints au suivi n8n.
initUtm();

// NB : pas de <StrictMode> — en dev il double-invoque les effets (donc chaque appel
// Mews apparaîtrait 2× dans le Dev Panel). On le retire pour un journal d'appels fidèle
// au comportement de production (un appel = une ligne).
ReactDOM.createRoot(document.getElementById("root")!).render(<App />);
