import { AbsoluteFill, useCurrentFrame, interpolate, Easing } from "remotion";
import { loadFont } from "@remotion/google-fonts/Montserrat";

const { fontFamily } = loadFont("normal", { weights: ["400", "700", "900"] });

// ── CUSTOMIZE ────────────────────────────────────────────────────────────────
const TRIP_TITLE     = "DESTINATION";                  // e.g. "LADAKH"
const TRIP_SUBTITLE  = "AN ADVENTURE";                 // e.g. "A HIMALAYAN MOTORCYCLE JOURNEY"
const TRIP_DATES     = "MMM – MMM YYYY";               // e.g. "JUL – AUG 2027"
const LOCATION_BADGE = "LAT°N · LON°E · REGION";      // e.g. "34°N · 77°E · LADAKH, INDIA"
// ─────────────────────────────────────────────────────────────────────────────

export const IntroScene = () => {
  const frame = useCurrentFrame();

  const titleOpacity = interpolate(frame, [20, 55], [0, 1], {
    easing: Easing.out(Easing.cubic), extrapolateLeft: "clamp", extrapolateRight: "clamp",
  });
  const titleY = interpolate(frame, [20, 55], [40, 0], {
    easing: Easing.bezier(0.16, 1, 0.3, 1), extrapolateLeft: "clamp", extrapolateRight: "clamp",
  });
  const subOpacity = interpolate(frame, [45, 75], [0, 1], {
    extrapolateLeft: "clamp", extrapolateRight: "clamp",
  });
  const coordOpacity = interpolate(frame, [65, 95], [0, 1], {
    extrapolateLeft: "clamp", extrapolateRight: "clamp",
  });
  const lineScale = interpolate(frame, [30, 65], [0, 1], {
    easing: Easing.bezier(0.16, 1, 0.3, 1), extrapolateLeft: "clamp", extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill style={{
      background: "linear-gradient(160deg, #0a0a0a 0%, #1a1200 40%, #0a0a0a 100%)",
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", fontFamily,
    }}>
      <div style={{ fontSize: 16, fontWeight: 700, color: "#f0a500", letterSpacing: 6, marginBottom: 20, opacity: coordOpacity }}>
        {LOCATION_BADGE}
      </div>
      <div style={{
        fontSize: 140, fontWeight: 900, color: "#ffffff", letterSpacing: -6,
        lineHeight: 0.9, textAlign: "center",
        transform: `translateY(${titleY}px)`, opacity: titleOpacity,
      }}>
        {TRIP_TITLE}
      </div>
      <div style={{
        width: 120, height: 5, background: "#f0a500", marginTop: 24, marginBottom: 24,
        transformOrigin: "left center", transform: `scaleX(${lineScale})`,
      }} />
      <div style={{ fontSize: 32, fontWeight: 400, color: "rgba(255,255,255,0.8)", letterSpacing: 8, textAlign: "center", opacity: subOpacity }}>
        {TRIP_DATES}
      </div>
      <div style={{ fontSize: 20, fontWeight: 400, color: "rgba(255,255,255,0.4)", letterSpacing: 4, marginTop: 12, opacity: subOpacity }}>
        {TRIP_SUBTITLE}
      </div>
    </AbsoluteFill>
  );
};
