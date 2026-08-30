import { NavLink, Outlet } from 'react-router-dom';
import { useCassa } from '../../store/CassaContext';

// Mappa rotta -> id permesso (deve combaciare con TAB_LABELS in rolesTab.jsx
// e con ADMIN_TAB_IDS/DEFAULT_ROLES in CassaContext.jsx).
const NAV_ITEMS = [
  { id: 'menuTab', path: 'menu', label: 'Menu' },
  { id: 'csvTab', path: 'csv', label: 'Importa CSV' },
  { id: 'cashFloatTab', path: 'cash', label: '💰 Fondo Cassa' },
  { id: 'closeTab', path: 'close', label: 'Chiusura Cassa' },
  { id: 'page-history', path: 'history', label: '🧾 Storico' },
  { id: 'printersTab', path: 'printers', label: '🖨️ Stampanti' },
  { id: 'devicesTab', path: 'devices', label: '📱 Dispositivi' },
  { id: 'rolesTab', path: 'roles', label: '🔐 Ruoli' },
  { id: 'settingsTab', path: 'settings', label: 'Impostazioni' },
];

function AdminView({ onBack }) {
  const { canAccessTab } = useCassa();
  const visibleItems = NAV_ITEMS.filter((item) => canAccessTab(item.id));

  return (
    <div id="adminView">
      <div className="admin-wrap">
        <div className="admin-top">
          <h1>Area <span>Amministrazione</span></h1>
          <button className="back-btn" id="backToCashierBtn" onClick={onBack}>
            ← Torna alla cassa
          </button>
        </div>

        <div className="tabs">
          {visibleItems.map((item) => (
            <NavLink
              key={item.id}
              to={item.path}
              className={({ isActive }) => `tab-btn ${isActive ? 'active' : ''}`}
            >
              {item.label}
            </NavLink>
          ))}
        </div>

        {/* La rotta attiva sotto /admin/* viene renderizzata qui */}
        <Outlet />
      </div>
    </div>
  );
}

export default AdminView;