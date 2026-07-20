import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.jsx'

class ErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { error: null }; }
  static getDerivedStateFromError(e) { return { error: e }; }
  render() {
    if (this.state.error) {
      return (
        <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: '#F7F2FA', fontFamily: 'system-ui,sans-serif', padding: 24 }}>
          <div style={{ background: '#fff', borderRadius: 16, padding: '32px 28px', maxWidth: 520, width: '100%', boxShadow: '0 8px 32px rgba(0,0,0,.08)' }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>⚠️</div>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: '#1A0A1C', margin: '0 0 8px' }}>Error en la aplicación</h2>
            <p style={{ fontSize: 13, color: '#5E4E64', margin: '0 0 16px', lineHeight: 1.5 }}>
              Ocurrió un error inesperado. Por favor compartí este mensaje con el equipo de soporte.
            </p>
            <pre style={{ background: '#F7F2FA', borderRadius: 8, padding: '12px 14px', fontSize: 12, color: '#73017B', overflow: 'auto', maxHeight: 200, margin: '0 0 16px', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
              {this.state.error?.message}
              {'\n\n'}
              {this.state.error?.stack}
            </pre>
            <button onClick={() => window.location.reload()} style={{ padding: '9px 20px', background: '#73017B', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 13.5, cursor: 'pointer' }}>
              Recargar
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </BrowserRouter>
  </React.StrictMode>
)
