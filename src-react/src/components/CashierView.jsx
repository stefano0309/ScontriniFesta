const price = (value) => `${value.toFixed(2)} €`;

function groupByCategory(menu) {
  return menu.reduce((acc, dish) => {
    const category = dish.category?.trim() || 'Senza categoria';
    acc[category] = acc[category] || [];
    acc[category].push(dish);
    return acc;
  }, {});
}

export default function CashierView({
  menu,
  order,
  settings,
  ticketCounter,
  addToOrder,
  updateQty,
  removeOrderLine,
  clearOrder,
  checkout,
  onOpenAdmin,
  latestEditableSale,
  onEditLastOrder,
}) {
  const grouped = groupByCategory(menu.filter((dish) => dish.showInCashier !== false));
  const total = order.reduce((sum, line) => sum + Number(line.price) * Number(line.qty), 0);

  return (
    <div id="cashierView" className="cashier-view">
      <header className="cash-top">
        <div className="biz" id="bizNameLabel">
          {settings.bizName} <span>Ordini</span>
        </div>
        <div className="cash-top-actions">
          <div className="ticketno">#{String(ticketCounter).padStart(4, '0')}</div>
          <button type="button" className="admin-gear" title="Area amministrazione" onClick={onOpenAdmin}>
            ⚙
          </button>
        </div>
      </header>

      <div className="cash-body">
        <main className="dish-panel">
          {menu.length === 0 ? (
            <div className="empty-hint">Nessun piatto nel menu. Vai in Admin per aggiungerne.</div>
          ) : (
            Object.entries(grouped)
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([category, dishes]) => (
                <div key={category} className="cat-block">
                  <h3>{category}</h3>
                  <div className="dish-grid">
                    {dishes.map((dish) => {
                      const soldOut = Boolean(dish.maxQty && Number(dish.maxQty) <= 0);

                      return (
                        <button
                          key={dish.id}
                          type="button"
                          className={`dish-btn ${soldOut ? 'dish-btn-soldout' : ''}`}
                          disabled={soldOut}
                          onClick={() => addToOrder(dish)}
                        >
                          <span>
                            <span className="dish-name">{dish.name}</span>
                            {dish.type === 'combo' && dish.items?.length ? (
                              <span className="dish-combo">{dish.items.join(' · ')}</span>
                            ) : null}
                          </span>
                          <span className="p">{settings.currency} {Number(dish.price || 0).toFixed(2)}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))
          )}
        </main>

        <aside className="order-panel">
          <div className="order-panel-head">
            <h3>Ordine corrente</h3>
            <button
              type="button"
              className="admin-gear"
              title="Modifica ultimo ordine"
              disabled={!latestEditableSale}
              onClick={onEditLastOrder}
            >
              ✎
            </button>
          </div>

          <div id="lastOrderMeta">
            {latestEditableSale
              ? `Ultimo: #${String(latestEditableSale.ticket || latestEditableSale.orderNum || 0).padStart(4, '0')} · ${settings.currency} ${Number(latestEditableSale.total || 0).toFixed(2)}`
              : 'Nessun ultimo ordine modificabile.'}
          </div>

          <div id="orderLinesCashier">
            {order.length === 0 ? (
              <div className="order-empty">Tocca un piatto per aggiungerlo</div>
            ) : (
              order.map((line, index) => (
                <div key={`${line.id || line.name}-${index}`} className="oline">
                  <div className="nm">
                    {line.name}
                    {line.note ? <span className="nt">{line.note}</span> : null}
                  </div>
                  <div className="qtystep">
                    <button type="button" onClick={() => updateQty(index, -1)}>−</button>
                    <span>{line.qty}</span>
                    <button type="button" onClick={() => updateQty(index, 1)}>+</button>
                    <button type="button" className="rm-btn" onClick={() => removeOrderLine(index)}>
                      ✕
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          {order.length > 0 && (
            <>
              <div className="order-total-row" id="orderTotalRow" style={{ display: 'flex' }}>
                <span>Totale</span>
                <span id="orderTotalVal">{settings.currency} {total.toFixed(2)}</span>
              </div>
              <div className="order-hint">Verranno stampati {order.length} talloncini + scontrino riepilogativo.</div>
            </>
          )}

          <button type="button" id="printOrderBtn" disabled={order.length === 0} onClick={checkout}>
            🖨 Invia e Stampa
          </button>
          <button type="button" id="clearOrderCashierBtn" onClick={clearOrder}>
            Svuota ordine
          </button>
        </aside>
      </div>
    </div>
  );
}
