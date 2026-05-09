import L from 'leaflet';

// Fix the default marker icons in bundlers — Leaflet's defaults use require()
// paths that don't survive Vite. Point them at the CDN-hosted assets matching
// the leaflet.css already loaded in index.html.
const base = 'https://unpkg.com/leaflet@1.9.4/dist/images/';

L.Icon.Default.mergeOptions({
  iconRetinaUrl: `${base}marker-icon-2x.png`,
  iconUrl: `${base}marker-icon.png`,
  shadowUrl: `${base}marker-shadow.png`,
});
