"use client";

import Image from "next/image";
import { BookImage } from "lucide-react";
import { useState } from "react";

export function BookCover({
  src,
  title,
  loading = "lazy",
}: {
  src: string;
  title: string;
  loading?: "eager" | "lazy";
}) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  let valid = false;
  try {
    valid = ["http:", "https:"].includes(new URL(src).protocol);
  } catch {
    valid = false;
  }
  if (!valid || failedSrc === src) {
    return (
      <span
        className="absolute inset-0 flex items-center justify-center text-muted-foreground"
        role="img"
        aria-label={`${title}：暂无可用封面`}
      >
        <BookImage className="size-6" strokeWidth={1.5} />
      </span>
    );
  }
  return (
    <Image
      src={src}
      alt={`${title}封面`}
      fill
      loading={loading}
      unoptimized
      sizes="(max-width: 640px) 100vw, 320px"
      className="object-contain"
      referrerPolicy="no-referrer"
      onError={() => setFailedSrc(src)}
    />
  );
}
