import { AbsoluteFill, useCurrentFrame, interpolate, Easing } from "remotion";
import { loadFont } from "@remotion/google-fonts/Montserrat";

const { fontFamily } = loadFont("normal", { weights: ["400", "700", "900"] });

// ── CUSTOMIZE ────────────────────────────────────────────────────────────────
const CLOSING_LINE   = "See you on the road.";              // e.g. "Until next time."
const LOCATION_TAG   = "DESTINATION · REGION · COUNTRY";   // e.g. "LEH · LADAKH · INDIA"
const STATS_LINE     = "X days · Y photos · countless memories";
// ─────────────────────────────────────────────────────────────────────────────

export const OutroScene = () => {
  const frame = useCurrentFrame();

  const opacity = interpolate(frame, [0, 30], [0, 1], {
    easing: Easing.out(Easing.cubic), extrapolateLeft: "clamp", extrapolateRight: "clamp",
  });
  const textY = interpolate(frame, [15, 50], [30, 0], {
    easing: Easing.bezier(0.16, 1, 0.3, 1), extrapolateLeft: "clamp", extrapolateRight: "clamp",
  });
  const subOpacity = interpolate(frame, [40, 70], [0, 1], {
    extrapolateLeft: "clamp", extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill style={{
      background: "linear-gradient(160deg, #0a0a0a 0%, #1a1200 40%, #0a0a0a 100%)",
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      fontFamily, opacity,
    }}>
      <div style={{ fontSize: 16, fontWeight: 700, color: "#f0a500", letterSpacing: 6, marginBottom: 28, opacity: subOpacity }}>
        {LOCATION_TAG}
      </div>
      <div style={{ fontSize: 80, fontWeight: 900, color: "#ffffff", letterSpacing: -3, textAlign: "center", transform: `translateY(${textY}px)` }}>
        {CLOSING_LINE}
      </div>
      <div style={{ width: 80, height: 4, background: "#f0a500", marginTop: 28, opacity: subOpacity }} />
      <div style={{ fontSize: 22, fontWeight: 400, color: "rgba(255,255,255,0.5)", marginTop: 28, letterSpacing: 2, opacity: subOpacity }}>
        {STATS_LINE}
      </div>
    </AbsoluteFill>
  );
};
