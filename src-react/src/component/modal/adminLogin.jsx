import { useState } from 'react';
import { createPortal } from 'react-dom';
import { useCassa } from '../../store/CassaContext';

function AdminLogin({ onClose, onLoginSuccess }) {
  const { login } = useCassa();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (login(username, password)) {
      setError('');
      onLoginSuccess();
    } else {
      setError('Credenziali non valide. Riprova.');
    }
  };

  return createPortal(
    <div
      id="adminLoginOverlay"
      className="show"
      style={{ display: 'flex', position: 'fixed', inset: 0, zIndex: 9999, alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.55)' }}
    >
      <div className="login-card">
        <h3>Accesso amministratore</h3>
        <form onSubmit={handleSubmit}>
          <label htmlFor="loginUser">Utente</label>
          <input
            type="text"
            id="loginUser"
            autoComplete="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoFocus
          />

          <label htmlFor="loginPass">Password</label>
          <input
            type="password"
            id="loginPass"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />

          <div className="login-err" id="loginErr" style={{ color: '#ff4d4d', marginTop: '8px' }}>
            {error}
          </div>

          <div className="login-actions">
            <button className="btn-outline" type="button" id="loginCancelBtn" onClick={onClose}>Annulla</button>
            <button className="btn-amber" type="submit" id="loginSubmitBtn">Accedi</button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}

export default AdminLogin;