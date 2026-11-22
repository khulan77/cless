/** Хуудас ачаалах үед: sidebar шууд харагдаж, контент stream хийгдэнэ */
export default function AdminLoading() {
  return (
    <div aria-busy="true" aria-live="polite" className="animate-pulse">
      <span className="sr-only">Ачаалж байна…</span>
      <div className="mb-6 h-7 w-48 rounded bg-navy/10" />
      <div className="mb-4 flex gap-2">
        <div className="h-9 w-64 rounded bg-navy/5" />
        <div className="h-9 w-40 rounded bg-navy/5" />
      </div>
      <div className="space-y-2 rounded-lg border border-line bg-white p-4">
        {Array.from({ length: 8 }, (_, i) => (
          <div key={i} className="h-8 rounded bg-navy/5" />
        ))}
      </div>
    </div>
  );
}
