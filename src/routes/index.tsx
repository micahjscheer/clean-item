import { useCallback, useEffect, useMemo, useReducer, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import JSZip from "jszip";
import { saveAs } from "file-saver";
import { ConfigureStep } from "@/components/wizard/ConfigureStep";
import { ErrorBanner } from "@/components/shared/ErrorBanner";
import { ProcessingStep } from "@/components/wizard/ProcessingStep";
import { ResultsStep } from "@/components/wizard/ResultsStep";
import { UploadStep } from "@/components/wizard/UploadStep";
import { WizardShell, type WizardStep } from "@/components/wizard/WizardShell";
import { generateId } from "@/lib/utils";
import {
  cleanlinessSchema,
  conditionSchema,
  targetOutputSchema,
  workflowSchema,
} from "@/lib/workflowSchemas";
import type { Doc, Id } from "../../convex/_generated/dataModel";

export interface UploadedImage {
  file: File;
  preview: string;
  id: string;
}

type Job = Doc<"jobs">;
type ResearchJob = Doc<"productResearch">;
type ImageWithUrl = Doc<"images"> & { url: string | null };
type Output = Doc<"outputs"> & { url: string | null; imageId: Id<"images"> };

interface WizardState {
  step: WizardStep;
  uploadedImages: UploadedImage[];
  mode: "listing" | "clean" | "research";
  cleanlinessLevel: "light" | "standard" | "deep";
  targetOutput: "match" | "2k" | "4k";
  condition: "new" | "like_new" | "good" | "fair" | "poor";
  currentUploadId: Id<"uploads"> | null;
  selectedDetailId: Id<"images"> | null;
}

type WizardAction =
  | { type: "addImages"; images: UploadedImage[] }
  | { type: "removeImage"; id: string }
  | { type: "goToStep"; step: WizardStep }
  | { type: "setMode"; mode: WizardState["mode"] }
  | { type: "setCleanlinessLevel"; cleanlinessLevel: WizardState["cleanlinessLevel"] }
  | { type: "setTargetOutput"; targetOutput: WizardState["targetOutput"] }
  | { type: "setCondition"; condition: WizardState["condition"] }
  | { type: "setUploadId"; uploadId: Id<"uploads"> }
  | { type: "setSelectedDetail"; imageId: Id<"images"> | null }
  | { type: "resetAll" };

const initialState: WizardState = {
  step: "upload",
  uploadedImages: [],
  mode: workflowSchema.parse("listing"),
  cleanlinessLevel: cleanlinessSchema.parse("standard"),
  targetOutput: targetOutputSchema.parse("match"),
  condition: conditionSchema.parse("good"),
  currentUploadId: null,
  selectedDetailId: null,
};

function wizardReducer(state: WizardState, action: WizardAction): WizardState {
  if (action.type === "addImages") {
    return { ...state, uploadedImages: [...state.uploadedImages, ...action.images] };
  }
  if (action.type === "removeImage") {
    return {
      ...state,
      uploadedImages: state.uploadedImages.filter((image) => image.id !== action.id),
    };
  }
  if (action.type === "goToStep") {
    return { ...state, step: action.step };
  }
  if (action.type === "setMode") {
    return { ...state, mode: action.mode };
  }
  if (action.type === "setCleanlinessLevel") {
    return { ...state, cleanlinessLevel: action.cleanlinessLevel };
  }
  if (action.type === "setTargetOutput") {
    return { ...state, targetOutput: action.targetOutput };
  }
  if (action.type === "setCondition") {
    return { ...state, condition: action.condition };
  }
  if (action.type === "setUploadId") {
    return { ...state, currentUploadId: action.uploadId };
  }
  if (action.type === "setSelectedDetail") {
    return { ...state, selectedDetailId: action.imageId };
  }
  if (action.type === "resetAll") {
    return { ...initialState };
  }
  return state;
}

export function IndexPage() {
  const [sessionId] = useState(() => generateId());
  const [state, dispatch] = useReducer(wizardReducer, initialState);
  const [isStarting, setIsStarting] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [processingError, setProcessingError] = useState<string | null>(null);
  const [uploadProgressByImageId, setUploadProgressByImageId] = useState<Record<string, number>>(
    {}
  );

  const createUpload = useMutation(api.uploads.createUpload);
  const addImage = useMutation(api.uploads.addImage);
  const generateUploadUrl = useMutation(api.uploads.generateUploadUrl);
  const startEdit = useMutation(api.jobs.startEdit);
  const startResearch = useMutation(api.research.startResearch);
  const startListingWorkflow = useMutation(
    api.workflows.startListingWorkflow
  );

  const jobs = useQuery(
    api.jobs.getJobsByUpload,
    (state.mode === "clean" || state.mode === "listing") && state.currentUploadId
      ? { uploadId: state.currentUploadId }
      : "skip"
  );

  const outputs = useQuery(
    api.outputs.getOutputsByUpload,
    (state.mode === "clean" || state.mode === "listing") && state.currentUploadId
      ? { uploadId: state.currentUploadId }
      : "skip"
  );

  const images = useQuery(
    api.uploads.getImagesByUpload,
    state.currentUploadId ? { uploadId: state.currentUploadId } : "skip"
  );

  const researchJobs = useQuery(
    api.research.getResearchByUpload,
    (state.mode === "research" || state.mode === "listing") && state.currentUploadId
      ? { uploadId: state.currentUploadId }
      : "skip"
  );

  const handleFilesAdded = useCallback((files: File[]) => {
    setValidationError(null);
    const newImages = files.map((file) => ({
      file,
      preview: URL.createObjectURL(file),
      id: generateId(),
    }));
    dispatch({ type: "addImages", images: newImages });
  }, []);

  const handleRemoveImage = useCallback((id: string) => {
    const image = state.uploadedImages.find((item) => item.id === id);
    if (image) {
      URL.revokeObjectURL(image.preview);
    }
    dispatch({ type: "removeImage", id });
  }, [state.uploadedImages]);

  const handleStartProcessing = useCallback(async () => {
    if (state.uploadedImages.length === 0) return;
    setIsStarting(true);
    setProcessingError(null);
    try {
      const uploadId = await createUpload({
        clientSessionId: sessionId,
      });
      dispatch({ type: "setUploadId", uploadId });
      dispatch({ type: "goToStep", step: "processing" });

      const imageIds = await Promise.all(
        state.uploadedImages.map(async (img) => {
          setUploadProgressByImageId((previous) => ({ ...previous, [img.id]: 10 }));
          const uploadUrl = await generateUploadUrl();

          const response = await fetch(uploadUrl, {
            method: "POST",
            headers: { "Content-Type": img.file.type },
            body: img.file,
          });

          const responseJson = await response.json();
          if (!response.ok || !responseJson.storageId) {
            throw new Error("Failed to upload one or more files.");
          }
          const storageId = responseJson.storageId;
          const dimensions = await getImageDimensions(img.file);
          setUploadProgressByImageId((previous) => ({ ...previous, [img.id]: 100 }));

          return addImage({
            uploadId,
            storageId,
            width: dimensions.width,
            height: dimensions.height,
            mimeType: img.file.type,
            fileName: img.file.name,
          });
        })
      );

      if (state.mode === "clean") {
        await Promise.all(
          imageIds.map((imageId) =>
            startEdit({
              imageId,
              cleanlinessLevel: state.cleanlinessLevel,
              targetOutput: state.targetOutput,
            })
          )
        );
      } else if (state.mode === "research") {
        await Promise.all(
          imageIds.map((imageId) =>
            startResearch({
              imageId,
              condition: state.condition,
            })
          )
        );
      } else {
        await startListingWorkflow({
          imageIds,
          cleanlinessLevel: state.cleanlinessLevel,
          targetOutput: state.targetOutput,
          condition: state.condition,
        });
      }
    } catch (error) {
      setProcessingError("Processing could not start. Please try again.");
      dispatch({ type: "goToStep", step: "configure" });
    } finally {
      setIsStarting(false);
    }
  }, [
    state.uploadedImages,
    state.mode,
    state.cleanlinessLevel,
    state.targetOutput,
    state.condition,
    sessionId,
    createUpload,
    generateUploadUrl,
    addImage,
    startEdit,
    startResearch,
    startListingWorkflow,
  ]);

  const handleReset = useCallback(() => {
    state.uploadedImages.forEach((image) => URL.revokeObjectURL(image.preview));
    setValidationError(null);
    setProcessingError(null);
    setUploadProgressByImageId({});
    dispatch({ type: "resetAll" });
  }, [state.uploadedImages]);

  useEffect(() => {
    return () => {
      state.uploadedImages.forEach((image) => URL.revokeObjectURL(image.preview));
    };
  }, [state.uploadedImages]);

  const typedJobs: Job[] = jobs ?? [];
  const typedResearchJobs: ResearchJob[] = researchJobs ?? [];
  const typedOutputs: Output[] = outputs ?? [];
  const typedImages: ImageWithUrl[] = images ?? [];

  const wizardTitleMap: Record<WizardStep, string> = {
    upload: "Upload Item Photos",
    configure: "Configure Your Workflow",
    processing: "Processing Your Items",
    results: "Review and Download Results",
  };

  const wizardDescriptionMap: Record<WizardStep, string> = {
    upload: "Drag and drop photos to begin. You can add multiple images in one batch.",
    configure: "Choose whether to clean photos, run research, or run the full listing workflow.",
    processing: "Watch real-time progress while we upload, clean, and research your items.",
    results: "Inspect outputs, open detailed views, and download your final deliverables.",
  };

  const canOpenResults = useMemo(() => {
    if (state.mode === "clean") {
      return typedJobs.length > 0 && typedJobs.every((job) => job.status === "succeeded" || job.status === "failed");
    }
    if (state.mode === "research") {
      return (
        typedResearchJobs.length > 0 &&
        typedResearchJobs.every((job) => job.status === "succeeded" || job.status === "failed")
      );
    }
    return (
      typedJobs.length > 0 &&
      typedResearchJobs.length > 0 &&
      typedJobs.every((job) => job.status === "succeeded" || job.status === "failed") &&
      typedResearchJobs.every((job) => job.status === "succeeded" || job.status === "failed")
    );
  }, [state.mode, typedJobs, typedResearchJobs]);

  const handleDownloadAll = useCallback(async () => {
    if (typedOutputs.length === 0) return;
    const zip = new JSZip();
    await Promise.all(
      typedOutputs.map(async (output) => {
        if (!output.url) return;
        const response = await fetch(output.url);
        const blob = await response.blob();
        const image = typedImages.find((item) => item._id === output.imageId);
        const fileName = image ? image.fileName : `${output.imageId}.jpg`;
        zip.file(`cleaned-${fileName}`, blob);
      })
    );
    const zipBlob = await zip.generateAsync({ type: "blob" });
    saveAs(zipBlob, `cleaned-results-${Date.now()}.zip`);
  }, [typedImages, typedOutputs]);

  const handleDownloadSingle = useCallback(
    async (output: Output) => {
      if (!output.url) return;
      const response = await fetch(output.url);
      const blob = await response.blob();
      const image = typedImages.find((item) => item._id === output.imageId);
      const fileName = image ? image.fileName : `${output.imageId}.jpg`;
      saveAs(blob, `cleaned-${fileName}`);
    },
    [typedImages]
  );

  return (
    <WizardShell
      currentStep={state.step}
      title={wizardTitleMap[state.step]}
      description={wizardDescriptionMap[state.step]}
    >
      {processingError ? <ErrorBanner message={processingError} className="mb-4" /> : null}

      {state.step === "upload" ? (
        <UploadStep
          images={state.uploadedImages}
          onFilesAdded={handleFilesAdded}
          onValidationChange={setValidationError}
          onRemoveImage={handleRemoveImage}
          validationError={validationError}
          onNext={() => dispatch({ type: "goToStep", step: "configure" })}
        />
      ) : null}

      {state.step === "configure" ? (
        <ConfigureStep
          mode={state.mode}
          cleanlinessLevel={state.cleanlinessLevel}
          targetOutput={state.targetOutput}
          condition={state.condition}
          imageCount={state.uploadedImages.length}
          isStarting={isStarting}
          onModeChange={(mode) => dispatch({ type: "setMode", mode })}
          onCleanlinessChange={(cleanlinessLevel) =>
            dispatch({ type: "setCleanlinessLevel", cleanlinessLevel })
          }
          onTargetOutputChange={(targetOutput) =>
            dispatch({ type: "setTargetOutput", targetOutput })
          }
          onConditionChange={(condition) => dispatch({ type: "setCondition", condition })}
          onBack={() => dispatch({ type: "goToStep", step: "upload" })}
          onStart={handleStartProcessing}
        />
      ) : null}

      {state.step === "processing" ? (
        <ProcessingStep
          mode={state.mode}
          uploadProgressByImageId={uploadProgressByImageId}
          images={typedImages}
          jobs={typedJobs}
          researchJobs={typedResearchJobs}
          outputs={typedOutputs}
          onSelectImage={(imageId) => dispatch({ type: "setSelectedDetail", imageId })}
          onComplete={() => dispatch({ type: "goToStep", step: "results" })}
        />
      ) : null}

      {state.step === "results" && canOpenResults ? (
        <ResultsStep
          mode={state.mode}
          images={typedImages}
          jobs={typedJobs}
          researchJobs={typedResearchJobs}
          outputs={typedOutputs}
          selectedDetailId={state.selectedDetailId}
          onSelectDetail={(id) => dispatch({ type: "setSelectedDetail", imageId: id })}
          onDownloadAll={handleDownloadAll}
          onDownloadSingle={handleDownloadSingle}
          onReset={handleReset}
        />
      ) : null}
    </WizardShell>
  );
}

async function getImageDimensions(file: File) {
  return new Promise<{ width: number; height: number }>((resolve) => {
    const img = new Image();
    img.onload = () => {
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
      URL.revokeObjectURL(img.src);
    };
    img.src = URL.createObjectURL(file);
  });
}
