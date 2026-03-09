"use client";

import { useState, useRef, useEffect } from "react";
import Image, { type ImageProps } from "next/image";
import { cn } from "@/lib/utils";

export function FadeImage({ className, ...props }: ImageProps) {
  const [loaded, setLoaded] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);

  // Handle cached images that may not fire onLoad
  useEffect(() => {
    if (imgRef.current?.complete) {
      setLoaded(true);
    }
  }, []);

  return (
    // eslint-disable-next-line jsx-a11y/alt-text -- alt is passed via spread props (required by ImageProps)
    <Image
      {...props}
      ref={imgRef}
      className={cn(
        "transition-opacity duration-500 ease-in-out",
        loaded ? "opacity-100" : "opacity-0",
        className
      )}
      onLoad={() => setLoaded(true)}
    />
  );
}
