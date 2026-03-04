export default function CercaPage() {
  return (
    <div className="space-y-6 pt-4">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Cerca sagre</h1>
        <p className="mt-1 text-muted-foreground">
          Filtra per provincia, tipo cucina, date e altro.
        </p>
      </div>

      <div className="h-12 rounded-lg bg-card border border-border" />

      <div className="space-y-4">
        <div className="h-48 rounded-lg bg-card border border-border animate-pulse" />
        <div className="h-48 rounded-lg bg-card border border-border animate-pulse" />
      </div>
    </div>
  );
}
