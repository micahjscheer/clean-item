import { useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { Upload, Image as ImageIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface UploadZoneProps {
  onFilesAdded: (files: File[]) => void;
  onValidationError?: (message: string | null) => void;
}

const maxFileSizeBytes = 20 * 1024 * 1024;

export function UploadZone({ onFilesAdded, onValidationError }: UploadZoneProps) {
  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      const imageFiles = acceptedFiles.filter((file) =>
        file.type.startsWith("image/")
      );
      if (imageFiles.length > 0) {
        onValidationError?.(null);
        onFilesAdded(imageFiles);
      }
    },
    [onFilesAdded, onValidationError]
  );

  const onDropRejected = useCallback(() => {
    onValidationError?.("Some files were rejected. Use JPEG, PNG, WebP, or HEIC up to 20MB.");
  }, [onValidationError]);

  const onFileDialogCancel = useCallback(() => {
    onValidationError?.(null);
  }, [onValidationError]);

  const onDragEnter = useCallback(() => {
    onValidationError?.(null);
  }, [onValidationError]);

  const onError = useCallback(() => {
    onValidationError?.("Upload selection failed. Please try again.");
  }, [onValidationError]);

  const { getRootProps, getInputProps, isDragActive, isDragAccept } =
    useDropzone({
      onDrop,
      onDropRejected,
      onFileDialogCancel,
      onDragEnter,
      onError,
      accept: {
        "image/*": [".jpeg", ".jpg", ".png", ".webp", ".heic", ".heif"],
      },
      maxSize: maxFileSizeBytes,
      multiple: true,
    });

  const rootProps = getRootProps();
  const inputProps = getInputProps();

  return (
    <div
      {...rootProps}
      className={cn(
        "relative cursor-pointer overflow-hidden rounded-2xl border-2 border-dashed transition-all duration-300 group",
        "hover:border-[var(--color-accent)] hover:bg-[var(--color-accent-muted)]",
        isDragActive && "border-[var(--color-accent)] bg-[var(--color-accent-muted)] scale-[1.01]",
        isDragAccept && "border-[var(--color-success)]",
        !isDragActive && "border-[var(--color-border)]"
      )}
    >
      <input {...inputProps} />
  );

      {/* Background pattern */}
      <div className="absolute inset-0 opacity-[0.03]" style={{
        backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%2322d3ee' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
      }} />
      
      <div className="relative px-8 py-16 flex flex-col items-center gap-4">
        <div
          className={cn(
            "w-16 h-16 rounded-2xl flex items-center justify-center transition-all duration-300",
            "bg-[var(--color-bg-elevated)] border border-[var(--color-border)]",
            "group-hover:bg-[var(--color-accent-muted)] group-hover:border-[var(--color-accent)]",
            isDragActive && "animate-pulse-glow bg-[var(--color-accent-muted)] border-[var(--color-accent)]"
          )}
        >
          {isDragActive ? (
            <ImageIcon className="w-8 h-8 text-[var(--color-accent)]" />
          ) : (
            <Upload className="w-8 h-8 text-[var(--color-text-muted)] group-hover:text-[var(--color-accent)]" />
          )}
        </div>

        <div className="text-center">
          <p className="text-lg font-medium text-[var(--color-text)]">
            {isDragActive ? "Drop your photos here" : "Drag & drop photos"}
          </p>
          <p className="text-sm text-[var(--color-text-muted)] mt-1">
            or click to browse • JPEG, PNG, WebP, HEIC
          </p>
        </div>

        <div className="mt-2 flex items-center gap-6 text-xs text-[var(--color-text-subtle)]">
          <span className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-success)]" />
            Multiple files supported
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-success)]" />
            Up to 20MB each
          </span>
        </div>
      </div>
    </div>
  );
}
