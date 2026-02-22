import { useMemo } from "react";
import { Download, RotateCcw } from "lucide-react";
import { StatusCard } from "@/components/shared/StatusCard";
import { CleaningDetail } from "@/components/results/CleaningDetail";
import { ResearchDetail } from "@/components/results/ResearchDetail";
import type { ProcessingMode } from "@/lib/workflowSchemas";
import type { Doc, Id } from "../../../convex/_generated/dataModel";

type Job = Doc<"jobs">;
type ResearchJob = Doc<"productResearch">;
type ImageWithUrl = Doc<"images"> & { url: string | null };
type Output = Doc<"outputs"> & { url: string | null; imageId: Id<"images"> };

interface ResultsStepProps {
  mode: ProcessingMode;
  images: ImageWithUrl[];
  jobs: Job[];
  researchJobs: ResearchJob[];
  outputs: Output[];
  selectedDetailId: Id<"images"> | null;
  onSelectDetail: (id: Id<"images"> | null) => void;
  onDownloadAll: () => void;
  onDownloadSingle: (output: Output) => void;
  onReset: () => void;
}

export function ResultsStep({
  mode,
  images,
  jobs,
  researchJobs,
  outputs,
  selectedDetailId,
  onSelectDetail,
  onDownloadAll,
  onDownloadSingle,
  onReset,
}: ResultsStepProps) {
  const outputMap = useMemo(() => new Map(outputs.map((output) => [output.imageId, output])), [
    outputs,
  ]);
  const jobsMap = useMemo(() => new Map(jobs.map((job) => [job.imageId, job])), [jobs]);
  const researchMap = useMemo(
    () => new Map(researchJobs.map((research) => [research.imageId, research])),
    [researchJobs]
  );

  const selectedImage = selectedDetailId ? images.find((image) => image._id === selectedDetailId) : null;
  const selectedOutput = selectedDetailId ? outputMap.get(selectedDetailId) : null;
  const selectedResearch = selectedDetailId ? researchMap.get(selectedDetailId) : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={onDownloadAll}
          className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-elevated)] px-4 py-2 text-sm font-medium text-[var(--color-text)] hover:bg-[var(--color-bg-hover)]"
        >
          <Download className="h-4 w-4" />
          Download All
        </button>
        <button
          type="button"
          onClick={onReset}
          className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-elevated)] px-4 py-2 text-sm font-medium text-[var(--color-text)] hover:bg-[var(--color-bg-hover)]"
        >
          <RotateCcw className="h-4 w-4" />
          New Batch
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
        {images.map((image) => {
          const output = outputMap.get(image._id);
          const cleanJob = jobsMap.get(image._id);
          const researchJob = researchMap.get(image._id);
          const status = mode === "research" ? researchJob?.status : cleanJob?.status;
          const imageUrl = output?.url ?? image.url ?? "";
          const price = researchJob ? getRecommendedPriceText(researchJob) : null;

          if (!status) return null;
          return (
            <StatusCard
              key={image._id}
              title={image.fileName}
              imageUrl={imageUrl}
              status={status}
              footerLabel={price}
              onClick={() => onSelectDetail(image._id)}
            />
          );
        })}
      </div>

      {selectedDetailId && selectedImage ? (
        <div className="space-y-3">
          <button
            type="button"
            onClick={() => onSelectDetail(null)}
            className="min-h-11 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-elevated)] px-4 py-2 text-sm font-medium text-[var(--color-text)] hover:bg-[var(--color-bg-hover)]"
          >
            Back to Results
          </button>
          {selectedOutput ? (
            <CleaningDetail
              imageId={selectedImage._id}
              imageName={selectedImage.fileName}
              beforeUrl={selectedImage.url ?? ""}
              afterUrl={selectedOutput.url ?? ""}
              beforeWidth={selectedImage.width}
              beforeHeight={selectedImage.height}
              afterWidth={selectedOutput.width}
              afterHeight={selectedOutput.height}
              onDownload={() => onDownloadSingle(selectedOutput)}
            />
          ) : null}
          {(mode === "research" || mode === "listing") && selectedResearch ? (
            <ResearchDetail research={selectedResearch} />
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function getRecommendedPriceText(research: ResearchJob) {
  const pricing = research.pricing;
  if (!pricing || typeof pricing !== "object") return null;
  if (!("recommended" in pricing)) return null;
  const recommended = pricing.recommended;
  if (!recommended || typeof recommended !== "object") return null;
  if (!("price" in recommended)) return null;
  const recommendedPrice = recommended.price;
  const currency = "currency" in pricing && typeof pricing.currency === "string" ? pricing.currency : "USD";
  if (typeof recommendedPrice !== "number") return null;
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(
      recommendedPrice
    );
  } catch (error) {
    return `${currency} ${recommendedPrice.toFixed(2)}`;
  }
}
