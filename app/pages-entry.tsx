import { createRoot } from "react-dom/client";
import "@fontsource/ibm-plex-sans-arabic/400.css";
import "@fontsource/ibm-plex-sans-arabic/500.css";
import "@fontsource/ibm-plex-sans-arabic/600.css";
import "./globals.css";
import LiquidLab from "./LiquidLab";

const root = document.getElementById("root");
if (!root) throw new Error("Missing application root");
createRoot(root).render(<LiquidLab />);
