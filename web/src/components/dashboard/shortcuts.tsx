import { Keyboard } from "iconsax-reactjs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { SHORTCUTS } from "./use-shortcuts";

/** "?" button and dialog listing every shortcut. */
export function ShortcutsDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <Tooltip>
        <TooltipTrigger asChild>
          <DialogTrigger
            aria-label="Keyboard shortcuts"
            className="grid h-10 w-10 place-items-center rounded-full border border-border data-[state=open]:bg-secondary"
          >
            <Keyboard className="h-4 w-4" />
          </DialogTrigger>
        </TooltipTrigger>
        <TooltipContent>Keyboard shortcuts (?)</TooltipContent>
      </Tooltip>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Keyboard shortcuts</DialogTitle>
          <DialogDescription>
            Like a video player. In Listen: A ask, S score, W where, B ball sound.
          </DialogDescription>
        </DialogHeader>
        <dl className="grid grid-cols-[auto_1fr] items-center gap-x-6 gap-y-2.5 text-sm">
          {SHORTCUTS.map((s) => (
            <div key={s.label} className="contents">
              <dt className="flex gap-1">
                {s.keys.map((k) => (
                  <kbd
                    key={k}
                    className="min-w-7 rounded-md border border-border bg-muted px-1.5 py-0.5 text-center font-mono text-xs"
                  >
                    {k}
                  </kbd>
                ))}
              </dt>
              <dd className="text-muted-foreground">{s.label}</dd>
            </div>
          ))}
        </dl>
      </DialogContent>
    </Dialog>
  );
}
