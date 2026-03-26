import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getSagraBySlug } from "@/lib/queries/sagre";
import { searchCityVideo } from "@/lib/pexels-video";
import SagraDetail from "@/components/detail/SagraDetail";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const sagra = await getSagraBySlug(slug);

  if (!sagra) {
    return { title: "Sagra non trovata" };
  }

  const description =
    sagra.enhanced_description ??
    `Scopri ${sagra.title} a ${sagra.location_text}`;

  return {
    title: sagra.title,
    description,
    openGraph: {
      title: sagra.title,
      description,
      type: "article",
    },
  };
}

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

  // Always fetch a themed video — videos are more engaging than static Unsplash images
  const videoUrl = await searchCityVideo(sagra.location_text, sagra.province, sagra.title, sagra.food_tags);

  return <SagraDetail sagra={sagra} videoUrl={videoUrl} />;
}
