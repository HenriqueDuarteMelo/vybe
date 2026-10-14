import { Link } from "react-router-dom";
import { Music, Home } from "lucide-react";

export function NotFoundPage() {
  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center px-4 text-center relative overflow-hidden">
      <div className="absolute -top-40 -right-40 w-96 h-96 bg-vybe-600/20 rounded-full blur-3xl" />
      <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-vybe-500/10 rounded-full blur-3xl" />

      <div className="relative">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-vybe-600 glow-vybe mb-6">
          <Music className="w-8 h-8 text-white" />
        </div>
        <p className="text-7xl font-extrabold text-gradient mb-4">404</p>
        <h1 className="text-2xl font-bold mb-2">Page not found</h1>
        <p className="text-gray-400 mb-6">
          The page you're looking for doesn't exist or has moved.
        </p>
        <Link
          to="/"
          className="inline-flex items-center gap-2 bg-vybe-600 hover:bg-vybe-500 text-white font-medium rounded-full px-6 py-3 transition-colors glow-vybe"
        >
          <Home className="w-4 h-4" />
          Back to Home
        </Link>
      </div>
    </div>
  );
}
