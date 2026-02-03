import { useState, useCallback } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { UploadZone } from "@/components/UploadZone";
import { ImageGrid } from "@/components/ImageGrid";
import { JobsPanel } from "@/components/JobsPanel";
import { OptionsPanel } from "@/components/OptionsPanel";
import { ResearchOptionsPanel } from "@/components/ResearchOptionsPanel";
import { ResearchPanel } from "@/components/ResearchPanel";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn, generateId } from "@/lib/utils";
import type { Id } from "../../convex/_generated/dataModel";

export type CleanlinessLevel = "light" | "standard" | "deep";
export type TargetOutput = "match" | "2k" | "4k";
export type ProcessingMode = "clean" | "research" | "listing";
export type ItemCondition = "new" | "like_new" | "good" | "fair" | "poor";

export interface UploadedImage {
  file: File;
  preview: string;
  id: string;
}

export function IndexPage() {
  const [sessionId] = useState(() => generateId());
  const [uploadedImages, setUploadedImages] = useState<UploadedImage[]>([]);
  const [currentUploadId, setCurrentUploadId] = useState<Id<"uploads"> | null>(null);
  const [cleanlinessLevel, setCleanlinessLevel] = useState<CleanlinessLevel>("standard");
  const [targetOutput, setTargetOutput] = useState<TargetOutput>("match");
  const [mode, setMode] = useState<ProcessingMode>("listing");
  const [condition, setCondition] = useState<ItemCondition>("good");
  const [isProcessing, setIsProcessing] = useState(false);

  const createUpload = useMutation(api.uploads.createUpload);
  const addImage = useMutation(api.uploads.addImage);
  const generateUploadUrl = useMutation(api.uploads.generateUploadUrl);
  const startEdit = useMutation(api.jobs.startEdit);
  const startResearch = useMutation(api.research.startResearch);
  
  const jobs = useQuery(
    api.jobs.getJobsByUpload,
    (mode === "clean" || mode === "listing") && currentUploadId
      ? { uploadId: currentUploadId }
      : "skip"
  );

  const outputs = useQuery(
    api.outputs.getOutputsByUpload,
    (mode === "clean" || mode === "listing") && currentUploadId
      ? { uploadId: currentUploadId }
      : "skip"
  );

  const images = useQuery(
    api.uploads.getImagesByUpload,
    currentUploadId ? { uploadId: currentUploadId } : "skip"
  );

  const researchJobs = useQuery(
    api.research.getResearchByUpload,
    (mode === "research" || mode === "listing") && currentUploadId
      ? { uploadId: currentUploadId }
      : "skip"
  );

  const handleFilesAdded = useCallback((files: File[]) => {
    const newImages = files.map((file) => ({
      file,
      preview: URL.createObjectURL(file),
      id: generateId(),
    }));
    setUploadedImages((prev) => [...prev, ...newImages]);
  }, []);

  const handleRemoveImage = useCallback((id: string) => {
    setUploadedImages((prev) => {
      const img = prev.find((i) => i.id === id);
      if (img) URL.revokeObjectURL(img.preview);
      return prev.filter((i) => i.id !== id);
    });
  }, []);

  const handleStartProcessing = useCallback(async () => {
    if (uploadedImages.length === 0) return;
    
    setIsProcessing(true);
    
    try {
      // Create upload session
      const uploadId = await createUpload({
        clientSessionId: sessionId,
      });
      setCurrentUploadId(uploadId);

      // Upload each image and create jobs
      const imageIds: Id<"images">[] = [];
      
      for (const img of uploadedImages) {
        // Get upload URL
        const uploadUrl = await generateUploadUrl();
        
        // Upload file to Convex storage
        const response = await fetch(uploadUrl, {
          method: "POST",
          headers: { "Content-Type": img.file.type },
          body: img.file,
        });
        
        const { storageId } = await response.json();

        // Get image dimensions
        const dimensions = await getImageDimensions(img.file);
        
        // Create image record
        const imageId = await addImage({
          uploadId,
          storageId,
          width: dimensions.width,
          height: dimensions.height,
          mimeType: img.file.type,
          fileName: img.file.name,
        });
        
        imageIds.push(imageId);
      }

      if (mode === "clean") {
        await Promise.all(
          imageIds.map((imageId) =>
            startEdit({
              imageId,
              cleanlinessLevel,
              targetOutput,
            })
          )
        );
      } else if (mode === "research") {
        await Promise.all(
          imageIds.map((imageId) =>
            startResearch({
              imageId,
              condition,
            })
          )
        );
      } else {
        await Promise.all([
          ...imageIds.map((imageId) =>
            startEdit({
              imageId,
              cleanlinessLevel,
              targetOutput,
            })
          ),
          ...imageIds.map((imageId) =>
            startResearch({
              imageId,
              condition,
            })
          ),
        ]);
      }
    } catch (error) {
      console.error("Failed to start processing:", error);
      setIsProcessing(false);
    }
  }, [
    uploadedImages,
    sessionId,
    createUpload,
    generateUploadUrl,
    addImage,
    startEdit,
    startResearch,
    cleanlinessLevel,
    targetOutput,
    mode,
    condition,
  ]);

  const handleReset = useCallback(() => {
    uploadedImages.forEach((img) => URL.revokeObjectURL(img.preview));
    setUploadedImages([]);
    setCurrentUploadId(null);
    setIsProcessing(false);
  }, [uploadedImages]);

  const allJobsComplete = jobs?.every(
    (job) => job.status === "succeeded" || job.status === "failed"
  );
  const allResearchComplete = researchJobs?.every(
    (job) => job.status === "succeeded" || job.status === "failed"
  );

  return (
    <div className="max-w-7xl mx-auto px-6 py-8">
      {!isProcessing ? (
        <div className="space-y-8 animate-fade-in">
          <div className="text-center space-y-3">
            <h2 className="text-3xl font-semibold tracking-tight">
              Clean, Research, and List Your Items
            </h2>
            <p className="text-[var(--color-text-muted)] max-w-xl mx-auto">
              Upload photos to clean them, research pricing, and generate a
              marketplace-ready listing.
            </p>
          </div>

          <UploadZone onFilesAdded={handleFilesAdded} />

          {uploadedImages.length > 0 && (
            <>
              <ImageGrid
                images={uploadedImages}
                onRemove={handleRemoveImage}
              />
              
              <Tabs
                value={mode}
                onValueChange={(value) =>
                  setMode(value as ProcessingMode)
                }
                className="space-y-4"
              >
                <div className="p-4 rounded-2xl bg-[var(--color-bg-elevated)] border border-[var(--color-border)] space-y-3">
                  <label className="text-sm font-medium text-[var(--color-text)]">
                    Workflow
                  </label>
                  <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="listing">Listing Workflow</TabsTrigger>
                    <TabsTrigger value="clean">Photo Cleaning</TabsTrigger>
                    <TabsTrigger value="research">Product Research</TabsTrigger>
                  </TabsList>
                </div>

                <TabsContent value="clean">
                  <OptionsPanel
                    cleanlinessLevel={cleanlinessLevel}
                    setCleanlinessLevel={setCleanlinessLevel}
                    targetOutput={targetOutput}
                    setTargetOutput={setTargetOutput}
                    onStart={handleStartProcessing}
                    imageCount={uploadedImages.length}
                  />
                </TabsContent>

                <TabsContent value="research">
                  <ResearchOptionsPanel
                    condition={condition}
                    setCondition={setCondition}
                    onStart={handleStartProcessing}
                    imageCount={uploadedImages.length}
                  />
                </TabsContent>

                <TabsContent value="listing">
                  <div className="space-y-4">
                    <OptionsPanel
                      cleanlinessLevel={cleanlinessLevel}
                      setCleanlinessLevel={setCleanlinessLevel}
                      targetOutput={targetOutput}
                      setTargetOutput={setTargetOutput}
                      onStart={handleStartProcessing}
                      imageCount={uploadedImages.length}
                      showStart={false}
                    />
                    <ResearchOptionsPanel
                      condition={condition}
                      setCondition={setCondition}
                      onStart={handleStartProcessing}
                      imageCount={uploadedImages.length}
                      showStart={false}
                    />
                    <button
                      onClick={handleStartProcessing}
                      className={cn(
                        "w-full py-4 px-6 rounded-xl font-semibold text-base transition-all duration-300",
                        "bg-gradient-to-r from-[var(--color-accent)] to-cyan-500",
                        "text-[var(--color-bg)] shadow-lg shadow-cyan-500/20",
                        "hover:shadow-xl hover:shadow-cyan-500/30 hover:scale-[1.01]",
                        "active:scale-[0.99]"
                      )}
                    >
                      Start Listing Workflow {uploadedImages.length}{" "}
                      {uploadedImages.length === 1 ? "Item" : "Items"}
                    </button>
                  </div>
                </TabsContent>
              </Tabs>
            </>
          )}
        </div>
      ) : (
        <>
          {mode === "clean" ? (
            <JobsPanel
              jobs={jobs ?? []}
              outputs={outputs ?? []}
              images={images ?? []}
              uploadedImages={uploadedImages}
              allComplete={allJobsComplete ?? false}
              onReset={handleReset}
            />
          ) : mode === "research" ? (
            <ResearchPanel
              researchJobs={researchJobs ?? []}
              images={images ?? []}
              uploadedImages={uploadedImages}
              allComplete={allResearchComplete ?? false}
              onReset={handleReset}
            />
          ) : (
            <div className="space-y-8">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-2xl font-semibold tracking-tight">
                    Listing Workflow
                  </h2>
                  <p className="text-sm text-[var(--color-text-muted)] mt-1">
                    Cleaning:{" "}
                    {jobs
                      ? jobs.filter((job) => job.status === "succeeded").length
                      : 0}
                    /{jobs ? jobs.length : 0} complete • Research:{" "}
                    {researchJobs
                      ? researchJobs.filter((job) => job.status === "succeeded")
                          .length
                      : 0}
                    /{researchJobs ? researchJobs.length : 0} complete
                  </p>
                </div>
                <button
                  onClick={handleReset}
                  className={cn(
                    "flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition-all",
                    "bg-[var(--color-bg-elevated)] border border-[var(--color-border)]",
                    "text-[var(--color-text-muted)] hover:text-[var(--color-text)]",
                    "hover:bg-[var(--color-bg-hover)]"
                  )}
                >
                  New Batch
                </button>
              </div>

              <JobsPanel
                jobs={jobs ?? []}
                outputs={outputs ?? []}
                images={images ?? []}
                uploadedImages={uploadedImages}
                allComplete={allJobsComplete ?? false}
                onReset={handleReset}
                showReset={false}
                title="Cleaning"
              />
              <ResearchPanel
                researchJobs={researchJobs ?? []}
                images={images ?? []}
                uploadedImages={uploadedImages}
                outputs={outputs ?? []}
                allComplete={allResearchComplete ?? false}
                onReset={handleReset}
                showReset={false}
                title="Listing Research"
              />
            </div>
          )}
        </>
      )}
    </div>
  );
}

async function getImageDimensions(file: File): Promise<{ width: number; height: number }> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
      URL.revokeObjectURL(img.src);
    };
    img.src = URL.createObjectURL(file);
  });
}
