import "./index.css";
import { Composition, Folder } from "remotion";
import { TonsaiVideo } from "./TonsaiVideo";
import { DAYS } from "./data/mediaManifest";
import { JourneyArrival } from "./scenes/map/JourneyArrival";
import { JourneyNorthWall } from "./scenes/map/JourneyNorthWall";
import { JourneyDeparture } from "./scenes/map/JourneyDeparture";
import { JOURNEY_ARRIVAL, JOURNEY_NORTH_WALL, JOURNEY_DEPARTURE } from "./scenes/map/mapData";

const FPS = 30;

const estimateDuration = () => {
  const PHOTO_S = 3.5;
  const TITLE_S = 3;
  const INTRO_S = 6;
  const OUTRO_S = 6;
  const T = 20; // must match TRANSITION_FRAMES in TonsaiVideo.tsx
  const LEG_TRANSITION_S = 0.8;
  const MAP_HOLD_S = 2;

  const mapDur = (legs: typeof JOURNEY_ARRIVAL) => {
    const panS = Math.max(0, legs.length - 1) * LEG_TRANSITION_S;
    return Math.ceil((legs.reduce((s, l) => s + l.durationS, 0) + panS + MAP_HOLD_S) * FPS);
  };

  const calcDay = (day: (typeof DAYS)[0]) => {
    const titleF = Math.floor(TITLE_S * FPS);
    const seq = day.sequence && day.sequence.length > 0
      ? day.sequence
      : [
          ...day.photos.map((f, i) => ({ type: "photo" as const, file: f, isPortrait: day.photoOrientations?.[i] ?? false })),
          ...day.videos.map((v) => ({ type: "video" as const, file: v.file, trimDuration: v.trimDuration, duration: v.duration })),
        ];
    const contentF = seq.reduce((sum, item) =>
      sum + (item.type === "photo" ? Math.floor(PHOTO_S * FPS) : Math.floor((item.trimDuration ?? 6) * FPS)), 0);
    return Math.max(titleF + contentF - Math.max(0, seq.length - 1) * T, FPS * 4);
  };

  // Mirror buildAllChildren exactly:
  // intro + T + [map+T, day, T (between days, not after last), map+T...] + T + outro
  const MAP_BEFORE_DATES = new Set(["2026-01-24", "2026-01-29"]);
  const MAP_AFTER_DATE = "2026-02-08";

  let total = Math.floor(INTRO_S * FPS) + T; // intro + transition to first item

  DAYS.forEach((day, i) => {
    if (MAP_BEFORE_DATES.has(day.date)) {
      const legs = day.date === "2026-01-24" ? JOURNEY_ARRIVAL : JOURNEY_NORTH_WALL;
      total += mapDur(legs) + T;
    }

    total += calcDay(day);

    if (day.date === MAP_AFTER_DATE) {
      total += T + mapDur(JOURNEY_DEPARTURE);
    }

    if (i < DAYS.length - 1) total += T; // transition between days
  });

  total += T + Math.floor(OUTRO_S * FPS); // transition to outro + outro

  return total;
};

const journeyDuration = (legs: typeof JOURNEY_ARRIVAL) => {
  const LEG_TRANSITION_S = 0.8;
  const HOLD_S = 2;
  const panS = Math.max(0, legs.length - 1) * LEG_TRANSITION_S;
  return Math.ceil((legs.reduce((s, l) => s + l.durationS, 0) + panS + HOLD_S) * FPS);
};

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="TonsaiVideo"
        component={TonsaiVideo}
        durationInFrames={estimateDuration()}
        fps={FPS}
        width={1920}
        height={1080}
      />

      <Folder name="Maps">
        <Composition
          id="MapArrival"
          component={JourneyArrival}
          durationInFrames={journeyDuration(JOURNEY_ARRIVAL)}
          fps={FPS}
          width={1920}
          height={1080}
        />
        <Composition
          id="MapNorthWall"
          component={JourneyNorthWall}
          durationInFrames={journeyDuration(JOURNEY_NORTH_WALL)}
          fps={FPS}
          width={1920}
          height={1080}
        />
        <Composition
          id="MapDeparture"
          component={JourneyDeparture}
          durationInFrames={journeyDuration(JOURNEY_DEPARTURE)}
          fps={FPS}
          width={1920}
          height={1080}
        />
      </Folder>
    </>
  );
};
