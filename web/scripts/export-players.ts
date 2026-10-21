// Lists every player in the league with their kit colour, for generate_portraits.py.
//   bun scripts/export-players.ts > /tmp/players.json
import { FIXTURES, playersOf } from "@/match/engine";

const players = FIXTURES.flatMap((f) =>
  playersOf(f).map((p) => ({ ...p, kit: p.team === "home" ? "red" : "blue" })),
);
console.log(JSON.stringify(players));
