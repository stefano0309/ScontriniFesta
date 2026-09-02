import { useState } from 'react';
import { useCassa } from '../../store/CassaContext';
import { groupByCategory, formatTicketNum } from '../../utils/format';
import PaymentModal from '../modal/PaymentModal';

function CashierView({ onOpenAdmin }) {
  const {
    menu, order, ticketCounter, settings, deviceTag,
    addToOrder, changeQty, removeOrderLine, clearOrder, printOrder,
    dishSoldQty, dishRemainingQty, getKitchenTicketsForLines,
    getLatestEditableSale, openSaleEditor,
  } = useCassa();

  const [printing, setPrinting] = useState(false);

  const visibleMenu = menu.filter((d) => d.showInCashier !== false);
  const groups = groupByCategory(visibleMenu);
  const total = order.reduce((s, l) => s + l.price * l.qty, 0);
  const nTickets = getKitchenTicketsForLines(order).length;
  const names = order.map((l) => l.name).join(', ');

  const lastSale = getLatestEditableSale();

  const [showPayment, setShowPayment] = useState(false);

  const handlePrint = () => {
    if (order.length === 0 || printing) return;
    setShowPayment(true);
  };

  const handleClear = () => {
    if (order.length === 0) return;
    if (!window.confirm("Svuotare l'ordine corrente?")) return;
    clearOrder();
  };

  return (
    <div id="cashierView">
      <div className="cash-top">
        <div className="biz" id="bizNameLabel">{settings.bizName} <span>Ordini</span></div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div className="ticketno" id="nextTicketLabel">#{formatTicketNum(ticketCounter, deviceTag)}</div>
          <button className="admin-gear" id="openAdminBtn" title="Area amministrazione" onClick={onOpenAdmin}>⚙</button>
        </div>
      </div>

      <div className="cash-body">
        <div className="dish-panel">
          <div id="dishGrid">
            {menu.length === 0 ? (
              <div className="empty-hint">Nessun piatto nel menu. Vai in Admin per aggiungerne.</div>
            ) : visibleMenu.length === 0 ? (
              <div className="empty-hint">Nessun piatto abilitato per la cassa. Vai in Admin → Menu.</div>
            ) : (
              Object.keys(groups).sort().map((cat) => (
                <div className="cat-block" key={cat}>
                  <h3>{cat}</h3>
                  <div className="dish-grid">
                    {groups[cat].map((d) => {
                      const soldOut = d.showCountdown && d.maxQty && dishRemainingQty(d) <= 0;
                      const remaining = Math.max(0, dishRemainingQty(d));
                      const low = d.maxQty && remaining <= Math.max(3, Math.round(d.maxQty * 0.1));
                      return (
                        <button
                          key={d.id}
                          type="button"
                          className={`dish-btn${soldOut ? ' dish-btn-soldout' : ''}`}
                          disabled={soldOut}
                          onClick={() => addToOrder(d.id)}
                        >
                          <span>
                            <span style={{ display: 'block' }}>{d.name}</span>
                            {d.type === 'combo' && (
                              <span style={{ display: 'block', fontSize: '10.5px', color: 'var(--teal)', fontWeight: 500, marginTop: '2px' }}>
                                {(d.items || []).join(' · ')}
                              </span>
                            )}
                            {d.showSalesCounter && (
                              <span className="dish-status dish-counter">Venduti {dishSoldQty(d)}</span>
                            )}
                            {d.showCountdown && d.maxQty > 0 && (
                              <span className={`dish-status dish-countdown${low ? ' dish-countdown-low' : ''}`}>
                                {remaining <= 0 ? 'ESAURITO' : 'Rimasti ' + remaining}
                              </span>
                            )}
                          </span>
                          <span className="p">{settings.currency} {Number(d.price).toFixed(2)}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))
            )}
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
              disabled={!lastSale}
              onClick={() => openSaleEditor(lastSale)}
            >
              ✎
            </button>
          </div>
          <div id="lastOrderMeta">
            {lastSale
              ? `Ultimo: #${formatTicketNum(lastSale.orderNum, lastSale.deviceTag)} · ${(lastSale.lines || []).reduce((s, l) => s + (Number(l.qty) || 0), 0)} articoli · ${settings.currency} ${Number(lastSale.total || 0).toFixed(2)}`
              : 'Nessun ultimo ordine modificabile.'}
          </div>

          <div id="orderLinesCashier">
            {order.length === 0 ? (
              <div className="order-empty">Tocca un piatto per aggiungerlo</div>
            ) : (
              order.map((l, idx) => (
                <div className="oline" key={idx}>
                  <div className="nm">{l.name}{l.note ? <span className="nt">{l.note}</span> : null}</div>
                  <div className="qtystep">
                    <button type="button" onClick={() => changeQty(idx, -1)}>−</button>
                    <span>{l.qty}</span>
                    <button type="button" onClick={() => changeQty(idx, 1)}>+</button>
                    <button type="button" className="rm-btn" onClick={() => removeOrderLine(idx)}>✕</button>
                  </div>
                </div>
              ))
            )}
          </div>

          {order.length > 0 && (
            <div className="order-total-row" id="orderTotalRow" style={{ display: 'flex' }}>
              <span>Totale</span><span id="orderTotalVal">{settings.currency} {total.toFixed(2)}</span>
            </div>
          )}

          <div className="order-hint" id="orderHint">
            {order.length > 0 && `Verranno stampati ${nTickets} talloncini (${names})` + (settings.autoSummary ? ' + scontrino riepilogativo.' : '.')}
          </div>

          <button id="printOrderBtn" disabled={order.length === 0 || printing} onClick={handlePrint}>
            🖨 Invia e Stampa
          </button>
          {showPayment && <PaymentModal onClose={() => setShowPayment(false)} />}
          <button id="clearOrderCashierBtn" onClick={handleClear}>Svuota ordine</button>
        </div>
      </div>
    </div>
  );
}

export default CashierView;