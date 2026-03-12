"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import Image, { type ImageProps } from "next/image";
import { cn } from "@/lib/utils";

interface FadeImageProps extends ImageProps {
  /** Optional fallback src to use when the primary image fails to load */
  fallbackSrc?: string;
}

export function FadeImage({ className, fallbackSrc, src, ...props }: FadeImageProps) {
  const [loaded, setLoaded] = useState(false);
  const [currentSrc, setCurrentSrc] = useState(src);
  const [hasErrored, setHasErrored] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);

  // Handle cached images that may not fire onLoad
  useEffect(() => {
    if (imgRef.current?.complete && !imgRef.current?.naturalWidth) {
      // Image loaded but has 0 natural width = broken image
      if (fallbackSrc && !hasErrored) {
        setCurrentSrc(fallbackSrc);
        setHasErrored(true);
      }
    } else if (imgRef.current?.complete) {
      setLoaded(true);
    }
  }, [fallbackSrc, hasErrored]);

  // Reset state when src changes (e.g., navigating between sagre)
  useEffect(() => {
    setCurrentSrc(src);
    setHasErrored(false);
    setLoaded(false);
  }, [src]);

  const handleError = useCallback(() => {
    if (fallbackSrc && !hasErrored) {
      setCurrentSrc(fallbackSrc);
      setHasErrored(true);
      setLoaded(false);
    }
  }, [fallbackSrc, hasErrored]);

  return (
    // eslint-disable-next-line jsx-a11y/alt-text -- alt is passed via spread props (required by ImageProps)
    <Image
      {...props}
      src={currentSrc}
      ref={imgRef}
      draggable={false}
      className={cn(
        "transition-opacity duration-500 ease-in-out",
        loaded ? "opacity-100" : "opacity-0",
        className
      )}
      onLoad={() => setLoaded(true)}
      onError={handleError}
    />
  );
}
