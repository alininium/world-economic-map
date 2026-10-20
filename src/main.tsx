import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
// MapLibre's stylesheet must load before ours (ours overrides it), even though the map module
// itself is lazy-loaded; importing it here fixes the order.
import 'maplibre-gl/dist/maplibre-gl.css';
import './styles.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
