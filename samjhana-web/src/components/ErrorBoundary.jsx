import { Component } from 'react';

/**
 * Keeps one broken part of the page from blanking the whole site: whatever throws below this
 * shows a short message instead, and everything outside it keeps working.
 */
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { failed: false };
  }

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error) {
    console.error('Section failed to render', error);
  }

  render() {
    if (this.state.failed) {
      return (
        <div role="alert" className="py-10 text-center font-sans text-sm text-dark/50">
          This section couldn&apos;t be shown right now. Please refresh the page or try again later.
        </div>
      );
    }
    return this.props.children;
  }
}
