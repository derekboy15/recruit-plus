import { useId } from 'react';
import type { Area, MissionMap as MapData, PlayerKey, Shape } from '@recruit/data/missions';
import { MapLegend } from './MapLegend';

function ShapeEl({ s, ...rest }: { s: Shape; [k: string]: unknown }) {
  if (s.kind === 'rect') return <rect x={s.x} y={s.y} width={s.w} height={s.h} {...rest} />;
  if (s.kind === 'circle') return <circle cx={s.cx} cy={s.cy} r={s.r} {...rest} />;
  return <polygon points={s.points.map((p) => p.join(',')).join(' ')} {...rest} />;
}

function Zone({ area, player, maskId, highlight }: { area: Area; player: PlayerKey; maskId: string; highlight: boolean }) {
  const cls = `map-zone map-zone--${player}${highlight ? ' map-zone--highlight' : ''}`;
  return (
    <>
      {area.exclude?.length ? (
        <mask id={maskId}>
          <rect x={-1} y={-1} width={1000} height={1000} fill="white" />
          {area.exclude.map((s, i) => <ShapeEl key={i} s={s} fill="black" />)}
        </mask>
      ) : null}
      <g data-zone={player} className={cls} mask={area.exclude?.length ? `url(#${maskId})` : undefined}>
        {area.include.map((s, i) => <ShapeEl key={i} s={s} />)}
      </g>
    </>
  );
}

/** A mission's deployment map, drawn to scale in inches: zones, named areas and objective markers, with a key under it. */
export function MissionMap({ map, highlight, players, legend = true }: { map: MapData; highlight?: PlayerKey; players?: Record<PlayerKey, string>; legend?: boolean }) {
  const id = useId().replace(/:/g, '');
  const { width: W, height: H } = map.board;
  const who = (p: PlayerKey) => (players ? `${players[p]} (Player ${p})` : `Player ${p}`);
  const label =
    `Deployment map: ${W}" × ${H}" battlefield. ${who('A')} deploys along the ${map.edges.A} edge, ` +
    `${who('B')} deploys along the ${map.edges.B} edge. ${map.objectives.length} objective markers.`;
  return (
    <figure className="mission-map__figure">
      <svg className="mission-map" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label}>
        <rect className="map-board" x={0} y={0} width={W} height={H} />
        {(['A', 'B'] as const).map((p) => <Zone key={p} area={map.zones[p]} player={p} maskId={`${id}-${p}`} highlight={highlight === p} />)}
        {map.areas?.map((a) => (
          <g key={a.id} data-area={a.id} className="map-area">
            {a.area.include.map((s, i) => <ShapeEl key={i} s={s} />)}
          </g>
        ))}
        <circle className="map-centre" cx={W / 2} cy={H / 2} r={0.4} />
        {map.objectives.map((o) => (
          <g key={o.id} data-objective={o.id}>
            <circle className="map-objective" cx={o.x} cy={o.y} r={1} />
            {o.label && <text className="map-label" x={o.x + 1.4} y={o.y + 0.6}>{o.label}</text>}
          </g>
        ))}
      </svg>
      {legend && <MapLegend players={players} hasAreas={Boolean(map.areas?.length)} />}
    </figure>
  );
}
