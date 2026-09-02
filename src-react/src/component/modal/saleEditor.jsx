import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useCassa } from '../../store/CassaContext';
import { formatTicketNum } from '../../utils/format';
import { cloneSaleLines } from '../../utils/menu';

function SaleEditorModal() {
  const { saleEditorSale, closeSaleEditor, saveEditedSale, menu, settings } = useCassa();
  const [draft, setDraft] = useState([]);
  const [addDishId, setAddDishId] = useState('');
  const [addQty, setAddQty] = useState(1);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!saleEditorSale) return;
    const lines = cloneSaleLines(saleEditorSale.lines || []);
    // Storico precedente all'introduzione di dishId: ricostruiamo l'ID quando possibile.
    lines.forEach((l) => { if (!l.dishId) { const d = menu.find((x) => x.name === l.name); if (d) l.dishId = d.id; } });
    setDraft(lines);
  }, [saleEditorSale, menu]);

  if (!saleEditorSale) return null;

  const label = formatTicketNum(saleEditorSale.orderNum, saleEditorSale.deviceTag);
  const dishOptions = menu.filter((d) => d.showInCashier !== false);
  const total = draft.reduce((s, l) => s + (Number(l.price) || 0) * (Number(l.qty) || 0), 0);

  const decLine = (idx) => {
    setDraft((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], qty: next[idx].qty - 1 };
      if (next[idx].qty <= 0) next.splice(idx, 1);
      return next;
    });
  };
  const incLine = (idx) => {
    setDraft((prev) => prev.map((l, i) => (i === idx ? { ...l, qty: l.qty + 1 } : l)));
  };
  const removeLine = (idx) => setDraft((prev) => prev.filter((_, i) => i !== idx));

  const handleAddDish = () => {
    const d = menu.find((x) => x.id === addDishId);
    if (!d) return;
    const qty = Math.max(1, parseInt(addQty, 10) || 1);
    setDraft((prev) => {
      const existing = prev.find((l) => (l.dishId || '') === d.id && !l.note);
      if (existing) return prev.map((l) => (l === existing ? { ...l, qty: l.qty + qty } : l));
      return [...prev, { dishId: d.id, name: d.name, price: Number(d.price) || 0, qty, note: '' }];
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await saveEditedSale(saleEditorSale, draft);
      if (res.ok) closeSaleEditor();
    } finally {
      setSaving(false);
    }
  };

  return createPortal(
    <div
      className="admin-history-modal"
      style={{
        display: 'flex',
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(0,0,0,0.55)',
      }}
    >
      <div className="admin-history-modal-card">
        <div className="admin-history-modal-head">
          <div>
            <div className="muted">Modifica ordine</div>
            <h2>#{label}</h2>
          </div>
          <button type="button" className="icon-btn" onClick={closeSaleEditor}>✕</button>
        </div>

        <div>
          <div className="muted" style={{ margin: '10px 0 8px' }}>{new Date(saleEditorSale.ts).toLocaleString('it-IT')}</div>

          {draft.length === 0 ? (
            <div className="empty-hint">L'ordine è vuoto. Aggiungi almeno un piatto.</div>
          ) : (
            draft.map((l, idx) => (
              <div key={idx} className="admin-history-detail-line" style={{ gridTemplateColumns: '1fr auto auto', alignItems: 'center', gap: '8px' }}>
                <span>
                  {l.name}
                  {l.note && <div style={{ fontSize: '11px', color: 'var(--text-dim)', fontStyle: 'italic' }}>— {l.note}</div>}
                </span>
                <div className="qtystep">
                  <button type="button" className="icon-btn" onClick={() => decLine(idx)}>−</button>
                  <strong>{Number(l.qty) || 0}</strong>
                  <button type="button" className="icon-btn" onClick={() => incLine(idx)}>+</button>
                </div>
                <button type="button" className="rm-btn" onClick={() => removeLine(idx)}>Elimina</button>
              </div>
            ))
          )}

          <div className="admin-history-detail-total">
            <span>NUOVO TOTALE</span>
            <span>{settings.currency} {total.toFixed(2)}</span>
          </div>

          <div style={{ marginTop: '16px', paddingTop: '14px', borderTop: '1px solid var(--line)' }}>
            <label>Aggiungi piatto</label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 84px auto', gap: '8px', alignItems: 'end' }}>
              <select value={addDishId} onChange={(e) => setAddDishId(e.target.value)}>
                <option value="">Seleziona…</option>
                {dishOptions.map((d) => (
                  <option key={d.id} value={d.id}>{d.name} · {settings.currency} {Number(d.price || 0).toFixed(2)}</option>
                ))}
              </select>
              <input type="number" min="1" step="1" value={addQty} onChange={(e) => setAddQty(e.target.value)} />
              <button type="button" className="btn-teal" style={{ padding: '9px 12px' }} onClick={handleAddDish}>+ Aggiungi</button>
            </div>
            <div className="hint" style={{ marginTop: '8px', fontSize: '11px', color: 'var(--text-dim)' }}>
              Le diminuzioni aggiornano subito i totali. Le nuove quantità positive vengono stampate come talloncini aggiuntivi dopo il salvataggio.
            </div>
          </div>
        </div>

        <div className="admin-history-modal-actions">
          <button type="button" className="secondary" onClick={closeSaleEditor}>Annulla</button>
          <button type="button" className="btn-amber" disabled={saving} onClick={handleSave}>
            {saving ? 'Salvataggio…' : 'Salva modifiche'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

export default SaleEditorModal;
