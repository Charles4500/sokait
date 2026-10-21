import type { Player } from "@/match/engine";

/** Generated portrait (web/scripts/generate_portraits.py); components fall back to
 *  illustrated art when the file is missing. */
export const photoOf = (player: Player) => `/players/${player.id}.webp`;
