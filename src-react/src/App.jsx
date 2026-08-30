import { useState } from 'react';
import { HashRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import CashierView from './component/view/cashierView';
import AdminLogin from './component/modal/adminLogin';
import AdminView from './component/view/adminView';
import ProtectedRoute from './component/route/protectedRoute';
import SaleEditorModal from './component/modal/saleEditor';
import MenuTab from './component/tabs/menuTab';
import CsvTab from './component/tabs/csvTab';
import CashTab from './component/tabs/cashTab';
import CloseTab from './component/tabs/closeTab';
import SettingsTab from './component/tabs/settingsTab';
import PrinterTab from './component/tabs/printerTab';
import HistoryTab from './component/tabs/historyTab';
import DevicesTab from './component/tabs/devicesTab';
import RolesTab from './component/tabs/rolesTab';
import { CassaProvider, useCassa } from './store/CassaContext';
// Importa ed esegue il file di inizializzazione Firebase
import './module/firebaseInit.js';

// Schermata cassa: gestisce localmente solo l'apertura del login admin (non
// è uno stato "di app", quindi resta qui e non nel router).
function CashierPage() {
  const navigate = useNavigate();
  const [showAdminLogin, setShowAdminLogin] = useState(false);

  const handleLoginSuccess = () => {
    setShowAdminLogin(false);
    navigate('/admin/menu');
  };

  return (
    <>
      <CashierView onOpenAdmin={() => setShowAdminLogin(true)} />
      {showAdminLogin && (
        <AdminLogin onClose={() => setShowAdminLogin(false)} onLoginSuccess={handleLoginSuccess} />
      )}
    </>
  );
}

function Shell() {
  const navigate = useNavigate();
  const { firebaseReady, flashState, dataWarning, dismissWarning, logout } = useCassa();

  const handleBackToCashier = () => {
    logout();
    navigate('/');
  };

  return (
    <>
      {!firebaseReady && (
        <div style={{ background: '#ff9800', color: '#fff', textAlign: 'center', padding: '8px' }}>
          Connessione a Firebase in corso... L'app funziona in modalità offline.
        </div>
      )}

      <Routes>
        <Route path="/" element={<CashierPage />} />

        <Route
          path="/admin"
          element={
            <ProtectedRoute>
              <AdminView onBack={handleBackToCashier} />
            </ProtectedRoute>
          }
        >
          <Route index element={<Navigate to="menu" replace />} />
          <Route path="menu" element={<MenuTab />} />
          <Route path="csv" element={<CsvTab />} />
          <Route path="cash" element={<CashTab />} />
          <Route path="close" element={<CloseTab />} />
          <Route path="history" element={<HistoryTab />} />
          <Route path="printers" element={<PrinterTab />} />
          <Route path="devices" element={<DevicesTab />} />
          <Route path="roles" element={<RolesTab />} />
          <Route path="settings" element={<SettingsTab />} />
        </Route>

        {/* Qualunque altra rotta sconosciuta torna alla cassa */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>

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

      {/* Modale condivisa "modifica ordine": montata una sola volta a livello
          di app (via portal su document.body), così è sempre visibile sopra
          qualunque vista la apra — cassa o area amministrazione. */}
      <SaleEditorModal />

      {/* Area usata per generare le pagine da stampare col dialogo di sistema. */}
      <div id="printArea" />
    </>
  );
}

function App() {
  return (
    <CassaProvider>
      {/* HashRouter: necessario per il pacchetto Android/Capacitor, dove le
          pagine sono servite da file:// e non c'è un server che possa gestire
          il routing "vero" (niente riscritture lato server per un refresh su
          /admin/settings, per esempio). Le URL avranno quindi la forma
          index.html#/admin/settings invece di /admin/settings. */}
      <HashRouter>
        <Shell />
      </HashRouter>
    </CassaProvider>
  );
}

export default App;