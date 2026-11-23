/** Хуудас ачаалах үед: sidebar шууд харагдаж, контентын оронд skeleton */
export default function AdminLoading() {
  return (
    <div aria-busy="true" aria-live="polite" className="animate-pulse motion-reduce:animate-none">
      <span className="sr-only">Ачаалж байна…</span>
      <div className="mb-2 h-9 w-64 rounded-xl bg-ink/[0.07]" />
      <div className="mb-8 h-5 w-96 max-w-full rounded-xl bg-ink/[0.05]" />
      <div className="mb-6 flex gap-3">
        <div className="h-11 w-64 rounded-full bg-ink/[0.05]" />
        <div className="h-11 w-40 rounded-xl bg-ink/[0.05]" />
      </div>
      <div className="space-y-2">
        {Array.from({ length: 7 }, (_, i) => (
          <div key={i} className="h-[72px] rounded-2xl border border-hairline bg-white" />
        ))}
      </div>
    </div>
  );
}
