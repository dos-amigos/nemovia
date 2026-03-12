"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";

export default function BackButton() {
  const router = useRouter();

  return (
    <button
      onClick={() => (window.history.length > 1 ? router.back() : router.push("/"))}
      className="absolute left-3 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-background/85 backdrop-blur-[10px] border border-white/12 shadow-sm transition-colors hover:bg-background focus-visible:ring-[3px] focus-visible:ring-ring/50"
      aria-label="Torna indietro"
    >
      <ArrowLeft className="size-5" />
    </button>
  );
}
