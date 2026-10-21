// The fan's teams: a favourite club and any others they want to keep an eye on.
// Stored in this browser only.
import { useCallback, useEffect, useState } from "react";

export interface Follow {
  favClub: string;
  /** Other clubs to keep track of while watching a match. */
  also: string[];
}

const KEY = "pitchpulse.follow";
const DEFAULT: Follow = { favClub: "thr", also: [] };

function read(): Follow {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? { ...DEFAULT, ...(JSON.parse(raw) as Partial<Follow>) } : DEFAULT;
  } catch {
    return DEFAULT;
  }
}

export function useFollow() {
  const [follow, setFollow] = useState<Follow>(DEFAULT);
  useEffect(() => setFollow(read()), []);
  const update = useCallback((patch: Partial<Follow>) => {
    setFollow((f) => {
      const next = { ...f, ...patch };
      next.also = next.also.filter((c) => c !== next.favClub);
      try {
        localStorage.setItem(KEY, JSON.stringify(next));
      } catch {
        /* storage unavailable: this visit only */
      }
      return next;
    });
  }, []);
  return { follow, update };
}

/** Clubs whose matches show in the watch page's Live now deck. */
export const followedClubs = (f: Follow) => new Set([f.favClub, ...f.also]);
