import { interpolate, Easing, useCurrentFrame } from "remotion";
import { loadFont } from "@remotion/google-fonts/Montserrat";
import type { CityInfo } from "./mapData";

const { fontFamily } = loadFont("normal", { weights: ["700", "900"] });

// SVG landmark icons rendered as React — no external images needed
const LandmarkIcon = ({ city }: { city: CityInfo }) => {
  if (city.name === "Bangalore") {
    // Vidhana Soudha pillars silhouette
    return (
      <svg width="80" height="80" viewBox="0 0 80 80" fill="none">
        <rect x="10" y="50" width="8" height="28" fill="#c8a96e" rx="1" />
        <rect x="22" y="42" width="8" height="36" fill="#c8a96e" rx="1" />
        <rect x="34" y="36" width="12" height="42" fill="#d4b87e" rx="1" />
        <rect x="50" y="42" width="8" height="36" fill="#c8a96e" rx="1" />
        <rect x="62" y="50" width="8" height="28" fill="#c8a96e" rx="1" />
        <rect x="20" y="30" width="40" height="8" fill="#c8a96e" rx="2" />
        <ellipse cx="40" cy="28" rx="14" ry="6" fill="#d4b87e" />
        <ellipse cx="40" cy="22" rx="6" ry="3" fill="#c8a96e" />
        <rect x="37" y="10" width="6" height="12" fill="#c8a96e" rx="1" />
        <polygon points="40,4 43,10 37,10" fill="#f0a500" />
      </svg>
    );
  }

  if (city.name === "Tonsai") {
    // Dusky leaf monkey face
    return (
      <svg width="80" height="80" viewBox="0 0 80 80" fill="none">
        {/* Body */}
        <ellipse cx="40" cy="55" rx="18" ry="20" fill="#3d2b1f" />
        {/* Head */}
        <circle cx="40" cy="32" r="22" fill="#4a3728" />
        {/* White eye rings */}
        <circle cx="31" cy="28" r="9" fill="#f5f0e8" />
        <circle cx="49" cy="28" r="9" fill="#f5f0e8" />
        {/* Eyes */}
        <circle cx="31" cy="28" r="5" fill="#1a1008" />
        <circle cx="49" cy="28" r="5" fill="#1a1008" />
        <circle cx="33" cy="26" r="1.5" fill="white" />
        <circle cx="51" cy="26" r="1.5" fill="white" />
        {/* Nose */}
        <ellipse cx="40" cy="37" rx="5" ry="3" fill="#2d1e14" />
        {/* Mouth smile */}
        <path d="M34 43 Q40 48 46 43" stroke="#2d1e14" strokeWidth="2" fill="none" strokeLinecap="round" />
        {/* Ears */}
        <circle cx="18" cy="30" r="8" fill="#4a3728" />
        <circle cx="62" cy="30" r="8" fill="#4a3728" />
        {/* Tail hint */}
        <path d="M56 68 Q65 72 62 78" stroke="#3d2b1f" strokeWidth="5" fill="none" strokeLinecap="round" />
      </svg>
    );
  }

  if (city.name === "Phuket" || city.name === "Krabi") {
    // Coconut tree + beach waves
    return (
      <svg width="80" height="80" viewBox="0 0 80 80" fill="none">
        {/* Sun */}
        <circle cx="62" cy="18" r="10" fill="#f0a500" opacity="0.9" />
        {/* Palm trunk */}
        <path d="M38 75 Q42 55 36 35 Q38 20 44 15" stroke="#8B5E3C" strokeWidth="5" fill="none" strokeLinecap="round" />
        {/* Palm fronds */}
        <path d="M44 15 Q55 10 65 18" stroke="#4caf50" strokeWidth="4" fill="none" strokeLinecap="round" />
        <path d="M44 15 Q48 5 58 8" stroke="#66bb6a" strokeWidth="4" fill="none" strokeLinecap="round" />
        <path d="M44 15 Q35 8 26 14" stroke="#4caf50" strokeWidth="4" fill="none" strokeLinecap="round" />
        <path d="M44 15 Q40 5 30 10" stroke="#66bb6a" strokeWidth="4" fill="none" strokeLinecap="round" />
        <path d="M44 15 Q30 20 22 28" stroke="#4caf50" strokeWidth="4" fill="none" strokeLinecap="round" />
        {/* Coconuts */}
        <circle cx="50" cy="20" r="4" fill="#8B5E3C" />
        <circle cx="45" cy="18" r="3.5" fill="#795548" />
        {/* Beach */}
        <path d="M5 65 Q20 60 40 63 Q60 66 75 62" stroke="#80cbc4" strokeWidth="3" fill="none" />
        <path d="M5 70 Q20 65 40 68 Q60 71 75 67" stroke="#4dd0e1" strokeWidth="2.5" fill="none" />
      </svg>
    );
  }

  if (city.name === "Ao Nang") {
    // Longtail boat silhouette
    return (
      <svg width="80" height="80" viewBox="0 0 80 80" fill="none">
        {/* Water */}
        <path d="M5 55 Q20 50 40 53 Q60 56 75 52" stroke="#4dd0e1" strokeWidth="2.5" fill="none" />
        <path d="M5 62 Q20 57 40 60 Q60 63 75 59" stroke="#80cbc4" strokeWidth="2" fill="none" />
        {/* Boat hull */}
        <path d="M15 52 Q40 44 65 52 L60 60 Q40 65 20 60 Z" fill="#c8a96e" />
        {/* Long tail pole */}
        <line x1="60" y1="52" x2="78" y2="70" stroke="#6d4c41" strokeWidth="3" strokeLinecap="round" />
        {/* Canopy */}
        <path d="M22 52 L26 38 L54 38 L58 52" fill="#e57373" opacity="0.85" />
        <line x1="26" y1="38" x2="26" y2="52" stroke="#c62828" strokeWidth="1.5" />
        <line x1="40" y1="38" x2="40" y2="52" stroke="#c62828" strokeWidth="1.5" />
        <line x1="54" y1="38" x2="54" y2="52" stroke="#c62828" strokeWidth="1.5" />
        {/* Flag */}
        <line x1="26" y1="38" x2="26" y2="28" stroke="#6d4c41" strokeWidth="2" />
        <polygon points="26,28 36,32 26,36" fill="#f0a500" />
      </svg>
    );
  }

  return <div style={{ fontSize: 48 }}>{city.emoji}</div>;
};

interface CityOverlayProps {
  city: CityInfo;
  x: number; // 0-1 fraction of width
  y: number; // 0-1 fraction of height
  appearFrame: number;
  width: number;
  height: number;
}

export const CityOverlay = ({ city, x, y, appearFrame, width, height }: CityOverlayProps) => {
  const frame = useCurrentFrame();

  const opacity = interpolate(frame, [appearFrame, appearFrame + 20], [0, 1], {
    easing: Easing.out(Easing.cubic),
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const scale = interpolate(frame, [appearFrame, appearFrame + 25], [0.5, 1], {
    easing: Easing.bezier(0.34, 1.56, 0.64, 1),
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const px = x * width;
  const py = y * height;

  return (
    <div
      style={{
        position: "absolute",
        left: px - 60,
        top: py - 100,
        opacity,
        transform: `scale(${scale})`,
        transformOrigin: "50% 100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        fontFamily,
        pointerEvents: "none",
      }}
    >
      <LandmarkIcon city={city} />
      <div
        style={{
          marginTop: 6,
          background: "rgba(0,0,0,0.75)",
          color: "#fff",
          fontSize: 18,
          fontWeight: 700,
          padding: "3px 10px",
          borderRadius: 6,
          letterSpacing: 1,
          whiteSpace: "nowrap",
        }}
      >
        {city.name}
      </div>
    </div>
  );
};
