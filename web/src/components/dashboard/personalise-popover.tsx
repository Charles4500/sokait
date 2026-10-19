import { Columns2, Languages, Settings, Volume2, VolumeX } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { PLAYERS, TEAMS, type TeamId } from "@/match/engine";
import { speak } from "@/insights/speech";
import { LANGS, type Prefs } from "./types";

export function PersonalisePopover({
  prefs,
  update,
}: {
  prefs: Prefs;
  update: (patch: Partial<Prefs>) => void;
}) {
  return (
    <Popover>
      <Tooltip>
        <TooltipTrigger asChild>
          <PopoverTrigger
            aria-label="Personalise"
            className="grid h-10 w-10 place-items-center rounded-full border border-border data-[state=open]:bg-secondary"
          >
            <Settings className="h-4 w-4" />
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent>Personalise</TooltipContent>
      </Tooltip>
      <PopoverContent
        align="end"
        className="w-72 space-y-4 border border-white/10 bg-background/70 backdrop-blur-xl shadow-xl"
      >
        <div>
          <div className="font-display text-sm">Personalise</div>
          <p className="text-xs text-muted-foreground">Tailor commentary to you</p>
        </div>
        <div className="space-y-1.5">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Languages className="h-3.5 w-3.5" />
            Language
          </div>
          <Select value={prefs.lang} onValueChange={(lang) => update({ lang })}>
            <SelectTrigger aria-label="Language">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {LANGS.map((l) => (
                <SelectItem key={l} value={l}>
                  {l}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <div className="text-xs text-muted-foreground">Favourite club</div>
          <Select value={prefs.favClub} onValueChange={(v) => update({ favClub: v as TeamId })}>
            <SelectTrigger aria-label="Favourite club">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="home">♥ {TEAMS.home.name}</SelectItem>
              <SelectItem value="away">♥ {TEAMS.away.name}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <div className="text-xs text-muted-foreground">Favourite player</div>
          <Select value={prefs.favPlayer} onValueChange={(favPlayer) => update({ favPlayer })}>
            <SelectTrigger aria-label="Favourite player">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PLAYERS.filter((p) => p.pos !== "GK").map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  ★ {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-3 border-t border-border pt-3 text-sm">
          <label className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-1.5">
              {prefs.voice ? (
                <Volume2 className="h-3.5 w-3.5" />
              ) : (
                <VolumeX className="h-3.5 w-3.5" />
              )}
              AI voice
            </span>
            <Switch
              checked={prefs.voice}
              onCheckedChange={(voice) => {
                update({ voice });
                if (voice) speak("Commentary on.", prefs.lang).catch(() => {});
              }}
            />
          </label>
          <label className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-1.5">
              <Columns2 className="h-3.5 w-3.5" />
              Analyst vs Fan
            </span>
            <Switch checked={prefs.compare} onCheckedChange={(compare) => update({ compare })} />
          </label>
        </div>
      </PopoverContent>
    </Popover>
  );
}
