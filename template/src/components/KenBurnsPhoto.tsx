import { Img, staticFile, useCurrentFrame, useVideoConfig, interpolate, Easing } from "remotion";

const PAN_DIRECTIONS = [
  { x: [-20, 20], y: [0, 0] },
  { x: [20, -20], y: [0, 0] },
  { x: [0, 0], y: [-15, 15] },
  { x: [0, 0], y: [15, -15] },
  { x: [-15, 15], y: [-10, 10] },
  { x: [15, -15], y: [10, -10] },
];

interface KenBurnsPhotoProps {
  src: string;
  index: number;
  isPortrait?: boolean;
}

export const KenBurnsPhoto = ({ src, index, isPortrait = false }: KenBurnsPhotoProps) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const pan = PAN_DIRECTIONS[index % PAN_DIRECTIONS.length];

  const progress = interpolate(frame, [0, durationInFrames], [0, 1], {
    easing: Easing.bezier(0.45, 0, 0.55, 1),
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Portrait: start zoomed out (0.85 fits full height), pan gently, end slightly zoomed
  // Landscape: normal Ken Burns 1.0→1.18 with cover
  const scaleStart = isPortrait ? 0.85 : 1.0;
  const scaleEnd = isPortrait ? 0.95 : 1.18;
  const scale = interpolate(progress, [0, 1], [scaleStart, scaleEnd]);

  // Portrait pans are vertical-friendly — reduce x travel, allow more y
  const panMult = isPortrait ? 0.4 : 1.0;
  const translateX = interpolate(progress, [0, 1], [pan.x[0] * panMult, pan.x[1] * panMult]);
  const translateY = interpolate(progress, [0, 1], [pan.y[0] * panMult, pan.y[1] * panMult]);

  const opacity = interpolate(frame, [0, 8, durationInFrames - 8, durationInFrames], [0, 1, 1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <div style={{
      width: "100%", height: "100%", overflow: "hidden", position: "absolute", opacity,
      background: isPortrait ? "#0a0a0f" : undefined,
    }}>
      <Img
        src={staticFile(src)}
        style={{
          width: "100%",
          height: "100%",
          objectFit: isPortrait ? "contain" : "cover",
          transform: `scale(${scale}) translate(${translateX}px, ${translateY}px)`,
          transformOrigin: "center center",
        }}
      />
    </div>
  );
};
