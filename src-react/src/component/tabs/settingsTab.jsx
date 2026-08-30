import { useEffect, useState } from 'react';
import { useCassa } from '../../store/CassaContext';
import { formatTicketNum } from '../../utils/format';

function SettingsTab({ isActive }) {
    const {
        settings, categories, deviceTag, creds, ticketCounter,
        saveSettings, saveCreds, setDeviceTag, resetCounter,
        exportSettingsFile, importSettingsFromPayload,
    } = useCassa();

    const [form, setForm] = useState(settings);
    useEffect(() => { setForm(settings); }, [settings]);

    const [deviceTagInput, setDeviceTagInput] = useState(deviceTag);
    useEffect(() => { setDeviceTagInput(deviceTag); }, [deviceTag]);
    const [deviceTagStatus, setDeviceTagStatus] = useState('');
    const [deviceTagStatusColor, setDeviceTagStatusColor] = useState('');

    const [newUser, setNewUser] = useState('');
    const [newPass, setNewPass] = useState('');
    const [credsStatus, setCredsStatus] = useState('');
    const [backupStatus, setBackupStatus] = useState('');
    const [importFile, setImportFile] = useState(null);
    const [statusMsg, setStatusMsg] = useState('');

    const setField = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

    const setCategoryOpt = (cat, key, value) => {
        setForm((prev) => ({
            ...prev,
            [key]: { ...prev[key], [cat]: value },
        }));
    };

    const handleSaveSettings = async () => {
        await saveSettings(form);
        setStatusMsg('Impostazioni salvate.');
        setTimeout(() => setStatusMsg(''), 2500);
    };

    const handleSaveDeviceTag = async () => {
        setDeviceTagStatus('Verifica in corso...');
        setDeviceTagStatusColor('var(--text-dim)');
        const result = await setDeviceTag(deviceTagInput);
        if (!result.ok) {
            setDeviceTagStatus(result.error);
            setDeviceTagStatusColor('var(--red)');
            return;
        }
        setDeviceTagStatus(result.offline
            ? `Etichetta salvata solo localmente: non è stato possibile verificarne l'unicità online. Assicurati che nessun altro dispositivo usi la stessa etichetta.`
            : 'Etichetta salvata e verificata.');
        setDeviceTagStatusColor(result.offline ? 'var(--red)' : 'var(--green)');
        setTimeout(() => setDeviceTagStatus(''), result.offline ? 6000 : 3000);
    };

    const handleUpdateCreds = () => {
        if (!newUser || !newPass) {
            setCredsStatus('Inserisci utente e password.');
            return;
        }
        saveCreds({ username: newUser, password: newPass });
        setNewUser(''); setNewPass('');
        setCredsStatus('Credenziali aggiornate.');
        setTimeout(() => setCredsStatus(''), 2500);
    };

    const handleExport = () => {
        exportSettingsFile();
        setBackupStatus('File esportato.');
        setTimeout(() => setBackupStatus(''), 2500);
    };

    const handleImport = () => {
        if (!importFile) { setBackupStatus('Seleziona prima un file.'); return; }
        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const payload = JSON.parse(e.target.result);
                if (!window.confirm('Importare queste impostazioni? Menu, categorie, impostazioni di stampa e credenziali admin attuali verranno sovrascritti.')) return;
                await importSettingsFromPayload(payload);
                setBackupStatus('Impostazioni importate correttamente.');
                setImportFile(null);
            } catch (err) {
                setBackupStatus('File non valido o corrotto.');
            }
        };
        reader.onerror = () => setBackupStatus('Errore nella lettura del file.');
        reader.readAsText(importFile, 'UTF-8');
    };

    return (
        <div className={`tab-pane ${isActive ? 'active' : ''}`} id="settingsTab">
            <div className="panel">
                <h2>Attività e scontrino</h2>
                <label htmlFor="setBizName">Nome attività (intestazione talloncini)</label>
                <input type="text" id="setBizName" placeholder="es. Trattoria Da Mario" value={form.bizName} onChange={(e) => setField('bizName', e.target.value)} />

                <label htmlFor="setFooter">Messaggio di chiusura scontrino</label>
                <input type="text" id="setFooter" placeholder="es. Grazie e arrivederci" value={form.footer} onChange={(e) => setField('footer', e.target.value)} />

                <label htmlFor="setVat">Nota P.IVA / fiscale (facoltativa, sullo scontrino riepilogativo)</label>
                <input type="text" id="setVat" placeholder="es. P.IVA 01234567890" value={form.vat} onChange={(e) => setField('vat', e.target.value)} />

                <label htmlFor="setCurrency">Simbolo valuta</label>
                <input type="text" id="setCurrency" placeholder="€" style={{ maxWidth: '100px' }} value={form.currency} onChange={(e) => setField('currency', e.target.value)} />

                <label htmlFor="setTheme">Tema interfaccia</label>
                <select id="setTheme" value={form.theme} onChange={(e) => setField('theme', e.target.value)}>
                    <option value="dark">Tema scuro</option>
                    <option value="light">Tema chiaro</option>
                </select>
            </div>

            <div className="panel">
                <h2>Stampa</h2>
                <label htmlFor="setPaperWidth">Larghezza carta</label>
                <select id="setPaperWidth" value={String(form.paperWidth)} onChange={(e) => setField('paperWidth', parseInt(e.target.value, 10))}>
                    <option value="58">58 mm</option>
                    <option value="80">80 mm</option>
                </select>

                <div className="toggle-row">
                    <input type="checkbox" id="setShowPricesKitchen" checked={form.showPricesKitchen} onChange={(e) => setField('showPricesKitchen', e.target.checked)} />
                    <label style={{ margin: 0 }} htmlFor="setShowPricesKitchen">Mostra prezzi anche sui talloncini da cucina</label>
                </div>

                <div className="toggle-row">
                    <input type="checkbox" id="setAutoSummary" checked={form.autoSummary} onChange={(e) => setField('autoSummary', e.target.checked)} />
                    <label style={{ margin: 0 }} htmlFor="setAutoSummary">Includi sempre lo scontrino riepilogativo per il cliente</label>
                </div>
            </div>

            <div className="panel">
                <h2>Talloncini per categoria</h2>
                <p className="hint">
                    Per ogni categoria puoi scegliere cumulativo/non cumulativo, aggiungere 3 cm di carta bianca sopra il talloncino e decidere se stampare il talloncino.
                </p>
                <div id="categoryCumulativeList">
                    {categories.length === 0 ? (
                        <div className="empty-hint">Aggiungi piatti al menu per configurare le categorie.</div>
                    ) : (
                        categories.map((cat) => {
                            const cumulative = form.categoryCumulative?.[cat] !== false;
                            const spacer = form.categorySpacer3cm?.[cat] === true;
                            const printable = form.categoryPrintTicket?.[cat] !== false;
                            return (
                                <div key={cat} style={{ borderBottom: '1px solid #333', paddingBottom: '10px', marginBottom: '10px' }}>
                                    <strong style={{ fontSize: '15px' }}>{cat}</strong>
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', marginTop: '8px' }}>
                                        <label style={{ display: 'flex', alignItems: 'center', gap: '6px', margin: 0, fontSize: '12px', color: 'var(--text-dim)', cursor: 'pointer' }}>
                                            <input type="checkbox" checked={cumulative} onChange={(e) => setCategoryOpt(cat, 'categoryCumulative', e.target.checked)} /> Cumulativo
                                        </label>
                                        <label style={{ display: 'flex', alignItems: 'center', gap: '6px', margin: 0, fontSize: '12px', color: 'var(--text-dim)', cursor: 'pointer' }}>
                                            <input type="checkbox" checked={spacer} onChange={(e) => setCategoryOpt(cat, 'categorySpacer3cm', e.target.checked)} /> +3 cm sopra
                                        </label>
                                        <label style={{ display: 'flex', alignItems: 'center', gap: '6px', margin: 0, fontSize: '12px', color: 'var(--text-dim)', cursor: 'pointer' }}>
                                            <input type="checkbox" checked={printable} onChange={(e) => setCategoryOpt(cat, 'categoryPrintTicket', e.target.checked)} /> Stampa talloncino
                                        </label>
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
                <select id="setPrintMethod" value={form.printMethod} onChange={(e) => setField('printMethod', e.target.value)}>
                    <option value="dialog">Finestra di stampa di sistema (predefinito)</option>
                    <option value="rawbt">RawBT — invio diretto, senza finestre</option>
                </select>

                <div className="toggle-row">
                    <input type="checkbox" id="setRawbtCut" checked={form.rawbtCut} onChange={(e) => setField('rawbtCut', e.target.checked)} />
                    <label style={{ margin: 0 }} htmlFor="setRawbtCut">La mia stampante ha il taglierino automatico</label>
                </div>

                {form.rawbtCut && (
                    <div id="cutFeedWrap">
                        <label htmlFor="setRawbtCutFeed">Avanzamento carta prima del taglio (righe)</label>
                        <input
                            type="number" id="setRawbtCutFeed" min="3" max="20" step="1" style={{ maxWidth: '120px' }}
                            value={form.rawbtCutFeedLines}
                            onChange={(e) => setField('rawbtCutFeedLines', Math.max(3, Math.min(20, parseInt(e.target.value, 10) || 5)))}
                        />
                    </div>
                )}
            </div>

            <div className="panel">
                <h2>Etichetta dispositivo</h2>
                <label htmlFor="setDeviceTag">Etichetta di questo dispositivo</label>
                <input
                    type="text" id="setDeviceTag" maxLength="4" placeholder="es. A" style={{ maxWidth: '140px', textTransform: 'uppercase' }}
                    value={deviceTagInput} onChange={(e) => setDeviceTagInput(e.target.value)}
                />
                <button type="button" className="btn-teal" id="saveDeviceTagBtn" style={{ marginTop: '8px' }} onClick={handleSaveDeviceTag}>
                    Salva etichetta
                </button>
                <div className="status-line" id="deviceTagStatus" style={{ color: deviceTagStatusColor }}>{deviceTagStatus}</div>
            </div>

            <div className="panel">
                <h2>Contatore ordini</h2>
                <div id="counterPreview" className="hint">Prossimo numero: #{formatTicketNum(ticketCounter, deviceTag)}</div>
                <button type="button" className="btn-red" id="resetCounterBtn" style={{ padding: '9px 14px' }} onClick={resetCounter}>
                    Reimposta contatore a #0001
                </button>
            </div>

            <div className="panel">
                <h2>Credenziali amministratore</h2>
                <div className="form-row-2">
                    <div>
                        <label htmlFor="setNewUser">Nuovo utente</label>
                        <input type="text" id="setNewUser" placeholder={creds.username} value={newUser} onChange={(e) => setNewUser(e.target.value)} />
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