import "./index.css";
import { Composition, Folder } from "remotion";
import { TripVideo } from "./TripVideo";
import { DAYS } from "./data/mediaManifest";
import { JourneyArrival } from "./scenes/map/JourneyArrival";
import { JourneyDeparture } from "./scenes/map/JourneyDeparture";
import { JOURNEY_ARRIVAL, JOURNEY_DEPARTURE } from "./scenes/map/mapData";

const FPS = 30;
const PHOTO_S = 3.5;
const TITLE_S = 3;
const INTRO_S = 6;
const OUTRO_S = 6;
const T = 20;
const LEG_TRANSITION_S = 0.8;
const MAP_HOLD_S = 2;

const mapDur = (legs: typeof JOURNEY_ARRIVAL) => {
  const panS = Math.max(0, legs.length - 1) * LEG_TRANSITION_S;
  return Math.ceil((legs.reduce((s, l) => s + l.durationS, 0) + panS + MAP_HOLD_S) * FPS);
};

const estimateDuration = () => {
  let total = Math.floor(INTRO_S * FPS) + Math.floor(OUTRO_S * FPS) + mapDur(JOURNEY_ARRIVAL) + mapDur(JOURNEY_DEPARTURE);
  for (const day of DAYS) {
    const titleF = Math.floor(TITLE_S * FPS);
    const photoF = Math.floor(PHOTO_S * FPS);
    const photoTotal = day.photos.length * photoF - Math.max(0, day.photos.length - 1) * T;
    const videoTotal = day.videos.reduce((s, v) => s + Math.floor(v.trimDuration * FPS), 0);
    total += Math.max(titleF + photoTotal + videoTotal - T - T * day.videos.length, FPS * 4) - T;
  }
  return Math.max(total, FPS * 60);
};

const journeyDur = (legs: typeof JOURNEY_ARRIVAL) => mapDur(legs);

export const RemotionRoot: React.FC = () => (
  <>
    <Composition id="TripVideo" component={TripVideo} durationInFrames={estimateDuration()} fps={FPS} width={1920} height={1080} />
    <Folder name="Maps">
      <Composition id="MapArrival"   component={JourneyArrival}   durationInFrames={journeyDur(JOURNEY_ARRIVAL)}   fps={FPS} width={1920} height={1080} />
      <Composition id="MapDeparture" component={JourneyDeparture} durationInFrames={journeyDur(JOURNEY_DEPARTURE)} fps={FPS} width={1920} height={1080} />
    </Folder>
  </>
);
