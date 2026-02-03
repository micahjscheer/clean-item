import { useMemo, useState } from "react";
import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  Loader2,
  RotateCcw,
  Tag,
  XCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { UploadedImage } from "@/routes/index";
import type { Doc, Id } from "../../convex/_generated/dataModel";

type ResearchJob = Doc<"productResearch">;
type ImageWithUrl = Doc<"images"> & { url: string | null };

interface ResearchPanelProps {
  researchJobs: ResearchJob[];
  images: ImageWithUrl[];
  uploadedImages: UploadedImage[];
  allComplete: boolean;
  onReset: () => void;
  showReset?: boolean;
}

const conditionLabels: Record<string, string> = {
  new: "New",
  like_new: "Like New",
  good: "Good",
  fair: "Fair",
  poor: "Poor",
};

export function ResearchPanel({
  researchJobs,
  images,
  uploadedImages,
  allComplete,
  onReset,
  showReset = true,
}: ResearchPanelProps) {
  const [selectedImageId, setSelectedImageId] = useState<Id<"images"> | null>(
    null
  );

  const succeededCount = researchJobs.filter(
    (job) => job.status === "succeeded"
  ).length;
  const failedCount = researchJobs.filter(
    (job) => job.status === "failed"
  ).length;
  const runningCount = researchJobs.filter(
    (job) => job.status === "running"
  ).length;
  const queuedCount = researchJobs.filter(
    (job) => job.status === "queued"
  ).length;

  const imageMap = useMemo(() => {
    const map = new Map<string, ImageWithUrl>();
    images.forEach((img) => map.set(img._id, img));
    return map;
  }, [images]);

  const researchMap = useMemo(() => {
    const map = new Map<string, ResearchJob>();
    researchJobs.forEach((research) => map.set(research.imageId, research));
    return map;
  }, [researchJobs]);

  const selectedResearch = selectedImageId
    ? researchMap.get(selectedImageId)
    : null;
  const selectedImage = selectedImageId ? imageMap.get(selectedImageId) : null;
  const selectedPreview = selectedImage
    ? uploadedImages.find((img) => img.file.name === selectedImage.fileName)
        ?.preview
    : null;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">
            Product Research
          </h2>
          <p className="text-sm text-[var(--color-text-muted)] mt-1">
            {allComplete
              ? `Completed - ${succeededCount} succeeded, ${failedCount} failed`
              : `${runningCount} running, ${queuedCount} queued`}
          </p>
        </div>

        {showReset && (
          <div className="flex items-center gap-3">
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
        )}
      </div>

      {!allComplete && (
        <div className="h-2 rounded-full bg-[var(--color-bg-elevated)] overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-[var(--color-accent)] to-cyan-500 transition-all duration-500"
            style={{
              width: `${
                researchJobs.length > 0
                  ? ((succeededCount + failedCount) / researchJobs.length) * 100
                  : 0
              }%`,
            }}
          />
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
        {researchJobs.map((job, index) => {
          const image = imageMap.get(job.imageId);
          const uploadedImg = uploadedImages.find(
            (u) => image && u.file.name === image.fileName
          );

          const pricing = job.pricing as {
            currency?: string | null;
            recommended?: { price?: number | null };
          } | null;
          const listing = job.listing as {
            recommended_price?: number | null;
          } | null;
          const recommended =
            listing?.recommended_price ?? pricing?.recommended?.price ?? null;
          const currency = pricing?.currency ?? "USD";

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
              <img
                src={uploadedImg?.preview || image?.url || ""}
                alt={image?.fileName || ""}
                className={cn(
                  "w-full h-full object-cover transition-all duration-300",
                  job.status === "running" && "blur-sm scale-105"
                )}
              />

              <div
                className={cn(
                  "absolute inset-0 flex items-center justify-center transition-opacity duration-300",
                  job.status === "running" && "bg-black/40",
                  job.status === "queued" && "bg-black/20",
                  job.status === "succeeded" &&
                    "bg-transparent group-hover:bg-black/40",
                  job.status === "failed" && "bg-[var(--color-error)]/20"
                )}
              >
                {job.status === "queued" && (
                  <div className="flex flex-col items-center gap-2">
                    <Clock className="w-6 h-6 text-white/80" />
                    <span className="text-xs text-white/80 font-medium">
                      Queued
                    </span>
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
                    <Tag className="w-5 h-5 text-white" />
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

              {job.status === "succeeded" && recommended !== null && (
                <div className="absolute bottom-2 left-2 px-2 py-1 rounded-md bg-black/60 backdrop-blur-sm">
                  <span className="text-[10px] text-white font-mono">
                    {formatCurrency(recommended, currency)}
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {failedCount > 0 && (
        <div className="p-4 rounded-xl bg-[var(--color-error)]/10 border border-[var(--color-error)]/20">
          <h4 className="text-sm font-medium text-[var(--color-error)] mb-2">
            {failedCount} {failedCount === 1 ? "item" : "items"} failed
          </h4>
          <ul className="space-y-1">
            {researchJobs
              .filter((job) => job.status === "failed")
              .map((job) => {
                const image = imageMap.get(job.imageId);
                return (
                  <li
                    key={job._id}
                    className="text-xs text-[var(--color-text-muted)]"
                  >
                    <span className="font-medium">
                      {image?.fileName || "Unknown"}
                    </span>
                    {job.error && `: ${job.error}`}
                  </li>
                );
              })}
          </ul>
        </div>
      )}

      {selectedImageId && selectedResearch && selectedImage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
          <div className="relative w-full max-w-6xl max-h-[90vh] m-4 rounded-2xl overflow-hidden bg-[var(--color-bg-elevated)] border border-[var(--color-border)]">
            <div className="flex items-center justify-between p-4 border-b border-[var(--color-border)]">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setSelectedImageId(null)}
                  className="p-2 rounded-lg hover:bg-[var(--color-bg-hover)] transition-colors"
                >
                  <ArrowLeft className="w-5 h-5 text-[var(--color-text-muted)]" />
                </button>
                <div>
                  <h3 className="font-medium">
                    {getProductName(selectedResearch)}
                  </h3>
                  <p className="text-xs text-[var(--color-text-muted)]">
                    Seller condition:{" "}
                    {conditionLabels[selectedResearch.condition] ??
                      selectedResearch.condition}
                    {getExtractionCondition(selectedResearch)
                      ? ` | AI condition: ${getExtractionCondition(
                          selectedResearch
                        )}`
                      : ""}
                  </p>
                </div>
              </div>
            </div>

            <div className="p-4 overflow-auto max-h-[calc(90vh-80px)]">
              <div className="grid gap-6 lg:grid-cols-[1.1fr_1.4fr]">
                <div className="space-y-4">
                  <img
                    src={selectedImage.url || selectedPreview || ""}
                    alt={selectedImage.fileName}
                    className="w-full rounded-xl border border-[var(--color-border)]"
                  />
                </div>

                <div className="space-y-5">
                  {renderIdentification(selectedResearch)}
                  {renderListing(selectedResearch)}
                  {renderPricing(selectedResearch)}
                  {renderExtraction(selectedResearch)}
                  {renderSources(selectedResearch)}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function renderIdentification(research: ResearchJob) {
  const product = (research.product ?? {}) as {
    name?: string | null;
    brand?: string | null;
    model?: string | null;
    category?: string | null;
    variant?: string | null;
    confidence?: number | null;
    confidence_label?: string | null;
    evidence?: string[] | null;
  };

  const confidencePercent =
    typeof product.confidence === "number"
      ? Math.round(product.confidence * 100)
      : null;

  return (
    <section className="space-y-2">
      <h4 className="text-sm font-semibold text-[var(--color-text)]">
        Identification
      </h4>
      <div className="grid grid-cols-2 gap-2 text-sm">
        <InfoRow label="Name" value={product.name} />
        <InfoRow label="Brand" value={product.brand} />
        <InfoRow label="Model" value={product.model} />
        <InfoRow label="Category" value={product.category} />
        <InfoRow label="Variant" value={product.variant} />
        <InfoRow
          label="Confidence"
          value={
            confidencePercent !== null
              ? `${confidencePercent}% ${product.confidence_label ?? ""}`.trim()
              : product.confidence_label
          }
        />
      </div>
      {Array.isArray(product.evidence) && product.evidence.length > 0 && (
        <div className="text-xs text-[var(--color-text-muted)] space-y-1">
          <p className="font-medium text-[var(--color-text)]">Evidence</p>
          <ul className="list-disc list-inside space-y-1">
            {product.evidence.map((item, index) => (
              <li key={`${item}-${index}`}>{item}</li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

function renderPricing(research: ResearchJob) {
  const pricing = (research.pricing ?? {}) as {
    currency?: string | null;
    new?: { average?: number | null; minimum?: number | null } | null;
    used?: {
      low?: number | null;
      median?: number | null;
      high?: number | null;
    } | null;
    recommended?: { price?: number | null; rationale?: string | null } | null;
  };

  const currency = pricing.currency ?? "USD";

  return (
    <section className="space-y-2">
      <h4 className="text-sm font-semibold text-[var(--color-text)]">
        Pricing Summary
      </h4>
      <div className="grid grid-cols-2 gap-2 text-sm">
        <InfoRow
          label="New Avg"
          value={formatCurrency(pricing.new?.average ?? null, currency)}
        />
        <InfoRow
          label="New Min"
          value={formatCurrency(pricing.new?.minimum ?? null, currency)}
        />
        <InfoRow
          label="Used Low"
          value={formatCurrency(pricing.used?.low ?? null, currency)}
        />
        <InfoRow
          label="Used Median"
          value={formatCurrency(pricing.used?.median ?? null, currency)}
        />
        <InfoRow
          label="Used High"
          value={formatCurrency(pricing.used?.high ?? null, currency)}
        />
        <InfoRow
          label="Recommended"
          value={formatCurrency(pricing.recommended?.price ?? null, currency)}
        />
      </div>
      {pricing.recommended?.rationale && (
        <p className="text-xs text-[var(--color-text-muted)]">
          {pricing.recommended.rationale}
        </p>
      )}
    </section>
  );
}

function renderListing(research: ResearchJob) {
  const listing = (research.listing ?? {}) as {
    title?: string | null;
    description?: string | null;
    reason_for_selling?: string | null;
    issues?: string[] | null;
    loved?: string[] | null;
    highlights?: string[] | null;
    condition?: string | null;
    recommended_price?: number | null;
  };
  const pricing = (research.pricing ?? {}) as {
    currency?: string | null;
  };
  const currency = pricing.currency ?? "USD";

  const hasListing =
    listing.title ||
    listing.description ||
    listing.reason_for_selling ||
    (listing.issues && listing.issues.length > 0) ||
    (listing.loved && listing.loved.length > 0) ||
    (listing.highlights && listing.highlights.length > 0) ||
    listing.condition ||
    listing.recommended_price !== null;

  if (!hasListing) return null;

  return (
    <section className="space-y-2">
      <h4 className="text-sm font-semibold text-[var(--color-text)]">
        Listing Copy
      </h4>
      <div className="space-y-3 text-sm">
        <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2">
          <p className="text-[10px] uppercase tracking-wide text-[var(--color-text-subtle)]">
            Title
          </p>
          <p className="text-sm text-[var(--color-text)]">
            {listing.title ?? "N/A"}
          </p>
        </div>
        <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2">
          <p className="text-[10px] uppercase tracking-wide text-[var(--color-text-subtle)]">
            Description
          </p>
          <p className="text-sm text-[var(--color-text)] whitespace-pre-line">
            {listing.description ?? "N/A"}
          </p>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2 text-sm">
        <InfoRow
          label="Reason for Selling"
          value={listing.reason_for_selling}
        />
        <InfoRow label="Condition" value={listing.condition} />
        <InfoRow
          label="Recommended Price"
          value={formatCurrency(listing.recommended_price ?? null, currency)}
        />
        <InfoRow label="Highlights" value={formatList(listing.highlights)} />
        <InfoRow label="Loved" value={formatList(listing.loved)} />
        <InfoRow label="Issues" value={formatList(listing.issues)} />
      </div>
    </section>
  );
}

function renderExtraction(research: ResearchJob) {
  const extraction = (research.extraction ?? {}) as {
    materials?: string[] | null;
    colors?: string[] | null;
    condition?: string | null;
    visible_wear?: string[] | null;
    issues?: string[] | null;
    missing_parts?: string[] | null;
    included_items?: string[] | null;
    markings?: string[] | null;
    serial_numbers?: string[] | null;
    accessories?: string[] | null;
    notes?: string | null;
  };

  const hasDetails =
    (extraction.materials && extraction.materials.length > 0) ||
    (extraction.colors && extraction.colors.length > 0) ||
    (extraction.visible_wear && extraction.visible_wear.length > 0) ||
    (extraction.issues && extraction.issues.length > 0) ||
    (extraction.missing_parts && extraction.missing_parts.length > 0) ||
    (extraction.included_items && extraction.included_items.length > 0) ||
    (extraction.markings && extraction.markings.length > 0) ||
    (extraction.serial_numbers && extraction.serial_numbers.length > 0) ||
    (extraction.accessories && extraction.accessories.length > 0) ||
    extraction.condition ||
    extraction.notes;

  if (!hasDetails) return null;

  return (
    <section className="space-y-2">
      <h4 className="text-sm font-semibold text-[var(--color-text)]">
        Visual Details
      </h4>
      <div className="grid grid-cols-2 gap-2 text-sm">
        <InfoRow
          label="Materials"
          value={formatList(extraction.materials)}
        />
        <InfoRow label="Colors" value={formatList(extraction.colors)} />
        <InfoRow label="Condition (AI)" value={extraction.condition} />
        <InfoRow
          label="Visible Wear"
          value={formatList(extraction.visible_wear)}
        />
        <InfoRow label="Issues" value={formatList(extraction.issues)} />
        <InfoRow
          label="Missing Parts"
          value={formatList(extraction.missing_parts)}
        />
        <InfoRow
          label="Included Items"
          value={formatList(extraction.included_items)}
        />
        <InfoRow label="Markings" value={formatList(extraction.markings)} />
        <InfoRow
          label="Serial Numbers"
          value={formatList(extraction.serial_numbers)}
        />
        <InfoRow
          label="Accessories"
          value={formatList(extraction.accessories)}
        />
      </div>
      {extraction.notes && (
        <p className="text-xs text-[var(--color-text-muted)]">
          {extraction.notes}
        </p>
      )}
    </section>
  );
}

function renderSources(research: ResearchJob) {
  const pricing = (research.pricing ?? {}) as {
    sources?: {
      title?: string | null;
      url?: string | null;
      price?: number | null;
      condition?: string | null;
      type?: string | null;
    }[] | null;
    currency?: string | null;
  };

  if (!pricing.sources || pricing.sources.length === 0) return null;

  const currency = pricing.currency ?? "USD";

  return (
    <section className="space-y-2">
      <h4 className="text-sm font-semibold text-[var(--color-text)]">
        Sources
      </h4>
      <ul className="space-y-2 text-xs text-[var(--color-text-muted)]">
        {pricing.sources.map((source, index) => (
          <li
            key={`${source.url ?? "source"}-${index}`}
            className="flex flex-col gap-1"
          >
            {source.url ? (
              <a
                href={source.url}
                target="_blank"
                rel="noreferrer"
                className="text-[var(--color-accent)] hover:underline"
              >
                {source.title || source.url}
              </a>
            ) : (
              <span>{source.title}</span>
            )}
            <span>
              {formatCurrency(source.price ?? null, currency)}
              {source.condition ? ` | ${source.condition}` : ""}
              {source.type ? ` | ${source.type}` : ""}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function InfoRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2">
      <p className="text-[10px] uppercase tracking-wide text-[var(--color-text-subtle)]">
        {label}
      </p>
      <p className="text-sm text-[var(--color-text)]">
        {value ?? "N/A"}
      </p>
    </div>
  );
}

function formatCurrency(value: number | null, currency: string) {
  if (value === null || Number.isNaN(value)) return "N/A";
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }).format(value);
  } catch (error) {
    return `${currency} ${value.toFixed(2)}`;
  }
}

function formatList(values?: string[] | null) {
  if (!values || values.length === 0) return "N/A";
  return values.join(", ");
}

function getProductName(research: ResearchJob) {
  const listing = (research.listing ?? {}) as { title?: string | null };
  const product = (research.product ?? {}) as { name?: string | null };
  return listing.title ?? product.name ?? "Product Research";
}

function getExtractionCondition(research: ResearchJob) {
  const extraction = (research.extraction ?? {}) as {
    condition?: string | null;
  };
  return extraction.condition ?? null;
}
