// ── CUSTOMIZE: Update MAP_BEFORE dates and MAP_AFTER_DATE ────────────────────
import { AbsoluteFill, Audio, staticFile, useVideoConfig, interpolate } from "remotion";
import { TransitionSeries, linearTiming } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { IntroScene } from "./scenes/IntroScene";
import { DayScene } from "./scenes/DayScene";
import { OutroScene } from "./scenes/OutroScene";
import { JourneyArrival } from "./scenes/map/JourneyArrival";
import { JourneyDeparture } from "./scenes/map/JourneyDeparture";
import { JOURNEY_ARRIVAL, JOURNEY_DEPARTURE } from "./scenes/map/mapData";
import { DAYS } from "./data/mediaManifest";

const INTRO_S         = 6;
const OUTRO_S         = 6;
const TRANSITION_F    = 20;
const MUSIC_FADE_OUT_S = 3;
const PHOTO_S         = 3.5;
const TITLE_S         = 3;
const LEG_TRANSITION_S = 0.8;
const MAP_HOLD_S      = 2;

function calcDayDuration(day: (typeof DAYS)[0], fps: number): number {
  const T = TRANSITION_F;
  const titleF = Math.floor(TITLE_S * fps);
  const photoF = Math.floor(PHOTO_S * fps);
  const photoTotal = day.photos.length * photoF - Math.max(0, day.photos.length - 1) * T;
  const videoTotal = day.videos.reduce((s, v) => s + Math.floor(v.trimDuration * fps), 0);
  return Math.max(titleF + photoTotal + videoTotal - T - T * day.videos.length, fps * 4);
}

function calcMapDuration(legs: typeof JOURNEY_ARRIVAL, fps: number): number {
  const panS = Math.max(0, legs.length - 1) * LEG_TRANSITION_S;
  return Math.ceil((legs.reduce((s, l) => s + l.durationS, 0) + panS + MAP_HOLD_S) * fps);
}

// ── CUSTOMIZE: Set the date each map appears BEFORE, and last date for departure map ──
const MAP_BEFORE: Record<string, { component: React.FC; legs: typeof JOURNEY_ARRIVAL }> = {
  "YYYY-MM-DD": { component: JourneyArrival, legs: JOURNEY_ARRIVAL },
  // "YYYY-MM-DD": { component: JourneyMidTrip, legs: JOURNEY_MIDTRIP },
};
const MAP_AFTER_DATE = "YYYY-MM-DD"; // last day date — departure map plays after this day
// ──────────────────────────────────────────────────────────────────────────────

function buildAllChildren(days: typeof DAYS, fps: number): React.ReactNode[] {
  const items: React.ReactNode[] = [];
  const T = TRANSITION_F;
  const pushTr = (key: string) =>
    items.push(<TransitionSeries.Transition key={key} presentation={fade()} timing={linearTiming({ durationInFrames: T })} />);

  days.forEach((day, i) => {
    const mapBefore = MAP_BEFORE[day.date];
    if (mapBefore) {
      const MapComp = mapBefore.component;
      const dur = calcMapDuration(mapBefore.legs, fps);
      items.push(
        <TransitionSeries.Sequence key={`map-before-${day.date}`} durationInFrames={dur} premountFor={fps}>
          <MapComp />
        </TransitionSeries.Sequence>
      );
      pushTr(`map-before-tr-${day.date}`);
    }

    items.push(
      <TransitionSeries.Sequence key={`day-${day.date}`} durationInFrames={calcDayDuration(day, fps)} premountFor={fps}>
        <DayScene day={day} />
      </TransitionSeries.Sequence>
    );

    if (day.date === MAP_AFTER_DATE) {
      pushTr(`map-after-tr-${day.date}`);
      items.push(
        <TransitionSeries.Sequence key="map-departure" durationInFrames={calcMapDuration(JOURNEY_DEPARTURE, fps)} premountFor={fps}>
          <JourneyDeparture />
        </TransitionSeries.Sequence>
      );
    }

    if (i < days.length - 1) pushTr(`day-tr-${i}`);
  });

  return items;
}

export const TripVideo = () => {
  const { fps, durationInFrames } = useVideoConfig();

  const musicVolume = (f: number) => {
    const fadeStart = durationInFrames - MUSIC_FADE_OUT_S * fps;
    if (f >= fadeStart) return interpolate(f, [fadeStart, durationInFrames], [0.65, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
    return interpolate(f, [0, 2 * fps], [0, 0.65], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  };

  return (
    <AbsoluteFill style={{ background: "#000" }}>
      <Audio src={staticFile("music/track.mp3")} volume={musicVolume} loop />
      <TransitionSeries>
        <TransitionSeries.Sequence durationInFrames={Math.floor(INTRO_S * fps)} premountFor={fps}>
          <IntroScene />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition presentation={fade()} timing={linearTiming({ durationInFrames: TRANSITION_F })} />
        {buildAllChildren(DAYS, fps)}
        <TransitionSeries.Transition presentation={fade()} timing={linearTiming({ durationInFrames: TRANSITION_F })} />
        <TransitionSeries.Sequence durationInFrames={Math.floor(OUTRO_S * fps)} premountFor={fps}>
          <OutroScene />
        </TransitionSeries.Sequence>
      </TransitionSeries>
    </AbsoluteFill>
  );
};
