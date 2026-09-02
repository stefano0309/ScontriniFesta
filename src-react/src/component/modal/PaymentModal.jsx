import { useState } from 'react';
import { useCassa } from '../../store/CassaContext';

function PaymentModal({ onClose }) {
  const { order, settings, printOrder, flash } = useCassa();
  const [method, setMethod] = useState('cash');
  const total = (order || []).reduce((s, l) => s + (Number(l.price) || 0) * (Number(l.qty) || 0), 0);
  const [paid, setPaid] = useState(total);
  const [processing, setProcessing] = useState(false);

  const handleConfirm = async () => {
    if (paid < total && method === 'cash') {
      flash('Importo pagato inferiore al totale.', true);
      return;
    }
    setProcessing(true);
    try {
      const res = await printOrder();
      if (res && res.ok) {
        flash('Pagamento registrato e ordine stampato');
        onClose();
      } else {
        flash("Stampa non riuscita, l'ordine è salvato", true);
      }
    } finally {
      setProcessing(false);
    }
  };

  if (!order || order.length === 0) return null;

  return (
    <div className="admin-history-modal" style={{ display: 'flex' }}>
      <div className="admin-history-modal-card">
        <div className="admin-history-modal-head">
          <div>
            <div className="muted">Pagamento</div>
            <h2>Totale: {settings.currency} {total.toFixed(2)}</h2>
          </div>
          <button type="button" className="icon-btn" onClick={onClose}>✕</button>
        </div>

        <div style={{ marginTop: 8 }}>
          <label>Metodo di pagamento</label>
          <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
            <button type="button" className={method === 'cash' ? 'btn-teal' : 'secondary'} onClick={() => setMethod('cash')}>Contanti</button>
            <button type="button" className={method === 'card' ? 'btn-teal' : 'secondary'} onClick={() => setMethod('card')}>Carta</button>
            <button type="button" className={method === 'voucher' ? 'btn-teal' : 'secondary'} onClick={() => setMethod('voucher')}>Buono</button>
          </div>

          <div style={{ marginTop: 12 }}>
            <label>Importo pagato</label>
            <input type="number" step="0.01" min="0" value={paid} onChange={(e) => setPaid(Number(e.target.value || 0))} />
            {method === 'cash' && <div className="hint" style={{ marginTop: 6 }}>Restituzione: {settings.currency} {(paid - total).toFixed(2)}</div>}
          </div>
        </div>

        <div className="admin-history-modal-actions" style={{ marginTop: 16 }}>
          <button type="button" className="secondary" onClick={onClose}>Annulla</button>
          <button type="button" className="btn-amber" onClick={handleConfirm} disabled={processing}>{processing ? 'Elaborazione…' : 'Conferma e Stampa'}</button>
        </div>
      </div>
    </div>
  );
}

export default PaymentModal;
