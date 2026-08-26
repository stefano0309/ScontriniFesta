import { useMemo, useState } from 'react';

function cloneLines(lines = []) {
  return (lines || []).map((line) => ({
    id: line.id || line.dishId || `${line.name}-${Math.random().toString(36).slice(2)}`,
    dishId: line.dishId || '',
    name: line.name || '',
    qty: Math.max(0, Number(line.qty || 0)),
    price: Number(line.price || 0),
    note: line.note || '',
  })).filter((line) => line.qty > 0);
}

export default function SaleEditorModal({ sale, menu, settings, onClose, onSave }) {
  const [draft, setDraft] = useState(() => cloneLines(sale?.lines || []));
  const [selectedDishId, setSelectedDishId] = useState(menu[0]?.id || '');
  const [selectedQty, setSelectedQty] = useState(1);

  const total = useMemo(
    () => draft.reduce((sum, line) => sum + Number(line.price || 0) * Number(line.qty || 0), 0),
    [draft],
  );

  const addDish = () => {
    if (!selectedDishId) return;
    const dish = menu.find((item) => item.id === selectedDishId);
    if (!dish) return;
    setDraft((current) => {
      const existing = current.find((line) => (line.dishId || line.name) === dish.id && !line.note);
      if (existing) {
        return current.map((line) => (line.dishId || line.name) === dish.id && !line.note
          ? { ...line, qty: Number(line.qty) + Number(selectedQty || 1) }
          : line);
      }
      return [
        ...current,
        {
          id: dish.id,
          dishId: dish.id,
          name: dish.name,
          qty: Number(selectedQty || 1),
          price: Number(dish.price || 0),
          note: '',
        },
      ];
    });
  };

  const updateQty = (index, delta) => {
    setDraft((current) => {
      const next = [...current];
      const updated = Number(next[index].qty || 0) + delta;
      if (updated <= 0) next.splice(index, 1);
      else next[index] = { ...next[index], qty: updated };
      return next;
    });
  };

  const removeLine = (index) => {
    setDraft((current) => current.filter((_, idx) => idx !== index));
  };

  const handleSave = () => {
    if (!draft.length) return;
    onSave?.(draft);
  };

  if (!sale) return null;

  return (
    <div className="login-overlay show" style={{ zIndex: 3000 }}>
      <div className="login-card" style={{ maxWidth: 620, width: '100%' }}>
        <h3>Modifica scontrino #{String(sale.ticket || sale.orderNum || 0).padStart(4, '0')}</h3>

        <div style={{ maxHeight: 300, overflowY: 'auto', display: 'grid', gap: 8 }}>
          {draft.length === 0 ? (
            <div className="empty-hint">L’ordine è vuoto.</div>
          ) : (
            draft.map((line, index) => (
              <div key={`${line.id || line.name}-${index}`} className="dish-row" style={{ padding: 10 }}>
                <div>
                  <strong>{line.name}</strong>
                  {line.note ? <div className="hint">{line.note}</div> : null}
                </div>
                <div className="qtystep">
                  <button type="button" onClick={() => updateQty(index, -1)}>−</button>
                  <strong>{line.qty}</strong>
                  <button type="button" onClick={() => updateQty(index, 1)}>+</button>
                  <button type="button" className="rm-btn" onClick={() => removeLine(index)}>Elimina</button>
                </div>
              </div>
            ))
          )}
        </div>

        <div style={{ marginTop: 18, display: 'grid', gap: 8 }}>
          <label>Aggiungi piatto</label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px auto', gap: 8 }}>
            <select value={selectedDishId} onChange={(event) => setSelectedDishId(event.target.value)}>
              {menu.filter((dish) => dish.showInCashier !== false).map((dish) => (
                <option key={dish.id} value={dish.id}>{dish.name}</option>
              ))}
            </select>
            <input type="number" min="1" value={selectedQty} onChange={(event) => setSelectedQty(Math.max(1, Number(event.target.value || 1)))} />
            <button type="button" className="btn-teal" onClick={addDish}>+ Aggiungi</button>
          </div>
        </div>

        <div className="admin-history-detail-total" style={{ marginTop: 18 }}>
          <span>Nuovo totale</span>
          <span>{settings.currency} {Number(total || 0).toFixed(2)}</span>
        </div>

        <div className="login-actions" style={{ marginTop: 18 }}>
          <button type="button" className="btn-outline" onClick={onClose}>Annulla</button>
          <button type="button" className="btn-amber" onClick={handleSave} disabled={!draft.length}>Salva</button>
        </div>
      </div>
    </div>
  );
}
