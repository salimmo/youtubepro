import { createRoot } from "react-dom/client";
import App from "./App";
import { installLanguageHeader } from "./lib/i18n";
import "./index.css";

installLanguageHeader();
createRoot(document.getElementById("root")!).render(<App />);
