import { ArrowRight } from "lucide-react";
import { UploadZone } from "@/components/UploadZone";
import { ImageGrid } from "@/components/ImageGrid";
import { ErrorBanner } from "@/components/shared/ErrorBanner";
import { cn } from "@/lib/utils";
import type { UploadedImage } from "@/routes/index";

interface UploadStepProps {
  images: UploadedImage[];
  onFilesAdded: (files: File[]) => void;
  onValidationChange: (message: string | null) => void;
  onRemoveImage: (id: string) => void;
  onNext: () => void;
  validationError: string | null;
}

export function UploadStep({
  images,
  onFilesAdded,
  onValidationChange,
  onRemoveImage,
  onNext,
  validationError,
}: UploadStepProps) {
  return (
    <div className="space-y-6">
      <UploadZone onFilesAdded={onFilesAdded} onValidationError={onValidationChange} />
      {validationError ? <ErrorBanner message={validationError} /> : null}

      {images.length > 0 ? (
        <>
          <ImageGrid images={images} onRemove={onRemoveImage} />
          <button
            type="button"
            onClick={onNext}
            className={cn(
              "inline-flex min-h-11 items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold",
              "bg-gradient-to-r from-[var(--color-accent)] to-cyan-500 text-[var(--color-bg)]",
              "shadow-lg shadow-cyan-500/20 transition-all hover:shadow-cyan-500/30"
            )}
          >
            Next: Configure Workflow
            <ArrowRight className="h-4 w-4" />
          </button>
        </>
      ) : null}
    </div>
  );
}
