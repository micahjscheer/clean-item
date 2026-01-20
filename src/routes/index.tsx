import { useState, useCallback } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { UploadZone } from "@/components/UploadZone";
import { ImageGrid } from "@/components/ImageGrid";
import { JobsPanel } from "@/components/JobsPanel";
import { OptionsPanel } from "@/components/OptionsPanel";
import { generateId } from "@/lib/utils";
import type { Id } from "../../convex/_generated/dataModel";

export type CleanlinessLevel = "light" | "standard" | "deep";
export type TargetOutput = "match" | "2k" | "4k";

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
  const [isProcessing, setIsProcessing] = useState(false);

  const createUpload = useMutation(api.uploads.createUpload);
  const addImage = useMutation(api.uploads.addImage);
  const generateUploadUrl = useMutation(api.uploads.generateUploadUrl);
  const startEdit = useMutation(api.jobs.startEdit);
  
  const jobs = useQuery(
    api.jobs.getJobsByUpload,
    currentUploadId ? { uploadId: currentUploadId } : "skip"
  );

  const outputs = useQuery(
    api.outputs.getOutputsByUpload,
    currentUploadId ? { uploadId: currentUploadId } : "skip"
  );

  const images = useQuery(
    api.uploads.getImagesByUpload,
    currentUploadId ? { uploadId: currentUploadId } : "skip"
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

      // Start edit jobs for all images in parallel
      await Promise.all(
        imageIds.map((imageId) =>
          startEdit({
            imageId,
            cleanlinessLevel,
            targetOutput,
          })
        )
      );
    } catch (error) {
      console.error("Failed to start processing:", error);
    }
  }, [uploadedImages, sessionId, createUpload, generateUploadUrl, addImage, startEdit, cleanlinessLevel, targetOutput]);

  const handleReset = useCallback(() => {
    uploadedImages.forEach((img) => URL.revokeObjectURL(img.preview));
    setUploadedImages([]);
    setCurrentUploadId(null);
    setIsProcessing(false);
  }, [uploadedImages]);

  const allJobsComplete = jobs?.every(
    (job) => job.status === "succeeded" || job.status === "failed"
  );

  return (
    <div className="max-w-7xl mx-auto px-6 py-8">
      {!isProcessing ? (
        <div className="space-y-8 animate-fade-in">
          <div className="text-center space-y-3">
            <h2 className="text-3xl font-semibold tracking-tight">
              Clean Your Photos
            </h2>
            <p className="text-[var(--color-text-muted)] max-w-xl mx-auto">
              Upload photos and our AI will remove dust, dirt, and smudges while
              preserving every detail, defect, and the exact composition.
            </p>
          </div>

          <UploadZone onFilesAdded={handleFilesAdded} />

          {uploadedImages.length > 0 && (
            <>
              <ImageGrid
                images={uploadedImages}
                onRemove={handleRemoveImage}
              />
              
              <OptionsPanel
                cleanlinessLevel={cleanlinessLevel}
                setCleanlinessLevel={setCleanlinessLevel}
                targetOutput={targetOutput}
                setTargetOutput={setTargetOutput}
                onStart={handleStartProcessing}
                imageCount={uploadedImages.length}
              />
            </>
          )}
        </div>
      ) : (
        <JobsPanel
          jobs={jobs ?? []}
          outputs={outputs ?? []}
          images={images ?? []}
          uploadedImages={uploadedImages}
          allComplete={allJobsComplete ?? false}
          onReset={handleReset}
        />
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
