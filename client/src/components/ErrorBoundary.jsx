import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex-1 flex flex-col items-center justify-center p-6 bg-slate-50 text-slate-800 min-h-[400px]">
          <div className="max-w-md w-full bg-white p-6 rounded-2xl border border-slate-200 shadow-lg text-center space-y-4">
            <div className="w-12 h-12 rounded-xl bg-red-100 text-red-600 mx-auto flex items-center justify-center">
              <AlertTriangle size={24} />
            </div>
            <h3 className="text-base font-black text-slate-900">Something went wrong</h3>
            <p className="text-xs text-slate-500">
              An unexpected error occurred while rendering this section.
            </p>
            {this.state.error?.message && (
              <pre className="p-2.5 bg-slate-100 rounded-xl text-[11px] font-mono text-slate-700 text-left overflow-x-auto">
                {this.state.error.message}
              </pre>
            )}
            <button
              onClick={this.handleReload}
              className="px-4 py-2 bg-slate-900 hover:bg-black text-white rounded-xl text-xs font-bold transition inline-flex items-center gap-2 cursor-pointer shadow-sm"
            >
              <RefreshCw size={13} />
              <span>Reload Section</span>
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
