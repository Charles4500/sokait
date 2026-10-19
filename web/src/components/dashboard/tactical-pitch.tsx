import { useMemo, useState } from "react";
import { PITCH, PLAYERS, TEAMS, type MatchEvent, type TeamId } from "@/match/engine";
import { playerPositions } from "@/match/pitch-layout";

type View = "live" | "shots" | "heat";
const VIEWS: { id: View; label: string }[] = [
  { id: "live", label: "Live" },
  { id: "shots", label: "Shot map" },
  { id: "heat", label: "Heatmap" },
];

const TEAM_FILL: Record<TeamId, string> = { home: "var(--team-home)", away: "var(--team-away)" };
const L = PITCH.length;
const W = PITCH.width;
// A little room above the pitch for the scorebug and below it for the legends;
// the glass overlays may sit over the pitch edges.
const VIEWBOX = "-3 -7 111 80";

/** Pass colour by difficulty: routine → green, ambitious → amber, elite → red. */
const passColour = (d = 0) =>
  d >= 7 ? "var(--live)" : d >= 4.5 ? "oklch(0.8 0.15 80)" : "var(--win)";

export function TacticalPitch({
  events,
  favPlayer,
  playerFocus,
  favClub,
}: {
  events: MatchEvent[];
  favPlayer: string;
  playerFocus: boolean;
  favClub: TeamId;
}) {
  const [view, setView] = useState<View>("live");
  const [heatTeam, setHeatTeam] = useState<TeamId>(favClub);

  return (
    <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,oklch(0.32_0.07_150),oklch(0.2_0.04_160))]">
      <svg
        viewBox={VIEWBOX}
        preserveAspectRatio="xMidYMid meet"
        className="absolute inset-0 h-full w-full"
        role="img"
        aria-label="Live tactical view of the synthetic match"
      >
        <defs>
          <marker
            id="arrow"
            viewBox="0 0 10 10"
            refX="8"
            refY="5"
            markerWidth="4"
            markerHeight="4"
            orient="auto-start-reverse"
          >
            <path d="M0,0 L10,5 L0,10 z" fill="context-stroke" />
          </marker>
        </defs>
        <PitchMarkings />
        {view === "live" && (
          <LiveLayer events={events} favPlayer={favPlayer} playerFocus={playerFocus} />
        )}
        {view === "shots" && <ShotMap events={events} />}
        {view === "heat" && <Heatmap events={events} team={heatTeam} />}
      </svg>

      {/* View switch */}
      <div className="absolute bottom-3 right-3 flex items-center gap-2">
        {view === "heat" && (
          <div className="flex rounded-full glass p-0.5 text-[11px]">
            {(["home", "away"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setHeatTeam(t)}
                aria-pressed={heatTeam === t}
                className={`rounded-full px-2.5 py-1 ${heatTeam === t ? "bg-secondary" : "text-muted-foreground"}`}
              >
                {TEAMS[t].short}
              </button>
            ))}
          </div>
        )}
        <div className="flex rounded-full glass p-0.5 text-[11px]" role="tablist">
          {VIEWS.map((v) => (
            <button
              key={v.id}
              role="tab"
              aria-selected={view === v.id}
              onClick={() => setView(v.id)}
              className={`rounded-full px-2.5 py-1 ${view === v.id ? "bg-secondary" : "text-muted-foreground"}`}
            >
              {v.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function PitchMarkings() {
  const line = { fill: "none", stroke: "oklch(1 0 0 / 0.35)", strokeWidth: 0.3 };
  const box = (deep: number, wide: number, side: "home" | "away") => {
    const y = (W - wide) / 2;
    return <rect x={side === "home" ? 0 : L - deep} y={y} width={deep} height={wide} {...line} />;
  };
  return (
    <g>
      {/* Mowing stripes */}
      {Array.from({ length: 10 }, (_, i) => (
        <rect
          key={i}
          x={(L / 10) * i}
          y={0}
          width={L / 10}
          height={W}
          fill={i % 2 ? "oklch(1 0 0 / 0.025)" : "transparent"}
        />
      ))}
      <rect x={0} y={0} width={L} height={W} {...line} />
      <line x1={L / 2} y1={0} x2={L / 2} y2={W} {...line} />
      <circle cx={L / 2} cy={W / 2} r={9.15} {...line} />
      <circle cx={L / 2} cy={W / 2} r={0.4} fill="oklch(1 0 0 / 0.4)" />
      {box(16.5, 40.32, "home")}
      {box(16.5, 40.32, "away")}
      {box(5.5, 18.32, "home")}
      {box(5.5, 18.32, "away")}
      <circle cx={11} cy={W / 2} r={0.35} fill="oklch(1 0 0 / 0.4)" />
      <circle cx={L - 11} cy={W / 2} r={0.35} fill="oklch(1 0 0 / 0.4)" />
      <path d={`M16.5,${W / 2 - 7.3} A9.15,9.15 0 0,1 16.5,${W / 2 + 7.3}`} {...line} />
      <path
        d={`M${L - 16.5},${W / 2 - 7.3} A9.15,9.15 0 0,0 ${L - 16.5},${W / 2 + 7.3}`}
        {...line}
      />
      {/* Goals */}
      <rect x={-2} y={W / 2 - 3.66} width={2} height={7.32} {...line} strokeWidth={0.45} />
      <rect x={L} y={W / 2 - 3.66} width={2} height={7.32} {...line} strokeWidth={0.45} />
    </g>
  );
}

function LiveLayer({
  events,
  favPlayer,
  playerFocus,
}: {
  events: MatchEvent[];
  favPlayer: string;
  playerFocus: boolean;
}) {
  const current = events[events.length - 1];
  const positions = useMemo(() => playerPositions(current), [current]);
  const trail = events.slice(-7, -1);
  const favTrail = useMemo(
    () => (playerFocus ? events.filter((e) => e.player.id === favPlayer).slice(-8) : []),
    [events, favPlayer, playerFocus],
  );
  const ball = current ? { x: current.toX, y: current.toY } : { x: L / 2, y: W / 2 };

  return (
    <g>
      {/* Recent ball path, fading out */}
      {trail.map((e, i) => (
        <line
          key={e.id}
          x1={e.x}
          y1={e.y}
          x2={e.toX}
          y2={e.toY}
          stroke="oklch(1 0 0)"
          strokeOpacity={0.05 + (i / trail.length) * 0.15}
          strokeWidth={0.35}
        />
      ))}

      {/* Favourite player's recent touches (Player focus) */}
      {favTrail.length > 1 && (
        <polyline
          points={favTrail.map((e) => `${e.x},${e.y}`).join(" ")}
          fill="none"
          stroke="var(--primary)"
          strokeWidth={0.5}
          strokeDasharray="1 1"
          strokeOpacity={0.8}
        />
      )}

      {current && <EventGraphic key={current.id} e={current} />}

      {/* Players */}
      {PLAYERS.map((p) => {
        const pos = positions.get(p.id)!;
        const isFav = p.id === favPlayer;
        const onBall = current?.player.id === p.id;
        return (
          <g
            key={p.id}
            style={{
              transform: `translate(${pos.x}px, ${pos.y}px)`,
              transition: "transform 700ms ease-in-out",
            }}
          >
            {isFav && <circle r={3} fill="none" stroke="var(--primary)" strokeWidth={0.5} />}
            <circle
              r={1.9}
              fill={TEAM_FILL[p.team]}
              stroke={onBall ? "white" : "oklch(0 0 0 / 0.5)"}
              strokeWidth={onBall ? 0.45 : 0.25}
            />
            <text
              y={0.6}
              textAnchor="middle"
              fontSize={1.7}
              fontWeight={700}
              fill="white"
              style={{ pointerEvents: "none" }}
            >
              {p.num}
            </text>
          </g>
        );
      })}

      {/* Ball */}
      <g
        style={{
          transform: `translate(${ball.x}px, ${ball.y}px)`,
          transition: "transform 600ms ease-out",
        }}
      >
        <circle r={0.9} fill="white" stroke="oklch(0 0 0 / 0.6)" strokeWidth={0.2} />
      </g>
    </g>
  );
}

/** The graphic for the latest event: pass arrow, shot line and xG bubble, press halo, tackle burst. */
function EventGraphic({ e }: { e: MatchEvent }) {
  if (e.type === "pass") {
    return (
      <line
        x1={e.x}
        y1={e.y}
        x2={e.toX}
        y2={e.toY}
        stroke={passColour(e.passDifficulty)}
        strokeWidth={0.55}
        strokeDasharray={e.passAccurate ? undefined : "1.2 0.8"}
        markerEnd="url(#arrow)"
        className="animate-slide-in"
      />
    );
  }
  if (e.type === "shot" || e.type === "goal") {
    const goal = e.type === "goal";
    return (
      <g>
        <line
          x1={e.x}
          y1={e.y}
          x2={e.toX}
          y2={e.toY}
          stroke={goal ? "var(--win)" : "white"}
          strokeWidth={0.5}
          strokeOpacity={0.9}
          markerEnd="url(#arrow)"
        />
        <circle
          cx={e.x}
          cy={e.y}
          r={1 + (e.xg ?? 0) * 7}
          fill={TEAM_FILL[e.team]}
          fillOpacity={0.35}
          stroke="white"
          strokeWidth={0.25}
        />
        <text x={e.x} y={e.y - 2.5 - (e.xg ?? 0) * 7} textAnchor="middle" fontSize={2} fill="white">
          xG {e.xg}
        </text>
        {goal && (
          <text
            x={L / 2}
            y={W / 2 + 3}
            textAnchor="middle"
            fontSize={9}
            fontWeight={800}
            fill="white"
            className="animate-live"
          >
            GOAL
          </text>
        )}
      </g>
    );
  }
  if (e.type === "pressure") {
    return (
      <circle
        cx={e.x}
        cy={e.y}
        r={4.5}
        fill={TEAM_FILL[e.team]}
        fillOpacity={0.18}
        stroke={TEAM_FILL[e.team]}
        strokeWidth={0.35}
        className="animate-live"
      />
    );
  }
  if (e.type === "tackle") {
    return (
      <g stroke="white" strokeWidth={0.4} strokeOpacity={0.9}>
        {[0, 45, 90, 135].map((a) => {
          const r = (a * Math.PI) / 180;
          return (
            <line
              key={a}
              x1={e.x - Math.cos(r) * 3}
              y1={e.y - Math.sin(r) * 3}
              x2={e.x + Math.cos(r) * 3}
              y2={e.y + Math.sin(r) * 3}
            />
          );
        })}
      </g>
    );
  }
  return null;
}

function ShotMap({ events }: { events: MatchEvent[] }) {
  const shots = events.filter((e) => e.type === "shot" || e.type === "goal");
  return (
    <g>
      {shots.map((s) => (
        <circle
          key={s.id}
          cx={s.x}
          cy={s.y}
          r={0.8 + (s.xg ?? 0) * 7}
          fill={s.type === "goal" ? TEAM_FILL[s.team] : "transparent"}
          fillOpacity={0.85}
          stroke={TEAM_FILL[s.team]}
          strokeWidth={0.45}
        >
          <title>{`${s.minute}' ${s.player.name} · xG ${s.xg}${s.type === "goal" ? " · goal" : ""}`}</title>
        </circle>
      ))}
      <text x={L} y={-2.5} textAnchor="end" fontSize={2.2} fill="oklch(1 0 0 / 0.7)">
        Circle size = xG · filled = goal · {shots.length} shots
      </text>
    </g>
  );
}

const BINS_X = 15;
const BINS_Y = 10;

function Heatmap({ events, team }: { events: MatchEvent[]; team: TeamId }) {
  const grid = useMemo(() => {
    const g = Array.from({ length: BINS_X * BINS_Y }, () => 0);
    for (const e of events) {
      if (e.team !== team) continue;
      const bx = Math.min(BINS_X - 1, Math.floor((e.x / L) * BINS_X));
      const by = Math.min(BINS_Y - 1, Math.floor((e.y / W) * BINS_Y));
      g[by * BINS_X + bx]!++;
    }
    return g;
  }, [events, team]);
  const max = Math.max(1, ...grid);
  const cw = L / BINS_X;
  const ch = W / BINS_Y;
  return (
    <g>
      {grid.map((n, i) =>
        n ? (
          <rect
            key={i}
            x={(i % BINS_X) * cw}
            y={Math.floor(i / BINS_X) * ch}
            width={cw}
            height={ch}
            fill={TEAM_FILL[team]}
            fillOpacity={(n / max) * 0.75}
          />
        ) : null,
      )}
      <text x={L} y={-2.5} textAnchor="end" fontSize={2.2} fill="oklch(1 0 0 / 0.7)">
        Where {TEAMS[team].name} had the ball · {TEAMS[team].short} attack{" "}
        {team === "home" ? "→" : "←"}
      </text>
    </g>
  );
}
