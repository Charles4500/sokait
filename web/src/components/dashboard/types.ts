import type { MatchEvent, Player, TeamId, computeStats, playerStats } from "@/match/engine";
import type { Verification } from "@/insights/agents.functions";

export type Mode = "analyst" | "casual" | "player";

export const MODES: Mode[] = ["casual", "analyst", "player"];
export const MODE_LABEL: Record<Mode, string> = {
  casual: "Casual fan",
  analyst: "Analyst",
  player: "Player focus",
};
export const LANGS = ["English", "Swahili", "Spanish", "French", "Arabic", "Portuguese"];
export const LANG_SHORT: Record<string, string> = {
  English: "EN",
  Swahili: "SW",
  Spanish: "ES",
  French: "FR",
  Arabic: "AR",
  Portuguese: "PT",
};

/** Everything the viewer can personalise. */
export interface Prefs {
  mode: Mode;
  lang: string;
  /** Club id (any club in the league), not a side. */
  favClub: string;
  favPlayer: string;
  voice: boolean;
  compare: boolean;
}

export interface FeedItem {
  e: MatchEvent;
  why: string;
  ai?: string;
  verification?: Verification;
}

export interface OnAir {
  title: string;
  text: string;
  ai: boolean;
  team: TeamId;
  player: Player;
  minute: number;
  label: string;
  /** How long a broadcast would keep this on screen. */
  durationMs: number;
  verification?: Verification;
}

export interface Dual {
  title: string;
  analyst: string;
  casual: string;
}

export type MatchStats = ReturnType<typeof computeStats>;
export type PlayerStats = ReturnType<typeof playerStats>;
