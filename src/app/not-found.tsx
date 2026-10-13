import Link from "next/link";

export default function NotFound() {
  return (
    <div className="grid min-h-[60vh] place-items-center text-center">
      <div>
        <p className="font-display text-7xl font-bold text-gradient">404</p>
        <p className="mt-2 text-sm text-muted">This trail went cold. The page you were hunting for does not exist.</p>
        <Link href="/" className="mt-5 inline-flex h-10 items-center rounded-xl bg-brand-gradient px-4 text-sm font-medium text-white">
          Back to dashboard
        </Link>
      </div>
    </div>
  );
}
