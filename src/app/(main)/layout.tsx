import { BottomNav } from "@/components/layout/BottomNav";

export default function MainLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="min-h-screen bg-background pb-20">
      <main className="mx-auto max-w-7xl px-4 py-4">{children}</main>
      <BottomNav />
    </div>
  );
}
