import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, Easing, staticFile } from "remotion";
import { loadFont } from "@remotion/google-fonts/Montserrat";

const { fontFamily } = loadFont("normal", { weights: ["900"] });

interface DayTitleCardProps {
  dayNum: number;
  label: string;
  date: string;
  nextPhoto?: string;
}

export const DayTitleCard = ({ dayNum, label, date, nextPhoto }: DayTitleCardProps) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();

  // ── ENTER: slide up ──────────────────────────────────────────
  const enterDuration = 20;
  const slideIn = interpolate(frame, [0, enterDuration], [100, 0], {
    easing: Easing.bezier(0.16, 1, 0.3, 1),
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const fadeIn = interpolate(frame, [0, enterDuration], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // ── EXIT: zoom punch-through ─────────────────────────────────
  // Last 30 frames: text scales up massively (1→12x) — feels like
  // zooming into the letters. Background photo punches through simultaneously.
  const exitStart = durationInFrames - 30;

  const textScale = interpolate(frame, [exitStart, durationInFrames], [1, 12], {
    easing: Easing.bezier(0.4, 0, 1, 1), // aggressive ease-in acceleration
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Dark overlay fades OUT during zoom — reveals the photo beneath
  const overlayOpacity = interpolate(frame, [exitStart, durationInFrames - 5], [1, 0], {
    easing: Easing.in(Easing.cubic),
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Background photo: starts tiny (letterbox crop), expands to fill as we zoom through
  const photoBgOpacity = interpolate(frame, [exitStart, durationInFrames - 10], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const photoBgScale = interpolate(frame, [exitStart, durationInFrames], [1.0, 1.4], {
    easing: Easing.bezier(0.4, 0, 1, 1),
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Labels/subtitle fade out earlier — text exits before the zoom completes
  const labelFadeOut = interpolate(frame, [exitStart - 5, exitStart + 10], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // ── HOLD: photo inside letters slowly zooms (Ken Burns) ──────
  const photoInLettersScale = interpolate(frame, [0, durationInFrames], [1.0, 1.2], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // ── Labels ───────────────────────────────────────────────────
  const labelEnter = interpolate(frame, [enterDuration, enterDuration + 20], [30, 0], {
    easing: Easing.bezier(0.16, 1, 0.3, 1),
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const labelOpacity = interpolate(frame, [enterDuration, enterDuration + 20], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const dateOpacity = interpolate(frame, [enterDuration + 15, enterDuration + 35], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const accentWidth = interpolate(frame, [enterDuration, enterDuration + 30], [0, 100], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const dayText = `DAY ${dayNum}`;
  const photoUrl = nextPhoto ? `url(${staticFile(`media/jpg/${nextPhoto}`)})` : "linear-gradient(135deg, #f0a500, #ff6b35)";

  return (
    <AbsoluteFill style={{ background: "#0a0a0f", fontFamily, overflow: "hidden" }}>

      {/* ── Layer 1: dark gradient bg ── */}
      <AbsoluteFill
        style={{
          background: "linear-gradient(135deg, #0f0c29 0%, #1a1535 50%, #0a080f 100%)",
          opacity: overlayOpacity,
        }}
      />

      {/* ── Layer 2: next photo — punches through on exit ── */}
      {nextPhoto && (
        <AbsoluteFill
          style={{
            opacity: photoBgOpacity,
            transform: `scale(${photoBgScale})`,
            transformOrigin: "center center",
          }}
        >
          <div style={{
            width: "100%",
            height: "100%",
            backgroundImage: `url(${staticFile(`media/jpg/${nextPhoto}`)})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
          }} />
        </AbsoluteFill>
      )}

      {/* ── Layer 3: title + labels — zoom out on exit ── */}
      <AbsoluteFill
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          transform: `translateY(${slideIn}px) scale(${textScale})`,
          transformOrigin: "center center",
          opacity: fadeIn,
        }}
      >
        {/* Hollow text with photo inside */}
        <div
          style={{
            fontSize: 160,
            fontWeight: 900,
            letterSpacing: -6,
            lineHeight: 1,
            WebkitTextFillColor: "transparent",
            WebkitBackgroundClip: "text",
            backgroundClip: "text",
            backgroundImage: photoUrl,
            backgroundSize: `${120 + (photoInLettersScale - 1) * 200}% auto`,
            backgroundPosition: "center",
            userSelect: "none",
          }}
        >
          {dayText}
        </div>

        {/* Accent line + labels — fade out before zoom */}
        <div style={{ opacity: labelFadeOut }}>
          <div style={{
            width: accentWidth,
            height: 4,
            background: "#f0a500",
            marginTop: 20,
            marginBottom: 20,
            borderRadius: 2,
            marginLeft: "auto",
            marginRight: "auto",
          }} />

          <div style={{
            fontSize: 40,
            fontWeight: 900,
            color: "#ffffff",
            letterSpacing: 2,
            textAlign: "center",
            maxWidth: 900,
            transform: `translateY(${labelEnter}px)`,
            opacity: labelOpacity,
            textTransform: "uppercase",
          }}>
            {label}
          </div>

          <div style={{
            fontSize: 22,
            fontWeight: 900,
            color: "rgba(255,255,255,0.4)",
            marginTop: 14,
            letterSpacing: 5,
            opacity: dateOpacity,
            textTransform: "uppercase",
            textAlign: "center",
          }}>
            {new Date(date + "T12:00:00").toLocaleDateString("en-US", {
              month: "long", day: "numeric", year: "numeric",
            })}
          </div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
