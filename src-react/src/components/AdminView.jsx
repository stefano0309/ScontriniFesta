import { useRef, useState } from 'react';
import MenuTab from './MenuTab';
import SettingsTab from './SettingsTab';
import HistoryTab from './HistoryTab';
import PrintersTab from './PrintersTab';

const tabs = [
  { id: 'menuTab', label: 'Menu' },
  { id: 'cashFloatTab', label: '💰 Fondo Cassa' },
  { id: 'closeTab', label: 'Chiusura Cassa' },
  { id: 'page-history', label: '🧾 Storico' },
  { id: 'printersTab', label: '🖨️ Stampanti' },
  { id: 'settingsTab', label: 'Impostazioni' },
];

export default function AdminView({
  adminLoggedIn,
  activeTab,
  setActiveTab,
  menu,
  setMenu,
  settings,
  setSettings,
  salesLog,
  ticketCounter,
  setTicketCounter,
  onBackToCashier,
  addDish,
  removeDish,
  getCategories,
  importCsvMenu,
  handleResetCounter,
  cashFloat,
  cashAdditions,
  totalSales,
  totalCashAdditions,
  saveCashFloat,
  addCashAddition,
  resetCashSession,
  firebaseReady,
  firebaseStatus,
  creds,
  setCreds,
  deviceTag,
  setDeviceTag,
  exportSettings,
  importSettingsFromPayload,
  latestEditableSale,
  onToggleSaleVoided,
  onReprintSale,
  updateDishOption,
  updateCategorySetting,
}) {
  const [floatAmount, setFloatAmount] = useState(String(cashFloat?.amount || 0));
  const [floatNote, setFloatNote] = useState(cashFloat?.note || '');
  const [additionAmount, setAdditionAmount] = useState('');
  const [additionNote, setAdditionNote] = useState('');
  const hiddenImportRef = useRef(null);

  if (!adminLoggedIn) return null;

  const handleImportSettingsFile = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    try {
      const payload = JSON.parse(text);
      const ok = importSettingsFromPayload(payload);
      if (ok) {
        event.target.value = '';
      }
    } catch {
      event.target.value = '';
    }
  };

  return (
    <div id="adminView" className="admin-view show">
      <div className="admin-wrap">
        <div className="admin-top">
          <h1>
            Area <span>Amministrazione</span>
          </h1>
          <button type="button" className="back-btn" onClick={onBackToCashier}>
            ← Torna alla cassa
          </button>
        </div>

        <div className="tabs">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              className={`tab-btn ${activeTab === tab.id ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="panel" style={{ marginTop: -8, marginBottom: 16 }}>
          <div className="hint" style={{ marginTop: 0 }}>
            Stato sincronizzazione Firebase: <strong>{firebaseReady ? 'online' : 'offline'}</strong>
            {firebaseReady ? ` · ${firebaseStatus}` : ' · fallback locale'}
          </div>
        </div>

        {activeTab === 'menuTab' && (
          <MenuTab
            menu={menu}
            setMenu={setMenu}
            settings={settings}
            addDish={addDish}
            removeDish={removeDish}
            getCategories={getCategories}
            importCsvMenu={importCsvMenu}
            updateDishOption={updateDishOption}
            updateCategorySetting={updateCategorySetting}
          />
        )}

        {activeTab === 'settingsTab' && (
          <SettingsTab
            settings={settings}
            setSettings={setSettings}
            ticketCounter={ticketCounter}
            setTicketCounter={setTicketCounter}
            handleResetCounter={handleResetCounter}
            creds={creds}
            setCreds={setCreds}
            deviceTag={deviceTag}
            setDeviceTag={setDeviceTag}
            exportSettings={exportSettings}
            hiddenImportRef={hiddenImportRef}
            onImportSettingsFile={handleImportSettingsFile}
          />
        )}

        {activeTab === 'page-history' && (
          <HistoryTab
            salesLog={salesLog}
            settings={settings}
            onToggleSaleVoided={onToggleSaleVoided}
            onReprintSale={onReprintSale}
          />
        )}

        {activeTab === 'printersTab' && <PrintersTab />}

        {activeTab === 'closeTab' && (
          <div className="tab-pane active">
            <div className="panel">
              <h2>Chiusura cassa</h2>
              <p className="hint">Riepilogo di tutti gli ordini inviati in stampa dall'ultima chiusura.</p>
              <div className="info-box">
                <div><strong>Scontrini:</strong> {salesLog.length}</div>
                <div><strong>Incasso:</strong> {settings.currency} {Number(totalSales || 0).toFixed(2)}</div>
                <div><strong>Fondo cassa:</strong> {settings.currency} {Number(cashFloat?.amount || 0).toFixed(2)}</div>
                <div><strong>Totale contante aggiunto:</strong> {settings.currency} {Number(totalCashAdditions || 0).toFixed(2)}</div>
              </div>
              <button type="button" className="btn-red" style={{ marginTop: 12 }} onClick={resetCashSession}>
                Chiudi cassa e azzera
              </button>
            </div>
          </div>
        )}

        {activeTab === 'cashFloatTab' && (
          <div className="tab-pane active">
            <div className="panel">
              <h2>Fondo cassa iniziale</h2>
              <p className="hint">Imposta il contante iniziale e registra eventuali aggiunte durante la serata.</p>

              <label>Importo fondo cassa</label>
              <input
                type="number"
                value={floatAmount}
                min="0"
                step="0.01"
                onChange={(event) => setFloatAmount(event.target.value)}
              />

              <label>Nota (facoltativa)</label>
              <input
                type="text"
                value={floatNote}
                placeholder="es. 5 banconote da 20€"
                onChange={(event) => setFloatNote(event.target.value)}
              />

              <button
                type="button"
                className="btn-amber btn-block"
                onClick={() => {
                  saveCashFloat(floatAmount, floatNote);
                  setFloatAmount(String(cashFloat?.amount || 0));
                }}
              >
                Salva fondo cassa
              </button>

              <div style={{ marginTop: 18 }}>
                <h3 style={{ margin: '0 0 12px', fontSize: 14, color: 'var(--amber)' }}>Contante aggiunto durante la serata</h3>
                <label>Importo</label>
                <input type="number" value={additionAmount} min="0" step="0.01" onChange={(event) => setAdditionAmount(event.target.value)} />
                <label>Nota</label>
                <input type="text" value={additionNote} placeholder="es. resto dal bar" onChange={(event) => setAdditionNote(event.target.value)} />
                <button
                  type="button"
                  className="btn-teal btn-block"
                  onClick={() => {
                    addCashAddition(additionAmount, additionNote);
                    setAdditionAmount('');
                    setAdditionNote('');
                  }}
                >
                  + Aggiungi contante
                </button>
              </div>

              <div className="info-box" style={{ marginTop: 18 }}>
                <strong>Valore attuale:</strong> {settings.currency} {Number(cashFloat?.amount || 0).toFixed(2)}
                {cashFloat?.note ? ` · ${cashFloat.note}` : ''}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
