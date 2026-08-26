import { useState } from 'react';

function parseCsvMenu(text) {
  const lines = text.split(/\r\n|\n|\r/).filter((line) => line.trim() !== '');
  if (!lines.length) return { items: [], errors: ['Il file è vuoto.'] };

  const delimiter = lines[0].includes(';') && !lines[0].includes(',') ? ';' : ',';
  const rows = lines.map((line) => {
    const values = [];
    let current = '';
    let inQuotes = false;

    for (let index = 0; index < line.length; index += 1) {
      const char = line[index];
      if (char === '"') {
        if (inQuotes && line[index + 1] === '"') {
          current += '"';
          index += 1;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === delimiter && !inQuotes) {
        values.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }

    values.push(current.trim());
    return values;
  });

  const lowerRows = rows[0].map((cell) => cell.toLowerCase());
  const hasHeader = lowerRows.some((cell) => ['nome', 'piatto', 'name', 'prezzo', 'price', 'categoria', 'category', 'cat'].includes(cell));
  const dataRows = hasHeader ? rows.slice(1) : rows;
  const nameIndex = hasHeader ? lowerRows.findIndex((cell) => ['nome', 'piatto', 'name'].includes(cell)) : 0;
  const priceIndex = hasHeader ? lowerRows.findIndex((cell) => ['prezzo', 'price'].includes(cell)) : 1;
  const catIndex = hasHeader ? lowerRows.findIndex((cell) => ['categoria', 'category', 'cat'].includes(cell)) : 2;

  const items = [];
  const errors = [];

  dataRows.forEach((row, index) => {
    const effectiveIndex = index + (hasHeader ? 2 : 1);
    const name = (row[nameIndex] || '').trim();
    const priceRaw = String(row[priceIndex] || '').replace(/[€\s]/g, '').replace(',', '.');
    const price = Number(priceRaw);
    const category = (row[catIndex] || '').trim();

    if (!name) {
      errors.push(`Riga ${effectiveIndex}: nome mancante, saltata.`);
      return;
    }

    if (Number.isNaN(price) || price < 0) {
      errors.push(`Riga ${effectiveIndex}: prezzo non valido, saltata.`);
      return;
    }

    items.push({
      id: crypto.randomUUID(),
      name,
      price,
      category: category || 'Senza categoria',
      type: 'dish',
      items: [],
      showInCashier: true,
      showSalesCounter: false,
      showCountdown: false,
      maxQty: 0,
    });
  });

  return { items, errors };
}

export default function MenuTab({
  menu,
  settings,
  addDish,
  removeDish,
  getCategories,
  setMenu,
  importCsvMenu,
  updateDishOption,
  updateCategorySetting,
}) {
  const [dishType, setDishType] = useState('dish');
  const [comboItems, setComboItems] = useState(['', '']);
  const [csvStatus, setCsvStatus] = useState('');
  const [csvError, setCsvError] = useState('');

  const categoryNames = [...new Set(menu.map((dish) => dish.category || 'Senza categoria'))].sort();

  const handleAddDish = (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const type = form.get('type') || 'dish';
    const name = String(form.get('name') || '').trim();
    const price = Number(form.get('price'));
    const category = String(form.get('category') || '').trim();

    if (!name || Number.isNaN(price) || price < 0) return;

    const items = type === 'combo'
      ? comboItems.map((value) => value.trim()).filter(Boolean)
      : [];

    if (type === 'combo' && items.length < 2) {
      setCsvError('Un menu deve avere almeno 2 piatti.');
      return;
    }

    addDish({
      id: crypto.randomUUID(),
      type,
      name,
      price,
      category: category || 'Senza categoria',
      items,
      showInCashier: true,
      showSalesCounter: false,
      showCountdown: false,
      maxQty: 0,
    });

    event.currentTarget.reset();
    setComboItems(['', '']);
    setDishType('dish');
    setCsvError('');
  };

  const handleCsvImport = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const text = await file.text();
    const parsed = parseCsvMenu(text);
    if (!parsed.items.length) {
      setCsvStatus('Nessun piatto valido trovato nel CSV.');
      setCsvError('error');
      event.target.value = '';
      return;
    }

    const replace = document.getElementById('csvReplace')?.checked;
    if (replace) {
      setMenu(parsed.items);
    } else {
      setMenu((current) => [...current, ...parsed.items]);
    }

    setCsvStatus(`Importati ${parsed.items.length} piatti.`);
    setCsvError(parsed.errors.length ? 'warn' : '');
    event.target.value = '';
  };

  return (
    <div className="tab-pane active">
      <div className="panel">
        <h2>Aggiungi piatto al menu</h2>
        <form onSubmit={handleAddDish}>
          <label>Tipo</label>
          <select name="type" value={dishType} onChange={(event) => setDishType(event.target.value)}>
            <option value="dish">Piatto singolo</option>
            <option value="combo">Menu (gruppo di piatti)</option>
          </select>

          <div className="form-row">
            <div>
              <label>{dishType === 'combo' ? 'Nome del menu' : 'Nome piatto'}</label>
              <input type="text" name="name" placeholder="es. Tagliata di manzo" />
            </div>
            <div>
              <label>Prezzo (€)</label>
              <input type="number" name="price" placeholder="14.00" step="0.50" min="0" />
            </div>
            <div>
              <label>Categoria</label>
              <input type="text" name="category" placeholder="es. Secondi" list="catList" />
              <datalist id="catList">
                {getCategories().map((category) => (
                  <option key={category} value={category} />
                ))}
              </datalist>
            </div>
          </div>

          {dishType === 'combo' && (
            <div style={{ marginBottom: 10 }}>
              <label>Piatti inclusi nel menu</label>
              {comboItems.map((value, index) => (
                <div key={`combo-${index}`} style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                  <input
                    type="text"
                    value={value}
                    onChange={(event) => {
                      const next = [...comboItems];
                      next[index] = event.target.value;
                      setComboItems(next);
                    }}
                    placeholder="es. Pizza margherita"
                    style={{ margin: 0 }}
                  />
                  <button
                    type="button"
                    className="btn-red"
                    onClick={() => {
                      if (comboItems.length <= 2) return;
                      setComboItems((current) => current.filter((_, itemIndex) => itemIndex !== index));
                    }}
                  >
                    ✕
                  </button>
                </div>
              ))}
              <button type="button" className="btn-teal" onClick={() => setComboItems((current) => [...current, ''])}>
                + Aggiungi piatto al gruppo
              </button>
            </div>
          )}

          {csvError && <div className="login-err" style={{ marginBottom: 10 }}>{csvError === 'error' ? 'Errore nel CSV' : 'Attenzione: controlla i dati importati.'}</div>}

          <button type="submit" className="btn-amber btn-block">+ Aggiungi al menu</button>
        </form>
      </div>

      <div className="panel">
        <h2>Importa menu da CSV</h2>
        <p className="hint">Colonne attese: nome, prezzo, categoria. Supporta separatori , o ;.</p>
        <input type="file" accept=".csv,text/csv" onChange={handleCsvImport} style={{ marginBottom: 10, width: '100%' }} />
        <div className="toggle-row">
          <input type="checkbox" id="csvReplace" />
          <label htmlFor="csvReplace" style={{ margin: 0 }}>Sostituisci il menu esistente</label>
        </div>
        {csvStatus && <div className="status-line" style={{ color: csvError === 'error' ? 'var(--red)' : 'var(--green)' }}>{csvStatus}</div>}
      </div>

      <div className="panel">
        <h2>Impostazioni categorie</h2>
        {categoryNames.length === 0 ? (
          <div className="empty-hint">Nessuna categoria presente.</div>
        ) : (
          categoryNames.map((category) => (
            <div key={category} style={{ borderBottom: '1px solid var(--line)', padding: '10px 0' }}>
              <div style={{ fontWeight: 600, marginBottom: 8 }}>{category}</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-dim)', fontSize: 12 }}>
                  <input
                    type="checkbox"
                    checked={settings.categoryCumulative?.[category] !== false}
                    onChange={(event) => updateCategorySetting(category, 'categoryCumulative', event.target.checked)}
                  />
                  Cumulativo
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-dim)', fontSize: 12 }}>
                  <input
                    type="checkbox"
                    checked={settings.categorySpacer3cm?.[category] === true}
                    onChange={(event) => updateCategorySetting(category, 'categorySpacer3cm', event.target.checked)}
                  />
                  +3 cm sopra
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-dim)', fontSize: 12 }}>
                  <input
                    type="checkbox"
                    checked={settings.categoryPrintTicket?.[category] !== false}
                    onChange={(event) => updateCategorySetting(category, 'categoryPrintTicket', event.target.checked)}
                  />
                  Stampa talloncino
                </label>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="panel">
        <h2>Menu attuale</h2>
        {menu.length === 0 ? (
          <div className="empty-hint">Nessun piatto ancora.</div>
        ) : (
          menu.map((dish) => (
            <div className="dish-row" key={dish.id}>
              <div>
                <strong>{dish.name}</strong>
                <div className="dish-submeta">
                  <span>{dish.category || 'Senza categoria'}</span>
                  <span>{dish.type === 'combo' ? 'Menu' : 'Piatto'}</span>
                  <span>{settings.currency} {Number(dish.price || 0).toFixed(2)}</span>
                  {dish.items?.length ? <span>{dish.items.join(', ')}</span> : null}
                </div>
              </div>
              <div className="dish-actions" style={{ display: 'grid', gap: 8, justifyContent: 'end' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'var(--text-dim)' }}>
                  <input type="checkbox" checked={dish.showInCashier !== false} onChange={(event) => updateDishOption(dish.id, 'showInCashier', event.target.checked)} />
                  Cassa
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'var(--text-dim)' }}>
                  <input type="checkbox" checked={Boolean(dish.showSalesCounter)} onChange={(event) => updateDishOption(dish.id, 'showSalesCounter', event.target.checked)} />
                  Contatore
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'var(--text-dim)' }}>
                  <input type="checkbox" checked={Boolean(dish.showCountdown)} onChange={(event) => updateDishOption(dish.id, 'showCountdown', event.target.checked)} />
                  Countdown
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'var(--text-dim)' }}>
                  Max
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={dish.maxQty || ''}
                    onChange={(event) => {
                      const value = Number(event.target.value || 0);
                      updateDishOption(dish.id, 'maxQty', Number.isFinite(value) ? value : 0);
                      if (value > 0) updateDishOption(dish.id, 'showCountdown', true);
                    }}
                    style={{ width: 56, margin: 0, padding: '4px 6px', fontSize: 11 }}
                  />
                </label>
                <button type="button" className="btn-red" onClick={() => removeDish(dish.id)}>Elimina</button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
