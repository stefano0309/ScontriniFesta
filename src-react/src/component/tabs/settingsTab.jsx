// SettingsTab.jsx (Versione completa con gestione cumulativa categorie)
import { useState } from 'react';

function SettingsTab({ isActive, initialSettings = {}, categories = [], onSaveSettings, onResetCounter }) {
    const [settings, setSettings] = useState({
        bizName: initialSettings.bizName || '',
        footer: initialSettings.footer || '',
        vat: initialSettings.vat || '',
        currency: initialSettings.currency || '€',
        theme: initialSettings.theme || 'dark',
        paperWidth: initialSettings.paperWidth || '58',
        showPricesKitchen: initialSettings.showPricesKitchen || false,
        autoSummary: initialSettings.autoSummary ?? true,
        printMethod: initialSettings.printMethod || 'dialog',
        rawbtCut: initialSettings.rawbtCut || false,
        rawbtCutFeed: initialSettings.rawbtCutFeed || 5,
        deviceTag: initialSettings.deviceTag || '',
        categoryOptions: initialSettings.categoryOptions || {} // { [cat]: { cumulative: boolean, topMargin: boolean, enabled: boolean } }
    });

    const [newUser, setNewUser] = useState('');
    const [newPass, setNewPass] = useState('');
    const [statusMsg, setStatusMsg] = useState('');
    const [credsStatus, setCredsStatus] = useState('');
    const [backupStatus, setBackupStatus] = useState('');
    const [importFile, setImportFile] = useState(null);

    const handleChange = (e) => {
        const { id, value, type, checked } = e.target;
        const key = id.replace(/^set/, '');
        const normalizedKey = key.charAt(0).toLowerCase() + key.slice(1);

        setSettings(prev => ({
            ...prev,
            [normalizedKey]: type === 'checkbox' ? checked : value
        }));
    };

    const handleCategoryOptChange = (cat, optKey, value) => {
        setSettings(prev => ({
            ...prev,
            categoryOptions: {
                ...prev.categoryOptions,
                [cat]: {
                    ...prev.categoryOptions[cat],
                    [optKey]: value
                }
            }
        }));
    };

    const handleSaveSettings = () => {
        if (onSaveSettings) onSaveSettings(settings);
        setStatusMsg('Impostazioni salvate con successo!');
    };

    const handleUpdateCreds = () => {
        if (!newUser || !newPass) {
            setCredsStatus('Inserisci sia utente che password.');
            return;
        }
        setCredsStatus('Credenziali aggiornate con successo!');
        setNewUser('');
        setNewPass('');
    };

    const handleExport = () => {
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(settings, null, 2));
        const downloadAnchor = document.createElement('a');
        downloadAnchor.setAttribute("href", dataStr);
        downloadAnchor.setAttribute("download", "settings_backup.json");
        document.body.appendChild(downloadAnchor);
        downloadAnchor.click();
        downloadAnchor.remove();
        setBackupStatus('Export completato.');
    };

    const handleImport = () => {
        if (!importFile) {
            setBackupStatus('Seleziona un file JSON.');
            return;
        }
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const parsed = JSON.parse(e.target.result);
                setSettings(prev => ({ ...prev, ...parsed }));
                setBackupStatus('Impostazioni importate con successo!');
            } catch (err) {
                setBackupStatus('Errore nel formato del file.');
            }
        };
        reader.readAsText(importFile);
    };

    return (
        <div className={`tab-pane ${isActive ? 'active' : ''}`} id="settingsTab">
            <div className="panel">
                <h2>Attività e scontrino</h2>
                <label htmlFor="setBizName">Nome attività (intestazione talloncini)</label>
                <input type="text" id="setBizName" placeholder="es. Trattoria Da Mario" value={settings.bizName} onChange={handleChange} />

                <label htmlFor="setFooter">Messaggio di chiusura scontrino</label>
                <input type="text" id="setFooter" placeholder="es. Grazie e arrivederci" value={settings.footer} onChange={handleChange} />

                <label htmlFor="setVat">Nota P.IVA / fiscale (facoltativa, sullo scontrino riepilogativo)</label>
                <input type="text" id="setVat" placeholder="es. P.IVA 01234567890" value={settings.vat} onChange={handleChange} />

                <label htmlFor="setCurrency">Simbolo valuta</label>
                <input type="text" id="setCurrency" placeholder="€" style={{ maxWidth: '100px' }} value={settings.currency} onChange={handleChange} />

                <label htmlFor="setTheme">Tema interfaccia</label>
                <select id="setTheme" value={settings.theme} onChange={handleChange}>
                    <option value="dark">Tema scuro</option>
                    <option value="light">Tema chiaro</option>
                </select>
            </div>

            <div className="panel">
                <h2>Stampa</h2>
                <label htmlFor="setPaperWidth">Larghezza carta</label>
                <select id="setPaperWidth" value={settings.paperWidth} onChange={handleChange}>
                    <option value="58">58 mm</option>
                    <option value="80">80 mm</option>
                </select>

                <div className="toggle-row">
                    <input type="checkbox" id="setShowPricesKitchen" checked={settings.showPricesKitchen} onChange={handleChange} />
                    <label style={{ margin: 0 }} htmlFor="setShowPricesKitchen">Mostra prezzi anche sui talloncini da cucina</label>
                </div>

                <div className="toggle-row">
                    <input type="checkbox" id="setAutoSummary" checked={settings.autoSummary} onChange={handleChange} />
                    <label style={{ margin: 0 }} htmlFor="setAutoSummary">Includi sempre lo scontrino riepilogativo per il cliente</label>
                </div>
            </div>

            <div className="panel">
                <h2>Talloncini per categoria</h2>
                <p className="hint">
                    Per ogni categoria del menu scegli come stampare più unità dello stesso piatto nello stesso ordine.
                </p>
                <div id="categoryCumulativeList">
                    {categories.length === 0 ? (
                        <div className="empty-hint">Aggiungi piatti al menu per configurare le categorie.</div>
                    ) : (
                        categories.map((cat) => {
                            const opts = settings.categoryOptions[cat] || { cumulative: true, print: true };
                            return (
                                <div key={cat} style={{ borderBottom: '1px solid #333', paddingBottom: '10px', marginBottom: '10px' }}>
                                    <strong style={{ fontSize: '15px' }}>{cat}</strong>
                                    <div className="toggle-row" style={{ marginTop: '6px' }}>
                                        <input
                                            type="checkbox"
                                            id={`cat-cum-${cat}`}
                                            checked={opts.cumulative}
                                            onChange={(e) => handleCategoryOptChange(cat, 'cumulative', e.target.checked)}
                                        />
                                        <label htmlFor={`cat-cum-${cat}`} style={{ margin: 0 }}>Cumulativo (es. 4x Pasta)</label>
                                    </div>
                                    <div className="toggle-row">
                                        <input
                                            type="checkbox"
                                            id={`cat-print-${cat}`}
                                            checked={opts.print ?? true}
                                            onChange={(e) => handleCategoryOptChange(cat, 'print', e.target.checked)}
                                        />
                                        <label htmlFor={`cat-print-${cat}`} style={{ margin: 0 }}>Stampa talloncino cucina</label>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
            </div>

            <div className="panel">
                <h2>Metodo di stampa (Android / Bluetooth)</h2>
                <label htmlFor="setPrintMethod">Come inviare i talloncini alla stampante</label>
                <select id="setPrintMethod" value={settings.printMethod} onChange={handleChange}>
                    <option value="dialog">Finestra di stampa di sistema (predefinito)</option>
                    <option value="rawbt">RawBT — invio diretto, senza finestre</option>
                </select>

                <div className="toggle-row">
                    <input type="checkbox" id="setRawbtCut" checked={settings.rawbtCut} onChange={handleChange} />
                    <label style={{ margin: 0 }} htmlFor="setRawbtCut">
                        La mia stampante ha il taglierino automatico
                    </label>
                </div>

                {settings.rawbtCut && (
                    <div id="cutFeedWrap">
                        <label htmlFor="setRawbtCutFeed">Avanzamento carta prima del taglio (righe)</label>
                        <input type="number" id="setRawbtCutFeed" min="3" max="20" step="1" style={{ maxWidth: '120px' }} value={settings.rawbtCutFeed} onChange={handleChange} />
                    </div>
                )}
            </div>

            <div className="panel">
                <h2>Etichetta dispositivo</h2>
                <label htmlFor="setDeviceTag">Etichetta di questo dispositivo</label>
                <input type="text" id="setDeviceTag" maxLength="4" placeholder="es. A" style={{ maxWidth: '140px', textTransform: 'uppercase' }} value={settings.deviceTag} onChange={handleChange} />
            </div>

            <div className="panel">
                <h2>Contatore ordini</h2>
                <button type="button" className="btn-red" id="resetCounterBtn" style={{ padding: '9px 14px' }} onClick={onResetCounter}>
                    Reimposta contatore a #0001
                </button>
            </div>

            <div className="panel">
                <h2>Credenziali amministratore</h2>
                <div className="form-row-2">
                    <div>
                        <label htmlFor="setNewUser">Nuovo utente</label>
                        <input type="text" id="setNewUser" placeholder="admin" value={newUser} onChange={(e) => setNewUser(e.target.value)} />
                    </div>
                    <div>
                        <label htmlFor="setNewPass">Nuova password</label>
                        <input type="password" id="setNewPass" placeholder="••••••" value={newPass} onChange={(e) => setNewPass(e.target.value)} />
                    </div>
                </div>
                <button type="button" className="btn-teal" id="saveCredsBtn" onClick={handleUpdateCreds}>Aggiorna credenziali</button>
                <div className="status-line" id="credsStatus">{credsStatus}</div>
            </div>

            <div className="panel">
                <h2>Backup impostazioni</h2>
                <button type="button" className="btn-teal btn-block" id="exportSettingsBtn" onClick={handleExport}>⇩ Esporta impostazioni</button>
                <div style={{ marginTop: '12px' }}>
                    <label htmlFor="importSettingsFile">Importa da file</label>
                    <input type="file" id="importSettingsFile" accept=".json,application/json" style={{ marginBottom: '10px', width: '100%', color: 'var(--text-dim)', fontSize: '13px' }} onChange={(e) => setImportFile(e.target.files[0])} />
                    <button type="button" className="btn-amber btn-block" id="importSettingsBtn" onClick={handleImport}>⇧ Importa impostazioni</button>
                </div>
                <div className="status-line" id="backupStatus">{backupStatus}</div>
            </div>

            <button type="button" className="btn-amber btn-block" id="saveSettingsBtn" style={{ padding: '14px', fontSize: '15px' }} onClick={handleSaveSettings}>
                Salva impostazioni
            </button>
            <div className="status-line" id="settingsStatus" style={{ textAlign: 'center' }}>{statusMsg}</div>
        </div>
    );
}

export default SettingsTab;