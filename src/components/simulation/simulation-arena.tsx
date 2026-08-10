"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { autoPickXi } from "@/lib/simulation/auto-xi";
import {
  buildSideStrength,
  createKickoffState,
  stepMinute,
} from "@/lib/simulation/engine";
import type {
  LiveMatchState,
  SimPlayer,
  SimTeam,
} from "@/lib/simulation/types";

type SpeedOption = {
  id: string;
  label: string;
  /** Wall-clock ms for a full 90' match */
  durationMs: number;
};

const SPEEDS: SpeedOption[] = [
  { id: "1m", label: "1 min", durationMs: 60_000 },
  { id: "30s", label: "30 sec", durationMs: 30_000 },
  { id: "2m", label: "2 min", durationMs: 120_000 },
];

export function SimulationArena({
  teams,
  source,
}: {
  teams: SimTeam[];
  source: string;
}) {
  const [homeId, setHomeId] = useState(teams[0]?.id ?? "");
  const [awayId, setAwayId] = useState(teams[1]?.id ?? teams[0]?.id ?? "");
  const [homeXi, setHomeXi] = useState<string[]>([]);
  const [awayXi, setAwayXi] = useState<string[]>([]);
  const [speedId, setSpeedId] = useState("1m");
  const [match, setMatch] = useState<LiveMatchState | null>(null);
  const [running, setRunning] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const matchRef = useRef<LiveMatchState | null>(null);
  const metaRef = useRef<{
    home: ReturnType<typeof buildSideStrength>;
    away: ReturnType<typeof buildSideStrength>;
    seed: string;
  } | null>(null);

  const homeTeam = teams.find((t) => t.id === homeId) ?? null;
  const awayTeam = teams.find((t) => t.id === awayId) ?? null;

  useEffect(() => {
    if (!homeTeam) return;
    setHomeXi(autoPickXi(homeTeam.players));
  }, [homeTeam]);

  useEffect(() => {
    if (!awayTeam) return;
    setAwayXi(autoPickXi(awayTeam.players));
  }, [awayTeam]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const canStart =
    homeTeam &&
    awayTeam &&
    homeId !== awayId &&
    homeXi.length === 11 &&
    awayXi.length === 11 &&
    !running;

  const speed = SPEEDS.find((s) => s.id === speedId) ?? SPEEDS[0];

  function togglePlayer(side: "home" | "away", playerId: string) {
    if (running) return;
    const current = side === "home" ? homeXi : awayXi;
    const set = side === "home" ? setHomeXi : setAwayXi;
    if (current.includes(playerId)) {
      set(current.filter((id) => id !== playerId));
      return;
    }
    if (current.length >= 11) return;
    set([...current, playerId]);
  }

  function startMatch() {
    if (!homeTeam || !awayTeam || !canStart) return;
    if (timerRef.current) clearInterval(timerRef.current);

    const homePlayers = homeTeam.players.filter((p) => homeXi.includes(p.id));
    const awayPlayers = awayTeam.players.filter((p) => awayXi.includes(p.id));
    const home = buildSideStrength(homePlayers);
    const away = buildSideStrength(awayPlayers);
    const seed = `${homeId}-${awayId}-${Date.now()}`;
    metaRef.current = { home, away, seed };

    const initial = createKickoffState(
      homeTeam.name,
      awayTeam.name,
      homeTeam.venue,
    );
    matchRef.current = initial;
    setMatch(initial);
    setRunning(true);

    const tickMs = Math.max(40, Math.floor(speed.durationMs / 90));
    timerRef.current = setInterval(() => {
      const current = matchRef.current;
      const meta = metaRef.current;
      if (!current || !meta) return;
      if (current.phase === "finished") {
        if (timerRef.current) clearInterval(timerRef.current);
        setRunning(false);
        return;
      }
      const next = stepMinute(current, meta.home, meta.away, meta.seed);
      matchRef.current = next;
      setMatch(next);
      if (next.phase === "finished") {
        if (timerRef.current) clearInterval(timerRef.current);
        setRunning(false);
      }
    }, tickMs);
  }

  function stopMatch() {
    if (timerRef.current) clearInterval(timerRef.current);
    setRunning(false);
  }

  const homeSelected = useMemo(
    () => new Set(homeXi),
    [homeXi],
  );
  const awaySelected = useMemo(
    () => new Set(awayXi),
    [awayXi],
  );

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <p className="max-w-2xl text-sm text-[var(--muted)]">
          Pick two clubs, choose an XI (stats shown per player), then run a
          90-minute sim. Speed it up so the full match finishes in about a
          minute.
        </p>
        <span className="rounded-md border border-[var(--line)] px-2.5 py-1 text-[10px] uppercase tracking-[0.18em] text-[var(--muted)]">
          Squads: {source}
        </span>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <TeamPicker
          label="Home"
          teams={teams}
          selectedId={homeId}
          excludeId={awayId}
          disabled={running}
          onSelect={setHomeId}
          players={homeTeam?.players ?? []}
          selectedXi={homeSelected}
          onToggle={(id) => togglePlayer("home", id)}
          onAuto={() => homeTeam && setHomeXi(autoPickXi(homeTeam.players))}
          xiCount={homeXi.length}
        />
        <TeamPicker
          label="Away"
          teams={teams}
          selectedId={awayId}
          excludeId={homeId}
          disabled={running}
          onSelect={setAwayId}
          players={awayTeam?.players ?? []}
          selectedXi={awaySelected}
          onToggle={(id) => togglePlayer("away", id)}
          onAuto={() => awayTeam && setAwayXi(autoPickXi(awayTeam.players))}
          xiCount={awayXi.length}
        />
      </div>

      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-[var(--line)] bg-[var(--panel)]/60 p-4">
        <span className="text-xs uppercase tracking-[0.18em] text-[var(--muted)]">
          Match length
        </span>
        {SPEEDS.map((option) => (
          <button
            key={option.id}
            type="button"
            disabled={running}
            onClick={() => setSpeedId(option.id)}
            className={`rounded-md px-3 py-1.5 text-sm transition disabled:opacity-50 ${
              speedId === option.id
                ? "bg-[var(--pitch)] text-[var(--pitch-ink)]"
                : "border border-[var(--line)] text-[var(--muted)] hover:text-[var(--accent)]"
            }`}
          >
            {option.label}
          </button>
        ))}
        <div className="ml-auto flex gap-2">
          {running ? (
            <button
              type="button"
              onClick={stopMatch}
              className="rounded-md border border-[var(--line)] px-4 py-2 text-sm"
            >
              Stop
            </button>
          ) : (
            <button
              type="button"
              disabled={!canStart}
              onClick={startMatch}
              className="rounded-md bg-[var(--pitch)] px-5 py-2 text-sm font-medium text-[var(--pitch-ink)] disabled:opacity-50"
            >
              Start simulation
            </button>
          )}
        </div>
      </div>

      {match ? (
        <MatchBoard
          match={match}
          homeName={homeTeam?.shortName ?? "HOME"}
          awayName={awayTeam?.shortName ?? "AWAY"}
          running={running}
        />
      ) : null}
    </div>
  );
}

function TeamPicker({
  label,
  teams,
  selectedId,
  excludeId,
  disabled,
  onSelect,
  players,
  selectedXi,
  onToggle,
  onAuto,
  xiCount,
}: {
  label: string;
  teams: SimTeam[];
  selectedId: string;
  excludeId: string;
  disabled: boolean;
  onSelect: (id: string) => void;
  players: SimPlayer[];
  selectedXi: Set<string>;
  onToggle: (id: string) => void;
  onAuto: () => void;
  xiCount: number;
}) {
  return (
    <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)]/70 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
          {label} · XI {xiCount}/11
        </h2>
        <button
          type="button"
          disabled={disabled}
          onClick={onAuto}
          className="text-xs text-[var(--accent)] hover:underline disabled:opacity-50"
        >
          Auto best XI
        </button>
      </div>
      <select
        className="mt-3 w-full rounded-md border border-[var(--line)] bg-[var(--background)] px-3 py-2 text-sm"
        value={selectedId}
        disabled={disabled}
        onChange={(e) => onSelect(e.target.value)}
      >
        {teams.map((team) => (
          <option key={team.id} value={team.id} disabled={team.id === excludeId}>
            {team.name}
          </option>
        ))}
      </select>

      <ul className="mt-3 max-h-80 space-y-1 overflow-y-auto pr-1">
        {players.map((player) => {
          const active = selectedXi.has(player.id);
          return (
            <li key={player.id}>
              <button
                type="button"
                disabled={disabled || (!active && xiCount >= 11)}
                onClick={() => onToggle(player.id)}
                className={`flex w-full items-center justify-between gap-2 rounded-md px-2 py-2 text-left text-sm transition disabled:opacity-40 ${
                  active
                    ? "bg-[var(--pitch)]/20 text-[var(--foreground)]"
                    : "hover:bg-[var(--panel-hover)] text-[var(--muted)]"
                }`}
              >
                <span className="min-w-0">
                  <span className="mr-2 text-[10px] uppercase tracking-wide text-[var(--accent)]">
                    {player.position}
                    {player.shirtNumber != null ? ` ${player.shirtNumber}` : ""}
                  </span>
                  <span className="font-medium text-[var(--foreground)]">
                    {player.name}
                  </span>
                </span>
                <span className="shrink-0 text-[10px] tabular-nums text-[var(--muted)]">
                  RT {player.rating.toFixed(1)} · G{player.goals} A
                  {player.assists} · {player.appearances} apps
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function MatchBoard({
  match,
  homeName,
  awayName,
  running,
}: {
  match: LiveMatchState;
  homeName: string;
  awayName: string;
  running: boolean;
}) {
  const { stats } = match;
  return (
    <section className="overflow-hidden rounded-xl border border-[var(--pitch)]/40 bg-[var(--panel)]/80">
      <div className="border-b border-[var(--line)] bg-[radial-gradient(ellipse_at_center,rgba(47,158,98,0.18),transparent_60%)] px-4 py-6 text-center">
        <div className="text-[10px] uppercase tracking-[0.22em] text-[var(--muted)]">
          {running
            ? match.phase === "ht"
              ? "Half-time"
              : "Live simulation"
            : match.phase === "finished"
              ? "Full-time"
              : "Simulation"}
        </div>
        <div className="mt-3 flex items-center justify-center gap-6">
          <div className="text-right">
            <div className="font-[family-name:var(--font-display)] text-2xl tracking-wide">
              {homeName}
            </div>
            <div className="text-xs text-[var(--muted)]">
              {match.scorers.home.join(" · ") || "—"}
            </div>
          </div>
          <div className="font-[family-name:var(--font-display)] text-5xl tracking-wide text-[var(--accent)]">
            {match.homeScore} – {match.awayScore}
          </div>
          <div className="text-left">
            <div className="font-[family-name:var(--font-display)] text-2xl tracking-wide">
              {awayName}
            </div>
            <div className="text-xs text-[var(--muted)]">
              {match.scorers.away.join(" · ") || "—"}
            </div>
          </div>
        </div>
        <div className="mt-4 font-[family-name:var(--font-display)] text-3xl text-[var(--pitch)]">
          {Math.min(90, match.minute)}&apos;
        </div>
        <div className="mx-auto mt-3 h-1.5 max-w-md overflow-hidden rounded-full bg-[var(--panel-hover)]">
          <div
            className="h-full bg-[var(--pitch)] transition-all duration-200"
            style={{ width: `${(Math.min(90, match.minute) / 90) * 100}%` }}
          />
        </div>
      </div>

      <div className="grid gap-4 border-b border-[var(--line)] p-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          label="Possession"
          value={`${stats.possessionHome}% – ${stats.possessionAway}%`}
        />
        <Stat
          label="Shots (on target)"
          value={`${stats.shotsHome} (${stats.shotsOnTargetHome}) – ${stats.shotsAway} (${stats.shotsOnTargetAway})`}
        />
        <Stat
          label="Corners"
          value={`${stats.cornersHome} – ${stats.cornersAway}`}
        />
        <Stat
          label="Fouls / yellows"
          value={`${stats.foulsHome}/${stats.yellowsHome} – ${stats.foulsAway}/${stats.yellowsAway}`}
        />
      </div>

      <div className="max-h-72 overflow-y-auto px-4 py-3">
        <div className="mb-2 text-[10px] uppercase tracking-[0.18em] text-[var(--muted)]">
          Match feed
        </div>
        <ol className="space-y-2">
          {[...match.events].reverse().map((event, index) => (
            <li
              key={`${event.minute}-${event.type}-${index}`}
              className="grid grid-cols-[2.5rem_1fr] gap-3 text-sm"
            >
              <span className="font-[family-name:var(--font-display)] text-[var(--accent)]">
                {event.minute}&apos;
              </span>
              <span
                className={
                  event.type === "goal"
                    ? "text-[var(--foreground)]"
                    : "text-[var(--muted)]"
                }
              >
                {event.text}
              </span>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-[0.16em] text-[var(--muted)]">
        {label}
      </div>
      <div className="mt-1 text-sm tabular-nums">{value}</div>
    </div>
  );
}
