import { notFound } from "next/navigation";
import { getSagraBySlug } from "@/lib/queries/sagre";
import SagraDetail from "@/components/detail/SagraDetail";

export default async function SagraDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const sagra = await getSagraBySlug(slug);

  if (!sagra) {
    notFound();
  }

  return <SagraDetail sagra={sagra} />;
}
