import { Component, type ReactNode } from "react";
import { Music, RefreshCw } from "lucide-react";

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center px-4 text-center relative overflow-hidden">
          <div className="absolute -top-40 -left-40 w-96 h-96 bg-vybe-600/20 rounded-full blur-3xl" />
          <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-vybe-500/10 rounded-full blur-3xl" />

          <div className="relative">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-vybe-600 glow-vybe mb-6">
              <Music className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-3xl font-bold mb-2">
              Something went <span className="text-gradient">wrong</span>
            </h1>
            <p className="text-gray-400 mb-6 max-w-md">
              The app hit an unexpected error. Reloading usually fixes it.
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="inline-flex items-center gap-2 bg-vybe-600 hover:bg-vybe-500 text-white font-medium rounded-full px-6 py-3 transition-colors glow-vybe"
            >
              <RefreshCw className="w-4 h-4" />
              Reload
            </button>
            {import.meta.env.DEV && (
              <p className="mt-6 text-xs text-gray-500 font-mono max-w-lg break-all">
                {this.state.error.message}
              </p>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
