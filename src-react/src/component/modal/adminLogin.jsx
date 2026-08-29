import { useState } from 'react';

function AdminLogin({ onClose, onLoginSuccess }) {
    // Stati per i campi e per l'eventuale messaggio di errore
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');

    const handleSubmit = (e) => {
        e.preventDefault(); // Evita il ricaricamento della pagina

        // Controllo credenziali
        if (username === 'admin' && password === 'admin') {
            setError('');
            onLoginSuccess(); // Chiama la funzione per accedere all'AdminView
        } else {
            setError('Credenziali non valide. Riprova.');
        }
    };

    return (
        <div id="adminLoginOverlay">
            <div className="login-card">
                <h3>Accesso amministratore</h3>
                
                {/* Avvolgiamo in un tag form per consentire anche l'invio con il tasto Invio */}
                <form onSubmit={handleSubmit}>
                    <label htmlFor="loginUser">Utente</label>
                    <input 
                        type="text" 
                        id="loginUser" 
                        autoComplete="username"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
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
                        <button className="btn-outline" type="button" onClick={onClose}>Annulla</button>
                        <button className="btn-amber" type="submit" id="loginSubmitBtn">Accedi</button>
                    </div>
                </form>
            </div>
        </div>
    );
}

export default AdminLogin;