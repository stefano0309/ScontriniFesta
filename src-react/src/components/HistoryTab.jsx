export default function HistoryTab({ salesLog, settings, onToggleSaleVoided, onReprintSale }) {
  const total = salesLog.reduce((sum, sale) => sum + Number(sale.total || 0), 0);
  const count = salesLog.length;
  const average = count ? total / count : 0;

  return (
    <div className="tab-pane active">
      <div className="admin-history-topbar">
        <h2>Storico scontrini</h2>
      </div>

      <div className="admin-history-stats">
        <div className="admin-history-stat">
          <span>Scontrini</span>
          <strong>{count}</strong>
        </div>
        <div className="admin-history-stat">
          <span>Incasso</span>
          <strong>{settings.currency} {total.toFixed(2)}</strong>
        </div>
        <div className="admin-history-stat">
          <span>Media scontrino</span>
          <strong>{settings.currency} {average.toFixed(2)}</strong>
        </div>
      </div>

      <div className="admin-history-table-card">
        <div className="admin-history-table-head">
          <span>Scontrino</span>
          <span>Data e ora</span>
          <span>Articoli</span>
          <span>Totale</span>
        </div>

        {salesLog.length === 0 ? (
          <div className="empty-hint">Nessun scontrino registrato.</div>
        ) : (
          salesLog.map((sale) => (
            <div className="admin-history-row" key={sale.id} style={{ gridTemplateColumns: '1.1fr 1.5fr 2.8fr 1fr auto' }}>
              <span>{sale.voided ? 'ANNULLATO · #' : '#'}{String(sale.ticket || sale.orderNum || 0).padStart(4, '0')}</span>
              <span>{new Date(sale.createdAt || sale.ts || Date.now()).toLocaleString('it-IT')}</span>
              <span>{(sale.lines || []).map((line) => `${line.qty}x ${line.name}`).join(', ')}</span>
              <span>{settings.currency} {Number(sale.total || 0).toFixed(2)}</span>
              <span style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                <button type="button" className="btn-teal" onClick={() => onReprintSale?.(sale)}>
                  Stampa
                </button>
                <button type="button" className={sale.voided ? 'btn-outline' : 'btn-red'} onClick={() => onToggleSaleVoided?.(sale.id, !sale.voided)}>
                  {sale.voided ? 'Ripristina' : 'Annulla'}
                </button>
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
