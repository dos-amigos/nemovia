import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Admin | Nemovia",
  robots: "noindex, nofollow",
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-muted/30">
      {children}
    </div>
  );
}
