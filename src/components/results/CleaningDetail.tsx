import { Download } from "lucide-react";
import { BeforeAfterViewer } from "@/components/BeforeAfterViewer";
import { formatDimensions } from "@/lib/utils";
import type { Id } from "../../../convex/_generated/dataModel";

interface CleaningDetailProps {
  imageId: Id<"images">;
  imageName: string;
  beforeUrl: string;
  afterUrl: string;
  beforeWidth: number;
  beforeHeight: number;
  afterWidth: number;
  afterHeight: number;
  onDownload: () => void;
}

export function CleaningDetail({
  imageId,
  imageName,
  beforeUrl,
  afterUrl,
  beforeWidth,
  beforeHeight,
  afterWidth,
  afterHeight,
  onDownload,
}: CleaningDetailProps) {
  return (
    <section
      className="space-y-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-elevated)] p-4"
      data-image-id={imageId}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <h3 className="text-lg font-semibold text-[var(--color-text)]">{imageName}</h3>
          <p className="text-sm text-[var(--color-text-muted)]">
            {formatDimensions(beforeWidth, beforeHeight)} to{" "}
            {formatDimensions(afterWidth, afterHeight)}
          </p>
        </div>
        <button
          type="button"
          onClick={onDownload}
          className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-4 py-2 text-sm font-medium text-[var(--color-text)] hover:bg-[var(--color-bg-hover)]"
        >
          <Download className="h-4 w-4" />
          Download
        </button>
      </div>
      <BeforeAfterViewer beforeUrl={beforeUrl} afterUrl={afterUrl} />
    </section>
  );
}
