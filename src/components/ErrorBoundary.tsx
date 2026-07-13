import React from 'react';

interface Props {
    children: React.ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
        console.error('React error boundary caught an error:', error, errorInfo);
    }

    render() {
        if (this.state.hasError) {
            return (
                <div className="flex h-screen items-center justify-center bg-red-900 p-8">
                    <div className="max-w-md text-center">
                        <h1 className="text-2xl font-bold text-white mb-4">Something went wrong</h1>
                        <p className="text-gray-300 mb-4">
                            The application encountered an unexpected error. Please restart the application.
                        </p>
                        <button
                            onClick={() => window.location.reload()}
                            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-500"
                        >
                            Restart Application
                        </button>
                        <details className="mt-4 text-left">
                            <summary className="text-gray-400 cursor-pointer">Technical details</summary>
                            <pre className="mt-2 p-4 bg-black/50 rounded text-red-400 text-xs overflow-auto">
                                {this.state.error?.message}
                                {this.state.error?.stack}
                            </pre>
                        </details>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}