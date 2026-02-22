import { useMemo, useState } from "react";
import { Download, RotateCcw } from "lucide-react";
import JSZip from "jszip";
import { saveAs } from "file-saver";
import { CleaningDetail } from "@/components/results/CleaningDetail";
import { StatusCard } from "@/components/shared/StatusCard";
import { ProgressBar } from "@/components/shared/ProgressBar";
import { cn } from "@/lib/utils";
import type { UploadedImage } from "@/routes/index";
import type { Doc, Id } from "../../convex/_generated/dataModel";

type Job = Doc<"jobs">;
type Output = Doc<"outputs"> & { url: string | null; imageId: Id<"images"> };
type ImageWithUrl = Doc<"images"> & { url: string | null };

interface JobsPanelProps {
  jobs: Job[];
  outputs: Output[];
  images: ImageWithUrl[];
  uploadedImages: UploadedImage[];
  allComplete: boolean;
  onReset: () => void;
  showReset?: boolean;
  title?: string;
}

export function JobsPanel({
  jobs,
  outputs,
  images,
  uploadedImages,
  allComplete,
  onReset,
  showReset = true,
  title,
}: JobsPanelProps) {
  const [isDownloading, setIsDownloading] = useState(false);
  const [selectedImageId, setSelectedImageId] = useState<Id<"images"> | null>(null);
  const succeededCount = jobs.filter((job) => job.status === "succeeded").length;
  const failedCount = jobs.filter((job) => job.status === "failed").length;
  const finishedCount = succeededCount + failedCount;

  const imageMap = useMemo(() => {
    const map = new Map<Id<"images">, ImageWithUrl>();
    images.forEach((img) => map.set(img._id, img));
    return map;
  }, [images]);

  const outputMap = useMemo(() => {
    const map = new Map<Id<"images">, Output>();
    outputs.forEach((out) => map.set(out.imageId, out));
    return map;
  }, [outputs]);

  const handleDownloadAll = async () => {
    if (outputs.length === 0) return;
    setIsDownloading(true);

    try {
      const zip = new JSZip();

      for (const output of outputs) {
        if (!output.url) continue;
        const image = imageMap.get(output.imageId);
        const fileName = image?.fileName || `cleaned-${output._id}.jpg`;
        
        const response = await fetch(output.url);
        const blob = await response.blob();
        zip.file(`cleaned-${fileName}`, blob);
      }

      const content = await zip.generateAsync({ type: "blob" });
      saveAs(content, `cleaned-photos-${Date.now()}.zip`);
    } catch (error) {
      console.error("Failed to create zip:", error);
    } finally {
      setIsDownloading(false);
    }
  };

  const handleDownloadSingle = async (output: Output) => {
    if (!output.url) return;
    const image = imageMap.get(output.imageId);
    const fileName = image?.fileName || `cleaned-${output._id}.jpg`;

    try {
      const response = await fetch(output.url);
      const blob = await response.blob();
      saveAs(blob, `cleaned-${fileName}`);
    } catch (error) {
      console.error("Failed to download:", error);
    }
  };

  const selectedOutput = selectedImageId ? outputMap.get(selectedImageId) : null;
  const selectedImage = selectedImageId ? imageMap.get(selectedImageId) : null;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">
            {title ?? "Processing"}
          </h2>
          <p className="text-sm text-[var(--color-text-muted)] mt-1">
            {allComplete
              ? `Completed • ${succeededCount} succeeded, ${failedCount} failed`
              : `${finishedCount}/${jobs.length} finished`}
          </p>
        </div>

        <div className="flex items-center gap-3">
          {allComplete && succeededCount > 0 && (
            <button
              onClick={handleDownloadAll}
              disabled={isDownloading}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition-all",
                "bg-gradient-to-r from-[var(--color-accent)] to-cyan-500",
                "text-[var(--color-bg)] shadow-lg shadow-cyan-500/20",
                "hover:shadow-xl hover:shadow-cyan-500/30",
                "disabled:opacity-50 disabled:cursor-not-allowed"
              )}
            >
              {isDownloading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Package className="w-4 h-4" />
              )}
              Download All ({succeededCount})
            </button>
          )}
          {showReset && (
            <button
              onClick={onReset}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition-all",
                "bg-[var(--color-bg-elevated)] border border-[var(--color-border)]",
                "text-[var(--color-text-muted)] hover:text-[var(--color-text)]",
                "hover:bg-[var(--color-bg-hover)]"
              )}
            >
              <RotateCcw className="w-4 h-4" />
              New Batch
            </button>
          )}
        </div>
      </div>

      {!allComplete && (
        <ProgressBar label="Cleaning Progress" value={finishedCount} total={jobs.length} />
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
        {jobs.map((job) => {
          const image = imageMap.get(job.imageId);
          const output = outputMap.get(job.imageId);
          const uploadedImg = uploadedImages.find(
            (u) => image && u.file.name === image.fileName
          );
          const previewUrl =
            (job.status === "succeeded" ? output?.url : null) ?? uploadedImg?.preview ?? image?.url ?? "";
          const footerLabel = output ? `${output.width}x${output.height}` : undefined;
          const imageName = image?.fileName ?? "Image";

          return (
            <StatusCard
              key={job._id}
              title={imageName}
              subtitle={job.error ?? undefined}
              imageUrl={previewUrl}
              status={job.status}
              progressPct={job.progressPct}
              footerLabel={footerLabel}
              onClick={() => setSelectedImageId(job.imageId)}
            />
          );
        })}
      </div>

      {failedCount > 0 && (
        <div className="p-4 rounded-xl bg-[var(--color-error)]/10 border border-[var(--color-error)]/20">
          <h4 className="text-sm font-medium text-[var(--color-error)] mb-2">
            {failedCount} {failedCount === 1 ? "image" : "images"} failed
          </h4>
          <ul className="space-y-1">
            {jobs
              .filter((j) => j.status === "failed")
              .map((job) => {
                const image = imageMap.get(job.imageId);
                return (
                  <li
                    key={job._id}
                    className="text-xs text-[var(--color-text-muted)]"
                  >
                    <span className="font-medium">{image?.fileName || "Unknown"}</span>
                    {job.error && `: ${job.error}`}
                  </li>
                );
              })}
          </ul>
        </div>
      )}

      {selectedImageId && selectedOutput && selectedImage && (
        <div className="space-y-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-4">
          <button
            type="button"
            onClick={() => setSelectedImageId(null)}
            className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-elevated)] px-3 py-2 text-sm text-[var(--color-text)]"
          >
            Back to Grid
          </button>
          <CleaningDetail
            imageId={selectedImage._id}
            imageName={selectedImage.fileName}
            beforeUrl={selectedImage.url ?? ""}
            afterUrl={selectedOutput.url ?? ""}
            beforeWidth={selectedImage.width}
            beforeHeight={selectedImage.height}
            afterWidth={selectedOutput.width}
            afterHeight={selectedOutput.height}
            onDownload={() => handleDownloadSingle(selectedOutput)}
          />
        </div>
      )}
    </div>
  );
}
