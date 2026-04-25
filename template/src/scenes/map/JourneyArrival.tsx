// ── CUSTOMIZE: Update cityPositions for your arrival cities ─────────────────
import { JourneyMap } from "./JourneyMap";
import { JOURNEY_ARRIVAL } from "./mapData";

export const JourneyArrival = () => (
  <JourneyMap
    legs={JOURNEY_ARRIVAL}
    title="THE JOURNEY BEGINS"
    cityPositions={{
      home: { x: 0.15, y: 0.6 },
      destination: { x: 0.75, y: 0.45 },
    }}
  />
);
