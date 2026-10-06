import { useState } from "react";
import { cn } from "@/lib/utils";

export function Gallery({ images, name }: { images: string[]; name: string }) {
  const [active, setActive] = useState(0);
  if (!images.length) {
    return <div className="flex aspect-square items-center justify-center rounded-lg border bg-white text-sm text-muted-foreground">Brak zdjęcia</div>;
  }
  return (
    <div className="space-y-3">
      <div className="aspect-square overflow-hidden rounded-lg border bg-white">
        <img src={images[active]} alt={`${name} — zdjęcie ${active + 1}`} className="h-full w-full object-contain p-4" />
      </div>
      {images.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {images.map((src, i) => (
            <button
              key={src + i}
              type="button"
              onClick={() => setActive(i)}
              className={cn("h-16 w-16 shrink-0 overflow-hidden rounded-md border bg-white", i === active && "ring-2 ring-accent")}
              aria-label={`Zdjęcie ${i + 1}`}
            >
              <img src={src} alt="" className="h-full w-full object-contain p-1" loading="lazy" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
