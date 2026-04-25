import { useVideoConfig } from "remotion";
import { TransitionSeries, linearTiming, springTiming } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { wipe } from "@remotion/transitions/wipe";
import { DayTitleCard } from "../components/DayTitleCard";
import { KenBurnsPhoto } from "../components/KenBurnsPhoto";
import { VideoClip } from "../components/VideoClip";
import type { DayData, SequenceItem } from "../data/mediaManifest";
import React from "react";

const PHOTO_DURATION_S = 3.5;
const TITLE_DURATION_S = 3;
const TRANSITION_FRAMES = 20;

interface DaySceneProps {
  day: DayData;
}

// Build a flat sequence from day.sequence (interleaved) or fall back to photos-then-videos
function resolveSequence(day: DayData): SequenceItem[] {
  if (day.sequence && day.sequence.length > 0) return day.sequence;

  // Legacy fallback: photos first, then videos
  const items: SequenceItem[] = [
    ...day.photos.map((file, i) => ({
      type: "photo" as const,
      file,
      isPortrait: day.photoOrientations?.[i] ?? false,
    })),
    ...day.videos.map((v) => ({
      type: "video" as const,
      file: v.file,
      trimDuration: v.trimDuration,
      duration: v.duration,
    })),
  ];
  return items;
}

function buildSequenceChildren(day: DayData, fps: number): React.ReactNode[] {
  const seq = resolveSequence(day);
  const photoFrames = Math.floor(PHOTO_DURATION_S * fps);
  const items: React.ReactNode[] = [];

  seq.forEach((item, i) => {
    const isFirst = i === 0;

    if (!isFirst) {
      // Photo→photo: soft fade; anything→video or video→anything: spring
      const prevIsVideo = seq[i - 1].type === "video";
      const currIsVideo = item.type === "video";
      if (prevIsVideo || currIsVideo) {
        items.push(
          <TransitionSeries.Transition
            key={`tr-${i}`}
            presentation={fade()}
            timing={springTiming({ durationInFrames: 20 })}
          />
        );
      } else {
        items.push(
          <TransitionSeries.Transition
            key={`tr-${i}`}
            presentation={fade()}
            timing={linearTiming({ durationInFrames: TRANSITION_FRAMES })}
          />
        );
      }
    }

    if (item.type === "photo") {
      items.push(
        <TransitionSeries.Sequence key={`item-${i}`} durationInFrames={photoFrames} premountFor={fps}>
          <KenBurnsPhoto src={`media/jpg/${item.file}`} index={i} isPortrait={item.isPortrait ?? false} />
        </TransitionSeries.Sequence>
      );
    } else {
      const trimDuration = item.trimDuration ?? 6;
      items.push(
        <TransitionSeries.Sequence
          key={`item-${i}`}
          durationInFrames={Math.floor(trimDuration * fps)}
          premountFor={fps}
        >
          <VideoClip file={item.file} trimDuration={trimDuration} />
        </TransitionSeries.Sequence>
      );
    }
  });

  return items;
}

// First photo in sequence (for title card background)
function firstPhoto(day: DayData): string | undefined {
  const seq = resolveSequence(day);
  return seq.find((i) => i.type === "photo")?.file ?? day.photos[0];
}

export const DayScene = ({ day }: DaySceneProps) => {
  const { fps } = useVideoConfig();
  const titleFrames = Math.floor(TITLE_DURATION_S * fps);

  return (
    <TransitionSeries>
      <TransitionSeries.Sequence durationInFrames={titleFrames} premountFor={fps}>
        <DayTitleCard
          dayNum={day.dayNum}
          label={day.label}
          date={day.date}
          nextPhoto={firstPhoto(day)}
        />
      </TransitionSeries.Sequence>

      <TransitionSeries.Transition
        presentation={wipe({ direction: "from-right" })}
        timing={linearTiming({ durationInFrames: TRANSITION_FRAMES })}
      />

      {buildSequenceChildren(day, fps)}
    </TransitionSeries>
  );
};
