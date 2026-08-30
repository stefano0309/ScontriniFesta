import { Navigate } from 'react-router-dom';
import { useCassa } from '../../store/CassaContext';

// L'accesso admin resta un login "in sessione" (come nell'originale): non è
// persistito, quindi ricaricare la pagina su una rotta /admin/* mentre non
// si è loggati rimanda alla cassa invece di mostrare l'area riservata vuota.
function ProtectedRoute({ children }) {
  const { adminLoggedIn } = useCassa();
  if (!adminLoggedIn) return <Navigate to="/" replace />;
  return children;
}

export default ProtectedRoute;