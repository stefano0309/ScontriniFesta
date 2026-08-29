// CloseTab.jsx
function CloseTab({ isActive, closeData, onPrintSummary, onResetClose }) {
    return (
        <div className={`tab-pane ${isActive ? 'active' : ''}`} id="closeTab">
            <div className="panel">
                <h2>Chiusura cassa</h2>
                <p className="hint">Riepilogo di tutti gli ordini inviati in stampa dall'ultima chiusura.</p>
                
                <div id="closeSummary">
                    {closeData && closeData.ordersCount > 0 ? (
                        <div>
                            <p><strong>Ordini totali:</strong> {closeData.ordersCount}</p>
                            <p><strong>Totale incassato:</strong> €{closeData.totalAmount?.toFixed(2)}</p>
                        </div>
                    ) : (
                        <div className="empty-hint">Nessun ordine registrato dall'ultima chiusura.</div>
                    )}
                </div>

                <div style={{ display: 'flex', gap: '10px', marginTop: '16px', flexWrap: 'wrap' }}>
                    <button
                        type="button"
                        className="btn-teal"
                        id="printCloseBtn"
                        style={{ flex: 1, minWidth: '160px' }}
                        onClick={onPrintSummary}
                    >
                        🖨 Stampa riepilogo
                    </button>
                    <button
                        type="button"
                        className="btn-red"
                        id="resetCloseBtn"
                        style={{ flex: 1, minWidth: '160px', padding: '10px 14px' }}
                        onClick={onResetClose}
                    >
                        Chiudi cassa e azzera
                    </button>
                </div>
            </div>
        </div>
    );
}

export default CloseTab;