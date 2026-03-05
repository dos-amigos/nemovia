"use client";

import dynamic from "next/dynamic";

const DetailMiniMapDynamic = dynamic(() => import("./DetailMiniMap"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center rounded-lg bg-muted">
      <p className="text-sm text-muted-foreground">Caricamento mappa...</p>
    </div>
  ),
});

export default DetailMiniMapDynamic;
