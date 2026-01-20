import { useState, useMemo } from "react";
import {
  CheckCircle2,
  XCircle,
  Loader2,
  Clock,
  Download,
  RotateCcw,
  Package,
  ArrowLeft,
} from "lucide-react";
import JSZip from "jszip";
import { saveAs } from "file-saver";
import { cn, formatDimensions } from "@/lib/utils";
import { BeforeAfterViewer } from "./BeforeAfterViewer";
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
}

export function JobsPanel({
  jobs,
  outputs,
  images,
  uploadedImages,
  allComplete,
  onReset,
}: JobsPanelProps) {
  const [isDownloading, setIsDownloading] = useState(false);
  const [selectedImageId, setSelectedImageId] = useState<Id<"images"> | null>(null);

  const succeededCount = jobs.filter((j) => j.status === "succeeded").length;
  const failedCount = jobs.filter((j) => j.status === "failed").length;
  const runningCount = jobs.filter((j) => j.status === "running").length;
  const queuedCount = jobs.filter((j) => j.status === "queued").length;

  const imageMap = useMemo(() => {
    const map = new Map<string, ImageWithUrl>();
    images.forEach((img) => map.set(img._id, img));
    return map;
  }, [images]);

  const outputMap = useMemo(() => {
    const map = new Map<string, Output>();
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
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Processing</h2>
          <p className="text-sm text-[var(--color-text-muted)] mt-1">
            {allComplete
              ? `Completed • ${succeededCount} succeeded, ${failedCount} failed`
              : `${runningCount} running, ${queuedCount} queued`}
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
        </div>
      </div>

      {/* Progress summary */}
      {!allComplete && (
        <div className="h-2 rounded-full bg-[var(--color-bg-elevated)] overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-[var(--color-accent)] to-cyan-500 transition-all duration-500"
            style={{
              width: `${jobs.length > 0 ? ((succeededCount + failedCount) / jobs.length) * 100 : 0}%`,
            }}
          />
        </div>
      )}

      {/* Job grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
        {jobs.map((job, index) => {
          const image = imageMap.get(job.imageId);
          const output = outputMap.get(job.imageId);
          const uploadedImg = uploadedImages.find(
            (u) => image && u.file.name === image.fileName
          );

          return (
            <div
              key={job._id}
              className={cn(
                "group relative aspect-square rounded-xl overflow-hidden cursor-pointer",
                "border bg-[var(--color-bg-elevated)] transition-all duration-200",
                "animate-slide-up opacity-0",
                `stagger-${Math.min(index + 1, 6)}`,
                job.status === "succeeded"
                  ? "border-[var(--color-success)]/30 hover:border-[var(--color-success)]"
                  : job.status === "failed"
                  ? "border-[var(--color-error)]/30"
                  : "border-[var(--color-border)]"
              )}
              onClick={() => {
                if (job.status === "succeeded") {
                  setSelectedImageId(job.imageId);
                }
              }}
            >
              {/* Image */}
              <img
                src={
                  job.status === "succeeded" && output?.url
                    ? output.url
                    : uploadedImg?.preview || image?.url || ""
                }
                alt={image?.fileName || ""}
                className={cn(
                  "w-full h-full object-cover transition-all duration-300",
                  job.status === "running" && "blur-sm scale-105"
                )}
              />

              {/* Status overlay */}
              <div
                className={cn(
                  "absolute inset-0 flex items-center justify-center transition-opacity duration-300",
                  job.status === "running" && "bg-black/40",
                  job.status === "queued" && "bg-black/20",
                  job.status === "succeeded" && "bg-transparent group-hover:bg-black/40",
                  job.status === "failed" && "bg-[var(--color-error)]/20"
                )}
              >
                {job.status === "queued" && (
                  <div className="flex flex-col items-center gap-2">
                    <Clock className="w-6 h-6 text-white/80" />
                    <span className="text-xs text-white/80 font-medium">Queued</span>
                  </div>
                )}
                {job.status === "running" && (
                  <div className="flex flex-col items-center gap-2">
                    <Loader2 className="w-8 h-8 text-[var(--color-accent)] animate-spin" />
                    <span className="text-xs text-white font-medium">
                      {job.progressPct}%
                    </span>
                  </div>
                )}
                {job.status === "succeeded" && (
                  <div className="opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center gap-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (output) handleDownloadSingle(output);
                      }}
                      className="p-2 rounded-lg bg-white/20 backdrop-blur-sm hover:bg-white/30 transition-colors"
                    >
                      <Download className="w-5 h-5 text-white" />
                    </button>
                    <span className="text-xs text-white font-medium">View</span>
                  </div>
                )}
                {job.status === "failed" && (
                  <div className="flex flex-col items-center gap-2 p-3">
                    <XCircle className="w-6 h-6 text-[var(--color-error)]" />
                    <span className="text-xs text-white text-center font-medium">
                      Failed
                    </span>
                  </div>
                )}
              </div>

              {/* Status badge */}
              <div className="absolute top-2 left-2">
                {job.status === "succeeded" && (
                  <div className="p-1 rounded-md bg-[var(--color-success)] text-white">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                  </div>
                )}
                {job.status === "failed" && (
                  <div className="p-1 rounded-md bg-[var(--color-error)] text-white">
                    <XCircle className="w-3.5 h-3.5" />
                  </div>
                )}
              </div>

              {/* Dimensions badge for output */}
              {job.status === "succeeded" && output && (
                <div className="absolute bottom-2 left-2 px-2 py-1 rounded-md bg-black/60 backdrop-blur-sm">
                  <span className="text-[10px] text-white font-mono">
                    {formatDimensions(output.width, output.height)}
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Error details */}
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

      {/* Before/After Modal */}
      {selectedImageId && selectedOutput && selectedImage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
          <div className="relative w-full max-w-5xl max-h-[90vh] m-4 rounded-2xl overflow-hidden bg-[var(--color-bg-elevated)] border border-[var(--color-border)]">
            <div className="flex items-center justify-between p-4 border-b border-[var(--color-border)]">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setSelectedImageId(null)}
                  className="p-2 rounded-lg hover:bg-[var(--color-bg-hover)] transition-colors"
                >
                  <ArrowLeft className="w-5 h-5 text-[var(--color-text-muted)]" />
                </button>
                <div>
                  <h3 className="font-medium">{selectedImage.fileName}</h3>
                  <p className="text-xs text-[var(--color-text-muted)]">
                    {formatDimensions(selectedImage.width, selectedImage.height)} →{" "}
                    {formatDimensions(selectedOutput.width, selectedOutput.height)}
                  </p>
                </div>
              </div>
              <button
                onClick={() => handleDownloadSingle(selectedOutput)}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm",
                  "bg-[var(--color-accent)] text-[var(--color-bg)]",
                  "hover:bg-[var(--color-accent-hover)] transition-colors"
                )}
              >
                <Download className="w-4 h-4" />
                Download
              </button>
            </div>
            <div className="p-4 overflow-auto max-h-[calc(90vh-80px)]">
              <BeforeAfterViewer
                beforeUrl={selectedImage.url || ""}
                afterUrl={selectedOutput.url || ""}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
