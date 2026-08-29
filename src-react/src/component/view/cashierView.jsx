function CashierView({ onOpenAdmin }) {
    return (
        <>
            <div id="cashierView">
                <div className="cash-top">
                    <div className="biz" id="bizNameLabel">Cassa <span>Ordini</span></div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div className="ticketno" id="nextTicketLabel">#0001</div>
                        <button 
                            className="admin-gear" 
                            id="openAdminBtn" 
                            title="Area amministrazione"
                            onClick={onOpenAdmin}
                        >
                            ⚙
                        </button>
                    </div>
                </div>

                <div className="cash-body">
                    <div className="dish-panel">
                        <div id="dishGrid">
                            <div className="empty-hint">Nessun piatto nel menu. Vai in Admin per aggiungerne.</div>
                        </div>
                    </div>

                    <div className="order-panel">
                        <div className="order-panel-head">
                            <h3>Ordine corrente</h3>
                            <button 
                                type="button" 
                                className="admin-gear" 
                                id="editLastOrderBtn" 
                                title="Modifica ultimo ordine" 
                                disabled
                            >
                                ✎
                            </button>
                        </div>
                        <div id="lastOrderMeta">Nessun ultimo ordine modificabile.</div>
                        <div id="orderLinesCashier">
                            <div className="order-empty">Tocca un piatto per aggiungerlo</div>
                        </div>
                        <div className="order-total-row" id="orderTotalRow" style={{ display: 'none' }}>
                            <span>Totale</span><span id="orderTotalVal">€ 0,00</span>
                        </div>
                        <div className="order-hint" id="orderHint"></div>
                        <button id="printOrderBtn" disabled>🖨 Invia e Stampa</button>
                        <button id="clearOrderCashierBtn">Svuota ordine</button>
                    </div>
                </div>
            </div>

            <div id="flashMsg" className="flash-msg"></div>
            <div id="dataWarningBanner">
                <span id="dataWarningText">Attenzione: problema di salvataggio dati.</span>
                <button type="button" id="dataWarningDismiss">Ho capito</button>
            </div>
        </>
    );
}

export default CashierView;