export default function HomePage() {
  return (
    <div className="space-y-6 pt-4">
      <div>
        <h1 className="text-2xl font-bold text-foreground">
          Scopri le sagre del Veneto
        </h1>
        <p className="mt-1 text-muted-foreground">
          Trova sagre ed eventi gastronomici nella tua zona.
        </p>
      </div>

      <div className="space-y-4">
        <div className="h-48 rounded-lg bg-card border border-border animate-pulse" />
        <div className="h-48 rounded-lg bg-card border border-border animate-pulse" />
        <div className="h-48 rounded-lg bg-card border border-border animate-pulse" />
      </div>
    </div>
  );
}
