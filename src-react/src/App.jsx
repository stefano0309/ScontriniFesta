import { useState } from 'react';
import { CashierView, AdminLogin, AdminView, SaleEditorModal } from './component';
import { CassaProvider, useCassa } from './store/CassaContext.jsx';
// Importa ed esegue il file di inizializzazione Firebase
import './module/firebaseInit.js';

function Shell() {
  const [currentView, setCurrentView] = useState('cashier');
  const [showAdminLogin, setShowAdminLogin] = useState(false);
  const { firebaseReady, flashState, dataWarning, dismissWarning, adminLoggedIn, logout } = useCassa();

  const handleLoginSuccess = () => {
    setShowAdminLogin(false);
    setCurrentView('admin');
  };

  const handleBackToCashier = () => {
    logout();
    setCurrentView('cashier');
  };

  return (
    <>
      {!firebaseReady && (
        <div style={{ background: '#ff9800', color: '#fff', textAlign: 'center', padding: '8px' }}>
          Connessione a Firebase in corso... L'app funziona in modalità offline.
        </div>
      )}

      {currentView === 'cashier' && (
        <CashierView onOpenAdmin={() => setShowAdminLogin(true)} />
      )}

      {currentView === 'admin' && adminLoggedIn && (
        <AdminView onBack={handleBackToCashier} />
      )}

      {showAdminLogin && (
        <AdminLogin onClose={() => setShowAdminLogin(false)} onLoginSuccess={handleLoginSuccess} />
      )}

      <SaleEditorModal />

      {/* Notifica lampo (successo/errore azioni) */}
      {flashState && (
        <div key={flashState.key} className={`flash-msg show${flashState.isError ? ' err' : ''}`} id="flashMsg">
          {flashState.text}
        </div>
      )}

      {/* Banner di avviso persistente per problemi di salvataggio/sync */}
      {dataWarning && (
        <div id="dataWarningBanner" className="show">
          <span id="dataWarningText">{dataWarning}</span>
          <button type="button" id="dataWarningDismiss" onClick={dismissWarning}>Ho capito</button>
        </div>
      )}

      {/* Area usata per generare le pagine da stampare col dialogo di sistema.
          Va nascosta a schermo e mostrata solo in stampa via CSS (@media print),
          come nell'originale — non con uno style inline che vincerebbe anche in stampa. */}
      <div id="printArea" />
    </>
  );
}

function App() {
  return (
    <CassaProvider>
      <Shell />
    </CassaProvider>
  );
}

export default App;