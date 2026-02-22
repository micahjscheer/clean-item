import { useState, useRef, useCallback } from "react";

interface BeforeAfterViewerProps {
  beforeUrl: string;
  afterUrl: string;
}

export function BeforeAfterViewer({ beforeUrl, afterUrl }: BeforeAfterViewerProps) {
  const [sliderPosition, setSliderPosition] = useState(50);
  const containerRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);

  const handleMove = useCallback((clientX: number) => {
    if (!containerRef.current) return;
    
    const rect = containerRef.current.getBoundingClientRect();
    const x = clientX - rect.left;
    const percentage = Math.max(0, Math.min(100, (x / rect.width) * 100));
    setSliderPosition(percentage);
  }, []);

  const handleMouseDown = useCallback(() => {
    isDragging.current = true;
  }, []);

  const handleMouseUp = useCallback(() => {
    isDragging.current = false;
  }, []);

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (isDragging.current) {
        handleMove(e.clientX);
      }
    },
    [handleMove]
  );

  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (!isDragging.current) return;
      handleMove(e.touches[0].clientX);
    },
    [handleMove]
  );

  const handleTouchStart = useCallback(
    (e: React.TouchEvent) => {
      isDragging.current = true;
      handleMove(e.touches[0].clientX);
    },
    [handleMove]
  );

  const handleTouchEnd = useCallback(() => {
    isDragging.current = false;
  }, []);

  const handleKeyDown = useCallback((event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      setSliderPosition((previous) => Math.max(0, previous - 2));
    }
    if (event.key === "ArrowRight") {
      event.preventDefault();
      setSliderPosition((previous) => Math.min(100, previous + 2));
    }
    if (event.key === "Home") {
      event.preventDefault();
      setSliderPosition(0);
    }
    if (event.key === "End") {
      event.preventDefault();
      setSliderPosition(100);
    }
  }, []);

  return (
    <div
      ref={containerRef}
      role="slider"
      tabIndex={0}
      aria-label="Before and after slider"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(sliderPosition)}
      className="relative w-full aspect-video rounded-xl overflow-hidden cursor-ew-resize select-none"
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onMouseMove={handleMouseMove}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onClick={(e) => handleMove(e.clientX)}
      onKeyDown={handleKeyDown}
    >
      {/* After image (full) */}
      <img
        src={afterUrl}
        alt="After cleaning"
        className="absolute inset-0 w-full h-full object-contain bg-[var(--color-bg)]"
        draggable={false}
      />

      {/* Before image (clipped) */}
      <div
        className="absolute inset-0 overflow-hidden"
        style={{ width: `${sliderPosition}%` }}
      >
        <img
          src={beforeUrl}
          alt="Before cleaning"
          className="absolute inset-0 w-full h-full object-contain bg-[var(--color-bg)]"
          style={{
            width: containerRef.current ? `${containerRef.current.offsetWidth}px` : "100%",
            maxWidth: "none",
          }}
          draggable={false}
        />
      </div>

      {/* Slider line */}
      <div
        className="absolute top-0 bottom-0 w-0.5 bg-white shadow-lg"
        style={{ left: `${sliderPosition}%`, transform: "translateX(-50%)" }}
      >
        {/* Slider handle */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white shadow-xl flex items-center justify-center">
          <div className="flex items-center gap-0.5">
            <div className="w-0.5 h-4 bg-[var(--color-bg)] rounded-full" />
            <div className="w-0.5 h-4 bg-[var(--color-bg)] rounded-full" />
          </div>
        </div>
      </div>

      {/* Labels */}
      <div className="absolute top-4 left-4 px-3 py-1.5 rounded-lg bg-black/60 backdrop-blur-sm">
        <span className="text-xs font-medium text-white">Before</span>
      </div>
      <div className="absolute top-4 right-4 px-3 py-1.5 rounded-lg bg-black/60 backdrop-blur-sm">
        <span className="text-xs font-medium text-white">After</span>
      </div>
    </div>
  );
}
