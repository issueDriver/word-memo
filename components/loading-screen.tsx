import { LoaderCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export function LoadingScreen({
  fullScreen = false,
}: {
  fullScreen?: boolean;
}) {
  return (
    <div
      role="status"
      className={cn(
        "flex items-center justify-center gap-3 text-sm text-muted-foreground",
        fullScreen ? "min-h-dvh" : "min-h-[320px]",
      )}
    >
      <LoaderCircle className="size-5 animate-spin text-primary" />
      正在加载…
    </div>
  );
}
