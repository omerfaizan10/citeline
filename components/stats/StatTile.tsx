export default function StatTile({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-surface px-4 py-3.5">
      <div className="font-serif text-2xl text-foreground">{value}</div>
      <div className="mt-1 text-[0.7rem] uppercase tracking-[0.1em] text-muted-2">
        {label}
      </div>
    </div>
  );
}
