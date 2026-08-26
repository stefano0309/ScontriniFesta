export default function SettingsTab({
  settings,
  setSettings,
  ticketCounter,
  handleResetCounter,
  creds,
  setCreds,
  deviceTag,
  setDeviceTag,
  exportSettings,
  hiddenImportRef,
  onImportSettingsFile,
}) {
  const updateField = (field, value) => setSettings((current) => ({ ...current, [field]: value }));

  return (
    <div className="tab-pane active">
      <div className="panel">
        <h2>Attività e scontrino</h2>
        <label>Nome attività</label>
        <input type="text" value={settings.bizName} onChange={(event) => updateField('bizName', event.target.value)} />

        <label>Messaggio di chiusura scontrino</label>
        <input type="text" value={settings.footer} onChange={(event) => updateField('footer', event.target.value)} />

        <label>Nota P.IVA / fiscale (facoltativa)</label>
        <input type="text" value={settings.vat} onChange={(event) => updateField('vat', event.target.value)} />

        <label>Simbolo valuta</label>
        <input type="text" value={settings.currency} onChange={(event) => updateField('currency', event.target.value)} style={{ maxWidth: 120 }} />

        <label>Tema interfaccia</label>
        <select value={settings.theme} onChange={(event) => updateField('theme', event.target.value)}>
          <option value="dark">Tema scuro</option>
          <option value="light">Tema chiaro</option>
        </select>
      </div>

      <div className="panel">
        <h2>Stampa</h2>
        <label>Larghezza carta</label>
        <select value={settings.paperWidth} onChange={(event) => updateField('paperWidth', Number(event.target.value))}>
          <option value={58}>58 mm</option>
          <option value={80}>80 mm</option>
        </select>

        <div className="toggle-row">
          <input
            type="checkbox"
            checked={settings.showPricesKitchen}
            onChange={(event) => updateField('showPricesKitchen', event.target.checked)}
          />
          <label htmlFor="showPricesKitchen">Mostra prezzi anche sui talloncini da cucina</label>
        </div>

        <div className="toggle-row">
          <input
            type="checkbox"
            checked={settings.autoSummary}
            onChange={(event) => updateField('autoSummary', event.target.checked)}
          />
          <label htmlFor="autoSummary">Includi sempre lo scontrino riepilogativo per il cliente</label>
        </div>

        <label>Metodo di stampa</label>
        <select value={settings.printMethod} onChange={(event) => updateField('printMethod', event.target.value)}>
          <option value="dialog">Finestra di stampa di sistema</option>
          <option value="rawbt">RawBT — invio diretto</option>
        </select>

        <div className="toggle-row">
          <input
            type="checkbox"
            checked={settings.rawbtCut}
            onChange={(event) => updateField('rawbtCut', event.target.checked)}
          />
          <label htmlFor="rawbtCut">La mia stampante ha il taglierino automatico</label>
        </div>

        {settings.rawbtCut && (
          <>
            <label>Avanzamento carta prima del taglio (righe)</label>
            <input
              type="number"
              min="3"
              max="20"
              value={settings.rawbtCutFeedLines}
              onChange={(event) => updateField('rawbtCutFeedLines', Number(event.target.value) || 5)}
            />
          </>
        )}
      </div>

      <div className="panel">
        <h2>Etichetta dispositivo</h2>
        <p className="hint">Usata per garantire numeri scontrino univoci per ogni tablet.</p>
        <label>Etichetta di questo dispositivo</label>
        <input
          type="text"
          value={deviceTag}
          maxLength={4}
          onChange={(event) => setDeviceTag(event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4))}
        />
        <p className="hint">Prossimo numero: #{String(ticketCounter).padStart(4, '0')}</p>
        <button type="button" className="btn-red" onClick={handleResetCounter}>Reimposta contatore a #0001</button>
      </div>

      <div className="panel">
        <h2>Credenziali amministratore</h2>
        <div className="form-row-2">
          <div>
            <label>Nuovo utente</label>
            <input
              type="text"
              value={creds.username}
              onChange={(event) => setCreds((current) => ({ ...current, username: event.target.value }))}
            />
          </div>
          <div>
            <label>Nuova password</label>
            <input
              type="password"
              value={creds.password}
              onChange={(event) => setCreds((current) => ({ ...current, password: event.target.value }))}
            />
          </div>
        </div>
      </div>

      <div className="panel">
        <h2>Backup impostazioni</h2>
        <button type="button" className="btn-teal btn-block" onClick={exportSettings}>⇩ Esporta impostazioni</button>
        <div style={{ marginTop: 12 }}>
          <label>Importa da file</label>
          <input type="file" accept=".json,application/json" onChange={onImportSettingsFile} style={{ marginBottom: 10, width: '100%' }} />
        </div>
      </div>
    </div>
  );
}
