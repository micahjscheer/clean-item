import { useMemo, useState } from "react";
import { RotateCcw } from "lucide-react";
import { ResearchDetail } from "@/components/results/ResearchDetail";
import { ProgressBar } from "@/components/shared/ProgressBar";
import { StatusCard } from "@/components/shared/StatusCard";
import { parseExtraction, parseListing, parsePricing } from "@/lib/researchSchemas";
import { cn } from "@/lib/utils";
import type { UploadedImage } from "@/routes/index";
import type { Doc, Id } from "../../convex/_generated/dataModel";

type ResearchJob = Doc<"productResearch">;
type ImageWithUrl = Doc<"images"> & { url: string | null };
type Output = Doc<"outputs"> & { url: string | null; imageId: Id<"images"> };

interface ResearchPanelProps {
  researchJobs: ResearchJob[];
  images: ImageWithUrl[];
  uploadedImages: UploadedImage[];
  outputs?: Output[];
  allComplete: boolean;
  onReset: () => void;
  showReset?: boolean;
  title?: string;
}

export function ResearchPanel({
  researchJobs,
  images,
  uploadedImages,
  outputs,
  allComplete,
  onReset,
  showReset = true,
  title,
}: ResearchPanelProps) {
  const [selectedImageId, setSelectedImageId] = useState<Id<"images"> | null>(null);
  const completedCount = researchJobs.filter((job) => job.status === "succeeded" || job.status === "failed").length;
  const failedCount = researchJobs.filter((job) => job.status === "failed").length;
  const succeededCount = researchJobs.filter((job) => job.status === "succeeded").length;

  const imageMap = useMemo(() => {
    const map = new Map<Id<"images">, ImageWithUrl>();
    images.forEach((image) => map.set(image._id, image));
    return map;
  }, [images]);

  const outputMap = useMemo(() => {
    const map = new Map<Id<"images">, Output>();
    (outputs ?? []).forEach((output) => map.set(output.imageId, output));
    return map;
  }, [outputs]);

  const selectedResearch = selectedImageId
    ? researchJobs.find((research) => research.imageId === selectedImageId)
    : null;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">{title ?? "Product Research"}</h2>
          <p className="mt-1 text-sm text-[var(--color-text-muted)]">
            {allComplete
              ? `Completed • ${succeededCount} succeeded, ${failedCount} failed`
              : `${completedCount}/${researchJobs.length} finished`}
          </p>
        </div>
        {showReset ? (
          <button
            type="button"
            onClick={onReset}
            className={cn(
              "flex items-center gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-elevated)] px-4 py-2 text-sm font-medium",
              "text-[var(--color-text-muted)] transition-all hover:bg-[var(--color-bg-hover)] hover:text-[var(--color-text)]"
            )}
          >
            <RotateCcw className="h-4 w-4" />
            New Batch
          </button>
        ) : null}
      </div>

      {!allComplete ? (
        <ProgressBar label="Research Progress" value={completedCount} total={researchJobs.length} />
      ) : null}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
        {researchJobs.map((job) => {
          const image = imageMap.get(job.imageId);
          const uploadedImage = uploadedImages.find(
            (candidate) => image && candidate.file.name === image.fileName
          );
          const output = outputMap.get(job.imageId);
          const previewUrl = output?.url ?? uploadedImage?.preview ?? image?.url ?? "";
          const extraction = parseExtraction(job.extraction);
          const listing = parseListing(job.listing);
          const pricing = parsePricing(job.pricing);
          const recommendedPrice = listing.recommended_price ?? pricing.recommended.price;
          const currency = pricing.currency ?? "USD";
          const priceLabel = formatCurrency(recommendedPrice, currency);
          return (
            <StatusCard
              key={job._id}
              title={image?.fileName ?? "Image"}
              subtitle={job.error ?? undefined}
              imageUrl={previewUrl}
              status={job.status}
              progressPct={job.progressPct}
              flagLabel={extraction.relevance.is_relevant ? undefined : "Check relevance"}
              flagTone={extraction.relevance.is_relevant ? "default" : "warning"}
              footerLabel={priceLabel}
              onClick={() => setSelectedImageId(job.imageId)}
            />
          );
        })}
      </div>

      {selectedResearch ? (
        <div className="space-y-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-4">
          <button
            type="button"
            onClick={() => setSelectedImageId(null)}
            className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-elevated)] px-3 py-2 text-sm text-[var(--color-text)]"
          >
            Back to Grid
          </button>
          <ResearchDetail research={selectedResearch} />
        </div>
      ) : null}
    </div>
  );
}

function formatCurrency(value: number | null, currency: string) {
  if (value === null) return "N/A";
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(value);
  } catch (error) {
    return `${currency} ${value.toFixed(2)}`;
  }
}
