import Link from "next/link";

export default function Forbidden() {
  return (
    <div className="grid min-h-dvh place-items-center px-4 text-center">
      <div>
        <p className="text-micro text-muted">403</p>
        <h1 className="text-section mt-2">Эрх хүрэлцэхгүй байна</h1>
        <p className="mt-3 text-muted">Энэ хуудсыг үзэх эрх танд байхгүй. Шаардлагатай бол админд хандана уу.</p>
        <Link href="/admin" className="link-underline mt-6 inline-block text-[14px]">
          Удирдлагын нүүр рүү буцах
        </Link>
      </div>
    </div>
  );
}
