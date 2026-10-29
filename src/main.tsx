import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import "leaflet/dist/leaflet.css";
import "@fontsource-variable/dm-sans";
import "@fontsource-variable/manrope";
import App from "./App";
import "./styles.css";
import { SiteContentProvider } from "./content/SiteContent";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <SiteContentProvider>
        <App />
      </SiteContentProvider>
    </BrowserRouter>
  </React.StrictMode>,
);
