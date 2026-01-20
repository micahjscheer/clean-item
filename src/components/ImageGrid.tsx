import { X } from "lucide-react";
import { cn, formatBytes } from "@/lib/utils";
import type { UploadedImage } from "@/routes/index";

interface ImageGridProps {
  images: UploadedImage[];
  onRemove: (id: string) => void;
}

export function ImageGrid({ images, onRemove }: ImageGridProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-[var(--color-text-muted)]">
          Selected Images
        </h3>
        <span className="text-xs text-[var(--color-text-subtle)]">
          {images.length} {images.length === 1 ? "file" : "files"}
        </span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
        {images.map((image, index) => (
          <div
            key={image.id}
            className={cn(
              "group relative aspect-square rounded-xl overflow-hidden",
              "border border-[var(--color-border)] bg-[var(--color-bg-elevated)]",
              "animate-slide-up opacity-0",
              `stagger-${Math.min(index + 1, 6)}`
            )}
          >
            <img
              src={image.preview}
              alt={image.file.name}
              className="w-full h-full object-cover"
            />
            
            {/* Overlay on hover */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200">
              <div className="absolute bottom-0 left-0 right-0 p-3">
                <p className="text-xs text-white font-medium truncate">
                  {image.file.name}
                </p>
                <p className="text-[10px] text-white/70">
                  {formatBytes(image.file.size)}
                </p>
              </div>
            </div>

            {/* Remove button */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                onRemove(image.id);
              }}
              className={cn(
                "absolute top-2 right-2 p-1.5 rounded-lg",
                "bg-black/50 backdrop-blur-sm border border-white/10",
                "opacity-0 group-hover:opacity-100 transition-all duration-200",
                "hover:bg-[var(--color-error)] hover:border-transparent"
              )}
            >
              <X className="w-3.5 h-3.5 text-white" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
