import { getWeekendSagre, getProvinceCounts } from "@/lib/queries/sagre";
import { HeroSection } from "@/components/home/HeroSection";
import { WeekendSection } from "@/components/home/WeekendSection";
import { QuickFilters } from "@/components/home/QuickFilters";
import { ProvinceSection } from "@/components/home/ProvinceSection";

export default async function HomePage() {
  const [weekendSagre, provinceCounts] = await Promise.all([
    getWeekendSagre(),
    getProvinceCounts(),
  ]);

  return (
    <div className="space-y-8">
      <HeroSection />
      <QuickFilters />
      <WeekendSection sagre={weekendSagre} />
      <ProvinceSection counts={provinceCounts} />
    </div>
  );
}
