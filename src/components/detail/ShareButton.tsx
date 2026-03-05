"use client";

import { useState } from "react";
import { Share2, Check } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function ShareButton() {
  const [copied, setCopied] = useState(false);

  async function handleShare() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback to Web Share API on mobile
      if (navigator.share) {
        await navigator.share({ url: window.location.href });
      }
    }
  }

  return (
    <Button variant="outline" onClick={handleShare} className="gap-2">
      {copied ? (
        <>
          <Check className="size-4" />
          Copiato!
        </>
      ) : (
        <>
          <Share2 className="size-4" />
          Condividi
        </>
      )}
    </Button>
  );
}
