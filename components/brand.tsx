import { BookOpen } from "lucide-react";
import { cn } from "@/lib/utils";

export function Brand({
  className,
  compact = false,
}: {
  className?: string;
  compact?: boolean;
}) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
        <BookOpen className="size-5" strokeWidth={1.8} />
      </span>
      {!compact && (
        <span className="text-lg font-semibold">
          Word Memo<span className="ml-1 text-primary">.</span>
        </span>
      )}
    </div>
  );
}
