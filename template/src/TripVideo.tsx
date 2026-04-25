import { AbsoluteFill, Audio, staticFile, useVideoConfig, interpolate } from "remotion";
import { TransitionSeries, linearTiming } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { IntroScene } from "./scenes/IntroScene";
import { DayScene } from "./scenes/DayScene";
import { OutroScene } from "./scenes/OutroScene";
import { JourneyArrival } from "./scenes/map/JourneyArrival";
import { JourneyNorthWall } from "./scenes/map/JourneyNorthWall";
import { JourneyDeparture } from "./scenes/map/JourneyDeparture";
import { JOURNEY_ARRIVAL, JOURNEY_NORTH_WALL, JOURNEY_DEPARTURE } from "./scenes/map/mapData";
import { DAYS } from "./data/mediaManifest";

const INTRO_DURATION_S = 6;
const OUTRO_DURATION_S = 6;
const TRANSITION_FRAMES = 20;
const MUSIC_FADE_OUT_S = 3;
const PHOTO_S = 3.5;
const TITLE_S = 3;
const LEG_TRANSITION_S = 0.8;
const MAP_HOLD_S = 2;

function calcDayDuration(day: (typeof DAYS)[0], fps: number): number {
  const T = TRANSITION_FRAMES;
  const titleF = Math.floor(TITLE_S * fps);

  // Use sequence if present, else fall back to photos-then-videos
  const seq = day.sequence && day.sequence.length > 0
    ? day.sequence
    : [
        ...day.photos.map((f, i) => ({ type: "photo" as const, file: f, isPortrait: day.photoOrientations?.[i] ?? false })),
        ...day.videos.map((v) => ({ type: "video" as const, file: v.file, trimDuration: v.trimDuration, duration: v.duration })),
      ];

  const contentF = seq.reduce((sum, item) => {
    return sum + (item.type === "photo" ? Math.floor(PHOTO_S * fps) : Math.floor((item.trimDuration ?? 6) * fps));
  }, 0);
  const transitionF = Math.max(0, seq.length - 1) * T;

  return Math.max(titleF + contentF - transitionF, fps * 4);
}

function calcMapDuration(legs: typeof JOURNEY_ARRIVAL, fps: number): number {
  // leg durations + (N-1) pan transitions between legs + hold at end
  const panS = Math.max(0, legs.length - 1) * LEG_TRANSITION_S;
  const totalS = legs.reduce((s, l) => s + l.durationS, 0) + panS + MAP_HOLD_S;
  return Math.ceil(totalS * fps);
}

// Dates that get a map scene injected BEFORE them
const MAP_BEFORE: Record<string, { component: React.FC; legs: typeof JOURNEY_ARRIVAL }> = {
  "2026-01-24": { component: JourneyArrival, legs: JOURNEY_ARRIVAL },
  "2026-01-29": { component: JourneyNorthWall, legs: JOURNEY_NORTH_WALL },
};
// Date that gets a map scene injected AFTER it
const MAP_AFTER_DATE = "2026-02-08";

function buildAllChildren(days: typeof DAYS, fps: number): React.ReactNode[] {
  const items: React.ReactNode[] = [];
  const T = TRANSITION_FRAMES;

  const pushTransition = (key: string) =>
    items.push(
      <TransitionSeries.Transition
        key={key}
        presentation={fade()}
        timing={linearTiming({ durationInFrames: T })}
      />
    );

  days.forEach((day, i) => {
    // Inject map BEFORE this day if mapped
    const mapBefore = MAP_BEFORE[day.date];
    if (mapBefore) {
      const MapComp = mapBefore.component;
      const mapDur = calcMapDuration(mapBefore.legs, fps);
      items.push(
        <TransitionSeries.Sequence
          key={`map-before-${day.date}`}
          durationInFrames={mapDur}
          premountFor={fps}
        >
          <MapComp />
        </TransitionSeries.Sequence>
      );
      pushTransition(`map-before-tr-${day.date}`);
    }

    // Day scene
    items.push(
      <TransitionSeries.Sequence
        key={`day-seq-${day.date}`}
        durationInFrames={calcDayDuration(day, fps)}
        premountFor={fps}
      >
        <DayScene day={day} />
      </TransitionSeries.Sequence>
    );

    // Inject map AFTER last day
    if (day.date === MAP_AFTER_DATE) {
      pushTransition(`map-after-tr-${day.date}`);
      items.push(
        <TransitionSeries.Sequence
          key="map-departure"
          durationInFrames={calcMapDuration(JOURNEY_DEPARTURE, fps)}
          premountFor={fps}
        >
          <JourneyDeparture />
        </TransitionSeries.Sequence>
      );
    }

    // Transition between days (not after the very last item)
    const isLast = i === days.length - 1;
    if (!isLast) {
      pushTransition(`day-tr-${i}`);
    }
  });

  return items;
}

export const TonsaiVideo = () => {
  const { fps, durationInFrames } = useVideoConfig();

  const musicVolume = (f: number) => {
    const fadeStart = durationInFrames - MUSIC_FADE_OUT_S * fps;
    if (f >= fadeStart) {
      return interpolate(f, [fadeStart, durationInFrames], [0.65, 0], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      });
    }
    return interpolate(f, [0, 2 * fps], [0, 0.65], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });
  };

  return (
    <AbsoluteFill style={{ background: "#000" }}>
      <Audio src={staticFile("music/track.mp3")} volume={musicVolume} loop />

      <TransitionSeries>
        <TransitionSeries.Sequence durationInFrames={Math.floor(INTRO_DURATION_S * fps)} premountFor={fps}>
          <IntroScene />
        </TransitionSeries.Sequence>

        <TransitionSeries.Transition
          presentation={fade()}
          timing={linearTiming({ durationInFrames: TRANSITION_FRAMES })}
        />

        {buildAllChildren(DAYS, fps)}

        <TransitionSeries.Transition
          presentation={fade()}
          timing={linearTiming({ durationInFrames: TRANSITION_FRAMES })}
        />

        <TransitionSeries.Sequence durationInFrames={Math.floor(OUTRO_DURATION_S * fps)} premountFor={fps}>
          <OutroScene />
        </TransitionSeries.Sequence>
      </TransitionSeries>
    </AbsoluteFill>
  );
};
