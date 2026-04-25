import { useEffect, useMemo, useRef, useState } from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  useDelayRender,
  interpolate,
  Easing,
} from "remotion";
import maplibregl, { Map, GeoJSONSource } from "maplibre-gl";
import * as turf from "@turf/turf";
import type { Leg } from "./mapData";
import { MODE_COLORS, MODE_DASH, CITIES } from "./mapData";
import { CityOverlay } from "./CityOverlay";

const MAP_STYLE = "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json";

// Zoom level per transport mode — how close camera follows
const MODE_ZOOM: Record<string, number> = {
  flight: 4.2,  // wide — shows full flight arc
  car:    8.5,  // road level
  boat:   10.5, // bay/coastal level
};

// Brief pan from previous leg end → next leg start (seconds)
const LEG_TRANSITION_S = 0.8;

interface JourneyMapProps {
  legs: Leg[];
  title: string;
  cityPositions?: Partial<Record<string, { x: number; y: number }>>;
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

export const JourneyMap = ({ legs, title, cityPositions = {} }: JourneyMapProps) => {
  const ref = useRef<HTMLDivElement>(null);
  const { width, height, fps } = useVideoConfig();
  const frame = useCurrentFrame();

  const [map, setMap] = useState<Map | null>(null);
  const [styleLoaded, setStyleLoaded] = useState(false);
  const { delayRender, continueRender } = useDelayRender();
  const [initHandle] = useState(() => delayRender("Loading map..."));

  // Build timeline: each leg has [panStart, drawStart, drawEnd]
  // Pan = camera moves from prev tip → leg start
  // Draw = line animates while camera tracks tip
  const timeline = useMemo(() => {
    const result: { panStart: number; drawStart: number; drawEnd: number }[] = [];
    let cursor = 0;
    legs.forEach((leg, i) => {
      const panDur = i === 0 ? 0 : LEG_TRANSITION_S;
      const panStart = cursor;
      const drawStart = cursor + panDur;
      const drawEnd = drawStart + leg.durationS;
      result.push({ panStart, drawStart, drawEnd });
      cursor = drawEnd;
    });
    return result;
  }, [legs]);

  // ── Map init ─────────────────────────────────────────────────
  useEffect(() => {
    const _map = new maplibregl.Map({
      container: ref.current!,
      zoom: MODE_ZOOM[legs[0].mode],
      center: legs[0].fromCoord,
      pitch: 0,
      bearing: 0,
      style: MAP_STYLE,
      interactive: false,
      fadeDuration: 0,
    });

    _map.on("style.load", () => {
      // One source+layer per leg
      legs.forEach((leg, i) => {
        _map.addSource(`leg-${i}`, {
          type: "geojson",
          data: { type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: [leg.fromCoord] } },
        });
        _map.addLayer({
          id: `leg-line-${i}`,
          type: "line",
          source: `leg-${i}`,
          paint: {
            "line-color": MODE_COLORS[leg.mode],
            "line-width": 6,
            "line-dasharray": MODE_DASH[leg.mode],
          },
          layout: { "line-cap": "round", "line-join": "round" },
        });
        // Moving tip dot
        _map.addSource(`dot-${i}`, {
          type: "geojson",
          data: { type: "Feature", properties: {}, geometry: { type: "Point", coordinates: leg.fromCoord } },
        });
        _map.addLayer({
          id: `dot-${i}`,
          type: "circle",
          source: `dot-${i}`,
          paint: {
            "circle-radius": 12,
            "circle-color": MODE_COLORS[leg.mode],
            "circle-stroke-color": "#ffffff",
            "circle-stroke-width": 3,
          },
        });
      });

      // City dots for involved cities
      const involvedNames = new Set([...legs.map((l) => l.from), ...legs.map((l) => l.to)]);
      const markerFeatures = Object.values(CITIES)
        .filter((c) => involvedNames.has(c.name))
        .map((c) => ({
          type: "Feature" as const,
          properties: { name: c.name },
          geometry: { type: "Point" as const, coordinates: c.coord },
        }));

      _map.addSource("cities", { type: "geojson", data: { type: "FeatureCollection", features: markerFeatures } });
      _map.addLayer({
        id: "city-dots",
        type: "circle",
        source: "cities",
        paint: { "circle-radius": 8, "circle-color": "#ffffff", "circle-stroke-color": "#222", "circle-stroke-width": 2 },
      });
      _map.addLayer({
        id: "city-labels",
        type: "symbol",
        source: "cities",
        layout: {
          "text-field": ["get", "name"],
          "text-font": ["Open Sans Bold", "Arial Unicode MS Bold"],
          "text-size": 22,
          "text-offset": [0, 1.2],
          "text-anchor": "top",
        },
        paint: { "text-color": "#ffffff", "text-halo-color": "#000000", "text-halo-width": 2 },
      });

      setStyleLoaded(true);
      continueRender(initHandle);
    });

    _map.on("load", () => setMap(_map));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Per-frame: line draw + camera tracking ───────────────────
  useEffect(() => {
    if (!map || !styleLoaded) return;

    const handle = delayRender("Animating map...");
    const t = frame / fps;

    // Find which leg is active
    let activeLegIdx = 0;
    for (let i = 0; i < timeline.length; i++) {
      if (t >= timeline[i].panStart) activeLegIdx = i;
    }

    const leg = legs[activeLegIdx];
    const { panStart, drawStart, drawEnd } = timeline[activeLegIdx];

    // ── Line drawing ──
    legs.forEach((l, i) => {
      const { drawStart: ds, drawEnd: de } = timeline[i];
      const lineProgress = interpolate(t, [ds, de], [0, 1], {
        easing: Easing.inOut(Easing.sin),
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      });

      let lineCoords: [number, number][];
      if (l.mode === "flight") {
        const route = turf.lineString([l.fromCoord, l.toCoord]);
        const dist = Math.max(0.001, turf.length(route) * lineProgress);
        lineCoords = turf.lineSliceAlong(route, 0, dist).geometry.coordinates as [number, number][];
      } else {
        const curLng = lerp(l.fromCoord[0], l.toCoord[0], lineProgress);
        const curLat = lerp(l.fromCoord[1], l.toCoord[1], lineProgress);
        lineCoords = [l.fromCoord, [curLng, curLat]];
      }

      const tip = lineCoords[lineCoords.length - 1];
      (map.getSource(`leg-${i}`) as GeoJSONSource | undefined)?.setData({
        type: "Feature", properties: {},
        geometry: { type: "LineString", coordinates: lineCoords },
      });
      (map.getSource(`dot-${i}`) as GeoJSONSource | undefined)?.setData({
        type: "Feature", properties: {},
        geometry: { type: "Point", coordinates: tip },
      });
    });

    // ── Camera tracking tip of active leg ──
    const drawProgress = interpolate(t, [drawStart, drawEnd], [0, 1], {
      easing: Easing.inOut(Easing.sin),
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });

    let tipCoord: [number, number];
    if (leg.mode === "flight") {
      const route = turf.lineString([leg.fromCoord, leg.toCoord]);
      const dist = Math.max(0.001, turf.length(route) * drawProgress);
      const coords = turf.lineSliceAlong(route, 0, dist).geometry.coordinates;
      tipCoord = coords[coords.length - 1] as [number, number];
    } else {
      tipCoord = [
        lerp(leg.fromCoord[0], leg.toCoord[0], drawProgress),
        lerp(leg.fromCoord[1], leg.toCoord[1], drawProgress),
      ];
    }

    const targetZoom = MODE_ZOOM[leg.mode];

    if (activeLegIdx > 0 && t < drawStart) {
      // Pan transition: interpolate camera from prev leg end → current leg start
      const prevLeg = legs[activeLegIdx - 1];
      const prevZoom = MODE_ZOOM[prevLeg.mode];
      const panProgress = interpolate(t, [panStart, drawStart], [0, 1], {
        easing: Easing.inOut(Easing.cubic),
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      });
      map.setCenter([
        lerp(prevLeg.toCoord[0], leg.fromCoord[0], panProgress),
        lerp(prevLeg.toCoord[1], leg.fromCoord[1], panProgress),
      ]);
      map.setZoom(lerp(prevZoom, targetZoom, panProgress));
    } else {
      // Follow tip
      map.setCenter(tipCoord);
      map.setZoom(targetZoom);
    }

    map.once("idle", () => continueRender(handle));
  }, [frame, map, styleLoaded]);

  const mapStyle = useMemo<React.CSSProperties>(
    () => ({ width, height, position: "absolute" }),
    [width, height]
  );

  const titleOpacity = interpolate(frame, [0, 20], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // City overlays: source city at frame 0, destination when leg completes
  const cityAppearFrames: Partial<Record<string, number>> = {};
  legs.forEach((leg, i) => {
    const legEndFrame = Math.floor(timeline[i].drawEnd * fps);
    const toKey = Object.keys(CITIES).find((k) => CITIES[k as keyof typeof CITIES].name === leg.to);
    if (toKey) cityAppearFrames[toKey] = legEndFrame;
  });
  const fromKey = Object.keys(CITIES).find((k) => CITIES[k as keyof typeof CITIES].name === legs[0].from);
  if (fromKey) cityAppearFrames[fromKey] = 0;

  return (
    <AbsoluteFill style={{ background: "#0d1117" }}>
      <AbsoluteFill ref={ref} style={mapStyle} />

      {/* Title */}
      <div style={{ position: "absolute", top: 40, left: 0, right: 0, textAlign: "center", opacity: titleOpacity, pointerEvents: "none" }}>
        <div style={{
          display: "inline-block",
          background: "rgba(0,0,0,0.75)",
          color: "#f0a500",
          fontSize: 32,
          fontWeight: 700,
          letterSpacing: 3,
          padding: "10px 32px",
          borderRadius: 8,
          fontFamily: "sans-serif",
        }}>
          {title}
        </div>
      </div>

      {/* Legend */}
      <div style={{
        position: "absolute", bottom: 40, left: 50,
        background: "rgba(0,0,0,0.72)", borderRadius: 10,
        padding: "14px 22px", display: "flex", flexDirection: "column",
        gap: 8, pointerEvents: "none", opacity: titleOpacity,
      }}>
        {([["flight", "✈ Flight"], ["car", "🚗 Road"], ["boat", "⛵ Boat"]] as const).map(([mode, label]) => (
          <div key={mode} style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 36, height: 5, background: MODE_COLORS[mode], borderRadius: 3 }} />
            <span style={{ color: "#fff", fontSize: 18, fontFamily: "sans-serif" }}>{label}</span>
          </div>
        ))}
      </div>

      {/* City overlays */}
      {Object.entries(cityAppearFrames).map(([key, appearFrame]) => {
        const city = CITIES[key as keyof typeof CITIES];
        const pos = cityPositions[key] ?? { x: 0.5, y: 0.5 };
        return (
          <CityOverlay
            key={key}
            city={city}
            x={pos.x}
            y={pos.y}
            appearFrame={appearFrame!}
            width={width}
            height={height}
          />
        );
      })}
    </AbsoluteFill>
  );
};
