import type { StyleSpecification } from "maplibre-gl";

// OpenStreetMap raster tiles: no API key needed. Fine for development and low traffic;
// production should point at a tile provider with its own key (OSM's tile usage policy).
export const OSM_STYLE: StyleSpecification = {
  version: 8,
  sources: {
    osm: {
      type: "raster",
      tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
      tileSize: 256,
      maxzoom: 19,
      attribution: "© OpenStreetMap contributors",
    },
  },
  layers: [{ id: "osm", type: "raster", source: "osm" }],
};
