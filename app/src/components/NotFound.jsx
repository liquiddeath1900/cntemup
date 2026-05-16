import { Link } from 'react-router-dom'

export function NotFound() {
  return (
    <div className="app">
      <div className="gb-label">
        <h1>CNTEM'UP</h1>
        <p>Bottle & Can Counter</p>
      </div>

      <div className="gb-screen-bezel">
        <div className="gb-screen" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '24px 16px', gap: '16px' }}>
          <p style={{ fontFamily: "'Press Start 2P', monospace", fontSize: '24px', color: 'var(--gb-dark)' }}>ERROR 404</p>
          <p style={{ fontFamily: "'Press Start 2P', monospace", fontSize: '10px', lineHeight: '1.8', color: 'var(--gb-dark)' }}>
            NO BOTTLE FOUND<br />AT THIS ADDRESS
          </p>
        </div>
      </div>

      <div className="gb-controls">
        <div className="gb-action-row">
          <Link to="/" className="gb-action-btn" style={{ textDecoration: 'none' }}>GO HOME</Link>
          <Link to="/app" className="gb-action-btn" style={{ textDecoration: 'none' }}>START COUNTING</Link>
        </div>
      </div>

      <footer className="gb-footer">
        <p>That route doesn't exist</p>
      </footer>
    </div>
  )
}
