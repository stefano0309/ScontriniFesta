import { useCassa } from '../../store/CassaContext';

function CloseTab({ isActive = true }) {
    const { salesLog, cashFloat, cashAdditions, cashAdditionsTotal, aggregateSalesLog, settings, printCloseSummary, resetClose } = useCassa();

    const additionsTotal = cashAdditionsTotal();
    const { totals, grandTotal, orders } = aggregateSalesLog();
    const expectedTotal = grandTotal + Number(cashFloat.amount || 0) + additionsTotal;
    const hasAnything = salesLog.length > 0 || cashAdditions.length > 0 || cashFloat.setAt;

    const handleReset = async () => {
        if (!hasAnything) return;
        if (!window.confirm(`Chiudere la cassa e azzerare i ${salesLog.length} ordini registrati? Verranno azzerati anche il fondo cassa e le aggiunte di contante, da reimpostare per la prossima serata. L'operazione non è reversibile.`)) return;
        await resetClose();
    };

    return (
        <div className={`tab-pane ${isActive ? 'active' : ''}`} id="closeTab">
            <div className="panel">
                <h2>Chiusura cassa</h2>
                <p className="hint">Riepilogo di tutti gli ordini inviati in stampa dall'ultima chiusura.</p>

                <div id="closeSummary">
                    {cashFloat.setAt && (
                        <div className="info-box" style={{ marginBottom: '14px' }}>
                            Fondo cassa iniziale: <b>{settings.currency} {Number(cashFloat.amount || 0).toFixed(2)}</b>{cashFloat.note ? ' — ' + cashFloat.note : ''}
                        </div>
                    )}

                    {cashAdditions.length > 0 && (
                        <div className="info-box" style={{ margin: '0 0 14px' }}>
                            <b>Contante aggiunto durante la serata</b> — totale <b>{settings.currency} {additionsTotal.toFixed(2)}</b> ({cashAdditions.length})
                            {cashAdditions.map((a, i) => {
                                const when = new Date(a.ts).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
                                return (
                                    <div className="dish-row" key={a._fbKey || i}>
                                        <div>{when}{a.deviceTag ? ' · ' + a.deviceTag : ''}{a.note ? ' — ' + a.note : ''}</div>
                                        <div className="dp">{settings.currency} {Number(a.amount || 0).toFixed(2)}</div>
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    {salesLog.length === 0 && cashAdditions.length === 0 ? (
                        <div className="empty-hint">Nessun ordine registrato dall'ultima chiusura.</div>
                    ) : (
                        <>
                            <div className="info-box" style={{ marginBottom: '14px' }}>
                                <b>{orders}</b> ordini registrati &middot; Incasso vendite <b>{settings.currency} {grandTotal.toFixed(2)}</b>
                                {(cashFloat.setAt || cashAdditions.length > 0) && (
                                    <><br />Totale atteso in cassa (fondo + incasso + aggiunte): <b>{settings.currency} {expectedTotal.toFixed(2)}</b></>
                                )}
                            </div>
                            {Object.keys(totals).sort().map((name) => (
                                <div className="dish-row" key={name}>
                                    <div>{name} <span className="dp">x{totals[name].qty}</span></div>
                                    <div className="dp">{settings.currency} {totals[name].revenue.toFixed(2)}</div>
                                </div>
                            ))}
                        </>
                    )}
                </div>

                <div style={{ display: 'flex', gap: '10px', marginTop: '16px', flexWrap: 'wrap' }}>
                    <button
                        type="button"
                        className="btn-teal"
                        id="printCloseBtn"
                        style={{ flex: 1, minWidth: '160px' }}
                        onClick={printCloseSummary}
                    >
                        🖨 Stampa riepilogo
                    </button>
                    <button
                        type="button"
                        className="btn-red"
                        id="resetCloseBtn"
                        style={{ flex: 1, minWidth: '160px', padding: '10px 14px' }}
                        onClick={handleReset}
                    >
                        Chiudi cassa e azzera
                    </button>
                </div>
            </div>
        </div>
    );
}

export default CloseTab;