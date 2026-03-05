import { getMapSagre } from "@/lib/queries/sagre";
import MappaClientPage from "./MappaClientPage";

export default async function MappaPage() {
  const sagre = await getMapSagre();

  return <MappaClientPage sagre={sagre} />;
}
