import React from "react";

export class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }

    componentDidCatch(error, errorInfo) {
        console.error("ErrorBoundary:", error, errorInfo);
    }

    render() {
        if (this.state.hasError) {
            return (
                <div className="flex min-h-screen flex-col items-center justify-center bg-lightPrimary p-6 dark:bg-navy-900">
                    <h1 className="mb-2 text-xl font-bold text-navy-800 dark:text-white">Something went wrong</h1>
                    <p className="mb-4 max-w-md text-center text-gray-600 dark:text-gray-300">
                        The app hit an unexpected error. Try refreshing the page.
                    </p>
                    <button
                        type="button"
                        onClick={() => window.location.reload()}
                        className="rounded-lg bg-brand-500 px-4 py-2 text-white hover:bg-brand-600"
                    >
                        Refresh
                    </button>
                </div>
            );
        }
        return this.props.children;
    }
}

export default ErrorBoundary;
