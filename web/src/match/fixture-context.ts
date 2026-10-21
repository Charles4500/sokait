import { createContext, useContext } from "react";
import {
  CLUBS,
  FIXTURES,
  playersOf,
  sideOf,
  teamsOf,
  type Fixture,
  type Player,
  type TeamId,
  type Teams,
} from "./engine";

/** The match being watched: its clubs as home/away, and both squads. */
export interface FixtureInfo {
  fixture: Fixture;
  teams: Teams;
  players: Player[];
}

export function fixtureInfo(fixture: Fixture): FixtureInfo {
  return { fixture, teams: teamsOf(fixture), players: playersOf(fixture) };
}

export const FixtureContext = createContext<FixtureInfo>(fixtureInfo(FIXTURES[0]!));

export const useFixture = () => useContext(FixtureContext);

export const clubName = (id: string) => CLUBS.find((c) => c.id === id)?.name ?? id;

/** Which side the viewer's club plays on in this match, or null if it isn't playing. */
export const favSide = (info: FixtureInfo, favClub: string): TeamId | null =>
  sideOf(info.fixture, favClub);
