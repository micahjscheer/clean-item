import { useEffect } from "react";
import { ProgressBar } from "@/components/shared/ProgressBar";
import { StatusCard } from "@/components/shared/StatusCard";
import type { ProcessingMode } from "@/lib/workflowSchemas";
import type { Doc, Id } from "../../../convex/_generated/dataModel";

type Job = Doc<"jobs">;
type ResearchJob = Doc<"productResearch">;
type ImageWithUrl = Doc<"images"> & { url: string | null };
type Output = Doc<"outputs"> & { url: string | null; imageId: Id<"images"> };

interface ProcessingStepProps {
  mode: ProcessingMode;
  uploadProgressByImageId: Record<string, number>;
  images: ImageWithUrl[];
  jobs: Job[];
  researchJobs: ResearchJob[];
  outputs: Output[];
  onSelectImage: (imageId: Id<"images">) => void;
  onComplete: () => void;
}

const finishedStatuses = ["succeeded", "failed"] as const;

export function ProcessingStep({
  mode,
  uploadProgressByImageId,
  images,
  jobs,
  researchJobs,
  outputs,
  onSelectImage,
  onComplete,
}: ProcessingStepProps) {
  const outputMap = new Map(outputs.map((output) => [output.imageId, output]));
  const uploadEntries = Object.entries(uploadProgressByImageId);
  const uploadedCount = uploadEntries.filter((entry) => entry[1] >= 100).length;
  const totalUploads = uploadEntries.length;

  const completedCleanCount = jobs.filter((job) => finishedStatuses.includes(job.status)).length;
  const completedResearchCount = researchJobs.filter((job) =>
    finishedStatuses.includes(job.status)
  ).length;

  const shouldShowCleaning = mode === "clean" || mode === "listing";
  const shouldShowResearch = mode === "research" || mode === "listing";
  const allCleaningDone = jobs.length > 0 && completedCleanCount === jobs.length;
  const allResearchDone = researchJobs.length > 0 && completedResearchCount === researchJobs.length;
  const isComplete =
    (shouldShowCleaning ? allCleaningDone : true) &&
    (shouldShowResearch ? allResearchDone : true) &&
    totalUploads > 0 &&
    uploadedCount === totalUploads;

  useEffect(() => {
    if (isComplete) {
      onComplete();
    }
  }, [isComplete, onComplete]);

  return (
    <div className="space-y-6">
      <ProgressBar label="Upload Progress" value={uploadedCount} total={totalUploads} />
      {shouldShowCleaning ? (
        <ProgressBar
          label="Photo Cleaning"
          value={completedCleanCount}
          total={jobs.length}
          className="pt-2"
        />
      ) : null}
      {shouldShowResearch ? (
        <ProgressBar
          label="Product Research"
          value={completedResearchCount}
          total={researchJobs.length}
          className="pt-2"
        />
      ) : null}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
        {images.map((image) => {
          const cleanJob = jobs.find((job) => job.imageId === image._id);
          const researchJob = researchJobs.find((job) => job.imageId === image._id);
          const status = shouldShowCleaning
            ? cleanJob?.status ?? "queued"
            : researchJob?.status ?? "queued";
          const progress = shouldShowCleaning ? cleanJob?.progressPct : researchJob?.progressPct;
          const output = outputMap.get(image._id);
          const imageUrl = output?.url ?? image.url ?? "";
          const subtitle =
            mode === "listing"
              ? `${cleanJob?.status ?? "queued"} / ${researchJob?.status ?? "queued"}`
              : undefined;
          return (
            <StatusCard
              key={image._id}
              title={image.fileName}
              subtitle={subtitle}
              imageUrl={imageUrl}
              status={status}
              progressPct={progress}
              onClick={() => onSelectImage(image._id)}
            />
          );
        })}
      </div>
    </div>
  );
}
