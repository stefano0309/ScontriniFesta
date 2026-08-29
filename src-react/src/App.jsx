import { useState } from 'react';
import CashierView from './component/view/cashierView';
import AdminLogin from './component/modal/adminLogin';
import AdminView from './component/view/adminView';

function App() {
  // Stato per la schermata principale corrente ('cashier' o 'admin')
  const [currentView, setCurrentView] = useState('cashier');
  
  // Stato per la modale di login
  const [showAdminLogin, setShowAdminLogin] = useState(false);

  // Gestione del login avvenuto con successo
  const handleLoginSuccess = () => {
    setShowAdminLogin(false); // Chiude il form di login
    setCurrentView('admin');   // Passa alla vista Admin
  };

  return (
    <>
      {/* Mostra CashierView se siamo nella cassa */}
      {currentView === 'cashier' && (
        <CashierView onOpenAdmin={() => setShowAdminLogin(true)} />
      )}

      {/* Mostra AdminView se abbiamo fatto l'accesso */}
      {currentView === 'admin' && (
        <AdminView onBack={() => setCurrentView('cashier')} />
      )}

      {/* Form di Login in overlay */}
      {showAdminLogin && (
        <AdminLogin 
          onClose={() => setShowAdminLogin(false)} 
          onLoginSuccess={handleLoginSuccess}
        />
      )}
    </>
  );
}

export default App;