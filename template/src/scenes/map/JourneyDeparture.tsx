// ── CUSTOMIZE: Update cityPositions for your departure cities ────────────────
import { JourneyMap } from "./JourneyMap";
import { JOURNEY_DEPARTURE } from "./mapData";

export const JourneyDeparture = () => (
  <JourneyMap
    legs={JOURNEY_DEPARTURE}
    title="UNTIL NEXT TIME"
    cityPositions={{
      destination: { x: 0.75, y: 0.45 },
      home: { x: 0.15, y: 0.6 },
    }}
  />
);
