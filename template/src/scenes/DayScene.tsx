import { useVideoConfig } from "remotion";
import { TransitionSeries, linearTiming, springTiming } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { wipe } from "@remotion/transitions/wipe";
import { DayTitleCard } from "../components/DayTitleCard";
import { KenBurnsPhoto } from "../components/KenBurnsPhoto";
import { VideoClip } from "../components/VideoClip";
import type { DayData } from "../data/mediaManifest";
import React from "react";

const PHOTO_DURATION_S = 3.5;
const TITLE_DURATION_S = 3;
const TRANSITION_FRAMES = 15;

interface DaySceneProps {
  day: DayData;
}

function buildPhotoAndVideoChildren(day: DayData, fps: number): React.ReactNode[] {
  const photoFrames = Math.floor(PHOTO_DURATION_S * fps);
  const items: React.ReactNode[] = [];

  day.photos.forEach((photo, i) => {
    const isPortrait = day.photoOrientations?.[i] ?? false;
    items.push(
      <TransitionSeries.Sequence key={`photo-${i}`} durationInFrames={photoFrames} premountFor={fps}>
        <KenBurnsPhoto src={`media/jpg/${photo}`} index={i} isPortrait={isPortrait} />
      </TransitionSeries.Sequence>
    );
    if (i < day.photos.length - 1) {
      items.push(
        <TransitionSeries.Transition
          key={`photo-tr-${i}`}
          presentation={fade()}
          timing={linearTiming({ durationInFrames: TRANSITION_FRAMES })}
        />
      );
    }
  });

  day.videos.forEach((vid, i) => {
    items.push(
      <TransitionSeries.Transition
        key={`vid-tr-${i}`}
        presentation={fade()}
        timing={springTiming({ durationInFrames: 20 })}
      />
    );
    items.push(
      <TransitionSeries.Sequence
        key={`vid-${i}`}
        durationInFrames={Math.floor(vid.trimDuration * fps)}
        premountFor={fps}
      >
        <VideoClip file={vid.file} trimDuration={vid.trimDuration} />
      </TransitionSeries.Sequence>
    );
  });

  return items;
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
          nextPhoto={day.photos[0]}
        />
      </TransitionSeries.Sequence>

      <TransitionSeries.Transition
        presentation={wipe({ direction: "from-right" })}
        timing={linearTiming({ durationInFrames: TRANSITION_FRAMES })}
      />

      {buildPhotoAndVideoChildren(day, fps)}
    </TransitionSeries>
  );
};
