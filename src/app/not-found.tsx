import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-base-200">
      <div className="text-center space-y-4 p-8">
        <p className="text-6xl font-bold text-base-content/20">404</p>
        <h2 className="text-xl font-bold text-base-content">Page not found</h2>
        <p className="text-base-content/50 text-sm">The page you are looking for does not exist.</p>
        <Link href="/map" className="btn btn-primary">
          Go to Map
        </Link>
      </div>
    </div>
  );
}
