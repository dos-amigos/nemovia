import type { Metadata } from "next";
import { getMapSagre } from "@/lib/queries/sagre";
import MappaClientPage from "./MappaClientPage";

export const metadata: Metadata = {
  title: "Mappa sagre",
  description:
    "Scopri tutte le sagre del Veneto sulla mappa interattiva",
};

export default async function MappaPage() {
  const sagre = await getMapSagre();

  return <MappaClientPage sagre={sagre} />;
}
