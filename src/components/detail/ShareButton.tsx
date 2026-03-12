"use client";

import { useState } from "react";
import * as m from "motion/react-m";
import { Share2, Check } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function ShareButton() {
  const [copied, setCopied] = useState(false);

  async function handleShare() {
    // Prefer native share on mobile (shows share sheet with apps)
    if (navigator.share) {
      try {
        await navigator.share({ url: window.location.href });
        return;
      } catch {
        // User cancelled or share failed — fall through to clipboard
      }
    }
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard also failed — nothing we can do
    }
  }

  return (
    <m.div
      whileTap={{ scale: 0.95 }}
      transition={{ type: "spring", stiffness: 400, damping: 25 }}
    >
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
    </m.div>
  );
}
