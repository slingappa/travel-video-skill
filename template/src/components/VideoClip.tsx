import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate } from "remotion";
import { Video } from "@remotion/media";
import { staticFile } from "remotion";

interface VideoClipProps {
  file: string;
  trimDuration: number;
}

export const VideoClip = ({ file, trimDuration }: VideoClipProps) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const trimAfterFrames = Math.floor(trimDuration * fps);

  const opacity = interpolate(
    frame,
    [0, 8, durationInFrames - 8, durationInFrames],
    [0, 1, 1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  return (
    <AbsoluteFill style={{ opacity }}>
      <Video
        src={staticFile(`media/jpg/${file}`)}
        style={{ width: "100%", height: "100%", objectFit: "cover" }}
        trimAfter={trimAfterFrames}
        volume={0.4}
      />
    </AbsoluteFill>
  );
};
