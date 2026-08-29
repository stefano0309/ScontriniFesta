// CashTab.jsx
import { useState } from 'react';

function CashTab({ isActive, cashFloatData, onSaveCashFloat, onAddCash }) {
    const [cashFloat, setCashFloat] = useState('');
    const [cashFloatNote, setCashFloatNote] = useState('');
    const [cashFloatStatus, setCashFloatStatus] = useState('');
    
    const [addAmount, setAddAmount] = useState('');
    const [addNote, setAddNote] = useState('');
    const [addStatus, setAddStatus] = useState('');

    const handleSaveFloat = () => {
        if (!cashFloat || isNaN(cashFloat) || Number(cashFloat) < 0) {
            setCashFloatStatus('Inserisci un importo valido.');
            return;
        }
        if (onSaveCashFloat) {
            onSaveCashFloat({ amount: parseFloat(cashFloat), note: cashFloatNote });
        }
        setCashFloatStatus('Fondo cassa salvato con successo!');
        setCashFloat('');
        setCashFloatNote('');
    };

    const handleAddCash = () => {
        if (!addAmount || isNaN(addAmount) || Number(addAmount) <= 0) {
            setAddStatus('Inserisci un importo valido.');
            return;
        }
        if (onAddCash) {
            onAddCash({
                amount: parseFloat(addAmount),
                note: addNote,
                time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            });
        }
        setAddStatus('Contante aggiunto con successo!');
        setAddAmount('');
        setAddNote('');
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
                    value={cashFloat}
                    onChange={(e) => setCashFloat(e.target.value)}
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
                    {cashFloatData?.currentFloat ? (
                        <>
                            <strong>Fondo cassa attuale:</strong> € {cashFloatData.currentFloat.toFixed(2)}
                            {cashFloatData.note && <div><small>Nota: {cashFloatData.note}</small></div>}
                        </>
                    ) : (
                        'Nessun fondo cassa attualmente impostato.'
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
                    {cashFloatData?.additions && cashFloatData.additions.length > 0 ? (
                        <ul>
                            {cashFloatData.additions.map((item, index) => (
                                <li key={index}>
                                    [{item.time}] +€{item.amount.toFixed(2)} {item.note && `(${item.note})`}
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <div className="empty-hint">Nessuna aggiunta registrata.</div>
                    )}
                </div>
            </div>
        </div>
    );
}

export default CashTab;