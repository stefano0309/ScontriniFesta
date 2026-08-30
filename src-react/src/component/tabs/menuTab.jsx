import { useState } from 'react';
import { useCassa } from '../../store/CassaContext';
import { groupByCategory } from '../../utils/format';

function MenuTab({ isActive }) {
  const { menu, categories, addDish, updateDish, deleteDish } = useCassa();

  const [dishType, setDishType] = useState('dish');
  const [dishName, setDishName] = useState('');
  const [dishPrice, setDishPrice] = useState('');
  const [dishCat, setDishCat] = useState('');
  const [comboItems, setComboItems] = useState(['', '']);

  const resetForm = () => {
    setDishName(''); setDishPrice(''); setDishCat('');
    setDishType('dish'); setComboItems(['', '']);
  };

  const handleAddComboField = () => setComboItems((prev) => [...prev, '']);
  const handleComboChange = (index, value) => {
    setComboItems((prev) => prev.map((v, i) => (i === index ? value : v)));
  };

  const handleTypeChange = (value) => {
    setDishType(value);
    if (value === 'combo' && comboItems.length < 2) setComboItems(['', '']);
  };

  const handleAddDish = async () => {
    if (!dishName.trim()) { window.alert('Inserisci un nome'); return; }
    const price = parseFloat(dishPrice);
    if (isNaN(price) || price < 0) { window.alert('Inserisci un prezzo valido'); return; }

    let items = [];
    if (dishType === 'combo') {
      items = comboItems.map((i) => i.trim()).filter((v) => v !== '');
      if (items.length < 2) { window.alert('Aggiungi almeno 2 piatti al gruppo'); return; }
    }

    await addDish({ name: dishName.trim(), price, cat: dishCat.trim(), type: dishType, items });
    resetForm();
  };

  const handleEdit = async (d) => {
    const newName = window.prompt('Nome:', d.name);
    if (newName === null) return;
    const newPriceStr = window.prompt('Prezzo (€):', d.price);
    if (newPriceStr === null) return;
    const newCat = window.prompt('Categoria:', d.cat || '');
    if (newCat === null) return;
    const newPrice = parseFloat(newPriceStr);
    if (!newName.trim() || isNaN(newPrice) || newPrice < 0) { window.alert('Dati non validi, modifica annullata'); return; }

    const patch = { name: newName.trim(), price: newPrice, cat: newCat.trim() };
    if (d.type === 'combo') {
      const itemsStr = window.prompt('Piatti inclusi nel menu (separati da virgola):', (d.items || []).join(', '));
      if (itemsStr === null) return;
      const items = itemsStr.split(',').map((s) => s.trim()).filter((v) => v !== '');
      if (items.length < 2) { window.alert('Un menu deve avere almeno 2 piatti, modifica annullata'); return; }
      patch.items = items;
    }
    await updateDish(d.id, patch);
  };

  const handleDelete = async (d) => {
    if (!window.confirm(`Eliminare "${d.name}" dal menu?`)) return;
    await deleteDish(d.id);
  };

  const groups = groupByCategory(menu);

  return (
    <div className={`tab-pane ${isActive ? 'active' : ''}`} id="menuTab">
      <div className="panel">
        <h2>Aggiungi piatto al menu</h2>
        <label htmlFor="newDishType">Tipo</label>
        <select id="newDishType" value={dishType} onChange={(e) => handleTypeChange(e.target.value)}>
          <option value="dish">Piatto singolo</option>
          <option value="combo">Menu (gruppo di piatti)</option>
        </select>
        <div className="form-row">
          <div>
            <label id="newDishNameLabel" htmlFor="newDishName">{dishType === 'combo' ? 'Nome del menu (es. Menu Pizza)' : 'Nome piatto'}</label>
            <input type="text" id="newDishName" placeholder="es. Tagliata di manzo" value={dishName} onChange={(e) => setDishName(e.target.value)} />
          </div>
          <div>
            <label htmlFor="newDishPrice">Prezzo (€)</label>
            <input type="number" id="newDishPrice" placeholder="14.00" step="0.50" min="0" value={dishPrice} onChange={(e) => setDishPrice(e.target.value)} />
          </div>
          <div>
            <label htmlFor="newDishCat">Categoria</label>
            <input type="text" id="newDishCat" placeholder="es. Secondi" list="catList" value={dishCat} onChange={(e) => setDishCat(e.target.value)} />
            <datalist id="catList">
              {categories.map((c) => <option key={c} value={c} />)}
            </datalist>
          </div>
        </div>

        {dishType === 'combo' && (
          <div id="comboItemsWrap" style={{ marginBottom: '10px' }}>
            <label>Piatti inclusi nel menu (uno per talloncino separato)</label>
            <div id="comboItemsList">
              {comboItems.map((item, index) => (
                <input
                  key={index}
                  type="text"
                  placeholder={`Piatto #${index + 1}`}
                  value={item}
                  onChange={(e) => handleComboChange(index, e.target.value)}
                  style={{ marginBottom: '6px' }}
                />
              ))}
            </div>
            <button type="button" className="btn-teal" id="addComboItemBtn" style={{ marginTop: '4px' }} onClick={handleAddComboField}>
              + Aggiungi piatto al gruppo
            </button>
          </div>
        )}

        <button type="button" className="btn-amber btn-block" id="addDishBtn" onClick={handleAddDish}>
          + Aggiungi al menu
        </button>
      </div>

      <div className="panel">
        <h2>Menu attuale</h2>
        <div id="menuList">
          {menu.length === 0 ? (
            <div className="empty-hint">Nessun piatto ancora.</div>
          ) : (
            Object.keys(groups).sort().map((cat) => (
              <div className="cat-group" key={cat}>
                <div className="cat-title">{cat}</div>
                {groups[cat].map((d) => (
                  <div key={d.id} className="dish-row">
                    <div>
                      {d.name}<span className="dp">€ {Number(d.price).toFixed(2)}</span>
                      {d.type === 'combo' && (
                        <span style={{ color: 'var(--teal)', fontSize: '11px', fontWeight: 700, marginLeft: '8px' }}>
                          MENU · {(d.items || []).join(' + ')}
                        </span>
                      )}
                    </div>
                    <div className="dish-actions">
                      <label style={{ display: 'flex', alignItems: 'center', gap: '5px', margin: 0, fontSize: '11px', color: 'var(--text-dim)', cursor: 'pointer' }}>
                        <input type="checkbox" checked={d.showInCashier !== false} onChange={(e) => updateDish(d.id, { showInCashier: e.target.checked })} />
                        Cassa
                      </label>
                      <label title="Mostra sotto al piatto, in cassa, quanti ne sono stati venduti in questa serata" style={{ display: 'flex', alignItems: 'center', gap: '5px', margin: 0, fontSize: '11px', color: 'var(--text-dim)', cursor: 'pointer' }}>
                        <input type="checkbox" checked={!!d.showSalesCounter} onChange={(e) => updateDish(d.id, { showSalesCounter: e.target.checked })} />
                        Contatore
                      </label>
                      <label title="Mostra in cassa un countdown separato per questo piatto." style={{ display: 'flex', alignItems: 'center', gap: '5px', margin: 0, fontSize: '11px', color: 'var(--text-dim)', cursor: 'pointer' }}>
                        <input type="checkbox" checked={!!d.showCountdown} onChange={(e) => updateDish(d.id, { showCountdown: e.target.checked })} />
                        Countdown
                      </label>
                      <label title="Numero massimo di pezzi vendibili in questa serata. Il countdown usa questo limite." style={{ display: 'flex', alignItems: 'center', gap: '5px', margin: 0, fontSize: '11px', color: 'var(--text-dim)' }}>
                        Max
                        <input
                          type="number" min="0" step="1" placeholder="—"
                          value={d.maxQty ? d.maxQty : ''}
                          style={{ width: '56px', margin: 0, padding: '4px 6px', fontSize: '11px' }}
                          onChange={(e) => {
                            const v = parseInt(e.target.value, 10);
                            const maxQty = (Number.isFinite(v) && v > 0) ? v : 0;
                            updateDish(d.id, { maxQty, showCountdown: maxQty > 0 ? true : d.showCountdown });
                          }}
                        />
                      </label>
                      <button className="btn-teal" onClick={() => handleEdit(d)}>Modifica</button>
                      <button className="btn-red" onClick={() => handleDelete(d)}>Elimina</button>
                    </div>
                  </div>
                ))}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

export default MenuTab;