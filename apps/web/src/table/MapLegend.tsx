import type { PlayerKey } from '@recruit/data/missions';

/** A small square in a zone's colours: the same classes as the map, so the key always matches it. */
function Swatch({ className }: { className: string }) {
  return (
    <svg className="map-legend__swatch" viewBox="0 0 10 10" aria-hidden="true">
      <rect className={className} x={0.5} y={0.5} width={9} height={9} rx={1.5} />
    </svg>
  );
}

/** What the map's colours and marks mean: whose zone is whose, the objective markers and any dashed mission area. */
export function MapLegend({ players, hasAreas }: { players?: Record<PlayerKey, string>; hasAreas: boolean }) {
  return (
    <ul className="map-legend" aria-label="Map key">
      {(['A', 'B'] as const).map((p) => (
        <li key={p}>
          <Swatch className={`map-zone--${p}`} />
          <span>{players ? `${players[p]} (Player ${p}) deploys here` : `Player ${p} deployment zone`}</span>
        </li>
      ))}
      <li>
        <svg className="map-legend__swatch" viewBox="0 0 10 10" aria-hidden="true">
          <circle className="map-objective map-legend__objective" cx={5} cy={5} r={3.5} />
        </svg>
        <span>Objective marker</span>
      </li>
      {hasAreas && (
        <li>
          <svg className="map-legend__swatch" viewBox="0 0 10 10" aria-hidden="true">
            <line className="map-legend__area" x1={0.5} y1={5} x2={9.5} y2={5} />
          </svg>
          <span>Dashed line: mission area</span>
        </li>
      )}
    </ul>
  );
}
