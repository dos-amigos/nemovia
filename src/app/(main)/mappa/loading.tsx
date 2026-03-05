import { Skeleton } from "@/components/ui/skeleton";

export default function MappaLoading() {
  return (
    <Skeleton
      className="w-full rounded-lg"
      style={{ height: "calc(100vh - 10rem)" }}
    />
  );
}
