import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './index.css';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('CRITICAL REACT RENDER ERROR:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 24, color: '#f87171', background: '#090d16', minHeight: '100vh', fontFamily: 'monospace' }}>
          <h2>React Render Error:</h2>
          <pre style={{ whiteSpace: 'pre-wrap', marginTop: 12, background: '#1e293b', padding: 16, borderRadius: 8, color: '#fca5a5' }}>
            {this.state.error?.stack || this.state.error?.message || String(this.state.error)}
          </pre>
          <button 
            style={{ marginTop: 16, padding: '8px 16px', background: '#4f46e5', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer' }}
            onClick={() => { localStorage.clear(); window.location.reload(); }}
          >
            Clear Cache & Reload
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
);
