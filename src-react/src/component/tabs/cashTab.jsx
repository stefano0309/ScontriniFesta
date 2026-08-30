import { useState } from 'react';
import { useCassa } from '../../store/CassaContext';

function CashTab({ isActive }) {
    const { cashFloat, cashAdditions, cashAdditionsTotal, settings, saveCashFloat, addCashAddition, removeCashAddition } = useCassa();

    const [cashFloatAmount, setCashFloatAmount] = useState('');
    const [cashFloatNote, setCashFloatNote] = useState('');
    const [cashFloatStatus, setCashFloatStatus] = useState('');

    const [addAmount, setAddAmount] = useState('');
    const [addNote, setAddNote] = useState('');
    const [addStatus, setAddStatus] = useState('');

    const handleSaveFloat = async () => {
        if (!cashFloatAmount || isNaN(cashFloatAmount) || Number(cashFloatAmount) < 0) {
            setCashFloatStatus('Inserisci un importo valido.');
            return;
        }
        const saved = await saveCashFloat({ amount: parseFloat(cashFloatAmount), note: cashFloatNote });
        setCashFloatStatus(saved ? 'Fondo cassa salvato.' : 'Fondo cassa salvato solo localmente (Firebase non disponibile).');
        setCashFloatAmount('');
        setCashFloatNote('');
        setTimeout(() => setCashFloatStatus(''), 3000);
    };

    const handleAddCash = async () => {
        if (!addAmount || isNaN(addAmount) || Number(addAmount) <= 0) {
            setAddStatus('Inserisci un importo maggiore di zero.');
            return;
        }
        await addCashAddition(parseFloat(addAmount), addNote);
        setAddStatus(`Aggiunti ${settings.currency} ${parseFloat(addAmount).toFixed(2)} al fondo cassa.`);
        setAddAmount('');
        setAddNote('');
        setTimeout(() => setAddStatus(''), 2500);
    };

    const handleRemove = async (entry) => {
        if (!window.confirm(`Eliminare l'aggiunta di ${settings.currency} ${Number(entry.amount || 0).toFixed(2)}?`)) return;
        await removeCashAddition(entry);
    };

    return (
        <div className={`tab-pane ${isActive ? 'active' : ''}`} id="cashFloatTab">
            <div className="panel">
                <h2>Fondo cassa iniziale</h2>
                <p className="hint">
                    Inserisci l'importo presente in cassa all'inizio della serata (fondo per il resto). Viene sommato all'incasso per calcolare il totale atteso in cassa a fine serata, ed è sincronizzato su tutti i dispositivi collegati. Si azzera automaticamente con "Chiudi cassa e azzera", pronto per la prossima serata.
                </p>
                <label htmlFor="setCashFloat">Importo fondo cassa</label>
                <input
                    type="number"
                    id="setCashFloat"
                    min="0"
                    step="0.01"
                    placeholder="0.00"
                    value={cashFloatAmount}
                    onChange={(e) => setCashFloatAmount(e.target.value)}
                />
                <label htmlFor="setCashFloatNote">Nota (facoltativa)</label>
                <input
                    type="text"
                    id="setCashFloatNote"
                    placeholder="es. 5 banconote da 20€, resto in monete"
                    value={cashFloatNote}
                    onChange={(e) => setCashFloatNote(e.target.value)}
                />
                <button
                    className="btn-amber btn-block"
                    id="saveCashFloatBtn"
                    style={{ marginTop: '10px' }}
                    onClick={handleSaveFloat}
                >
                    Salva fondo cassa
                </button>
                <div className="status-line" id="cashFloatStatus">{cashFloatStatus}</div>
                <div id="cashFloatCurrent" className="info-box" style={{ marginTop: '16px' }}>
                    {cashFloat.setAt ? (
                        <>
                            Fondo cassa attuale: <b>{settings.currency} {Number(cashFloat.amount || 0).toFixed(2)}</b> · impostato il {new Date(cashFloat.setAt).toLocaleString('it-IT')}
                            {cashFloat.note && <div><small>Nota: {cashFloat.note}</small></div>}
                        </>
                    ) : (
                        'Nessun fondo cassa impostato per questa serata.'
                    )}
                </div>
            </div>

            <div className="panel">
                <h2>Contante aggiunto durante la serata</h2>
                <p className="hint">
                    Usa questo per registrare contante aggiunto al banco a serata iniziata (es. resto portato da un altro punto cassa). Ogni aggiunta resta visibile in una sezione separata dello scontrino di chiusura cassa, con orario e dispositivo, e si somma al totale atteso in cassa. Si azzera insieme al fondo cassa alla chiusura.
                </p>
                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
                    <div style={{ flex: 1, minWidth: '120px' }}>
                        <label htmlFor="addCashAmount">Importo</label>
                        <input
                            type="number"
                            id="addCashAmount"
                            min="0"
                            step="0.01"
                            placeholder="0.00"
                            value={addAmount}
                            onChange={(e) => setAddAmount(e.target.value)}
                        />
                    </div>
                    <div style={{ flex: 2, minWidth: '180px' }}>
                        <label htmlFor="addCashNote">Nota (facoltativa)</label>
                        <input
                            type="text"
                            id="addCashNote"
                            placeholder="es. cambio portato dal bar"
                            value={addNote}
                            onChange={(e) => setAddNote(e.target.value)}
                        />
                    </div>
                    <button
                        className="btn-amber"
                        id="addCashBtn"
                        style={{ padding: '10px 16px', whiteSpace: 'nowrap' }}
                        onClick={handleAddCash}
                    >
                        + Aggiungi
                    </button>
                </div>
                <div className="status-line" id="cashAdditionsStatus">{addStatus}</div>
                <div id="cashAdditionsList" style={{ marginTop: '14px' }}>
                    {cashAdditions.length === 0 ? (
                        <div className="empty-hint">Nessuna aggiunta registrata per questa serata.</div>
                    ) : (
                        <>
                            <div className="info-box" style={{ marginBottom: '10px' }}>
                                Totale aggiunte: <b>{settings.currency} {cashAdditionsTotal().toFixed(2)}</b> ({cashAdditions.length})
                            </div>
                            {cashAdditions.map((a, i) => {
                                const when = new Date(a.ts).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
                                return (
                                    <div className="dish-row" key={a._fbKey || i}>
                                        <div>
                                            {settings.currency} {Number(a.amount || 0).toFixed(2)} <span className="dp">{when}{a.deviceTag ? ' · ' + a.deviceTag : ''}</span>
                                            {a.note && <><br /><span className="dp">{a.note}</span></>}
                                        </div>
                                        <button type="button" className="btn-red" style={{ padding: '6px 10px', fontSize: '12px' }} onClick={() => handleRemove(a)}>
                                            Elimina
                                        </button>
                                    </div>
                                );
                            })}
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}

export default CashTab;