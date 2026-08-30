import { useMemo, useState } from 'react';
import { useCassa } from '../../store/CassaContext';
import { formatTicketNum } from '../../utils/format';

function ahDate(sale) {
    const raw = sale && (sale.ts || sale.timestamp || sale.date);
    if (!raw) return null;
    const d = new Date(raw);
    return Number.isNaN(d.getTime()) ? null : d;
}
function ahDateKey(sale) {
    const d = ahDate(sale);
    if (!d) return '';
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function ahLines(sale) {
    if (!sale) return [];
    if (Array.isArray(sale.lines)) return sale.lines;
    if (sale.lines && typeof sale.lines === 'object') return Object.values(sale.lines);
    return [];
}
function ahTotal(sale) {
    if (typeof sale?.total === 'number') return sale.total;
    return ahLines(sale).reduce((sum, l) => sum + (Number(l.qty) || 0) * (Number(l.price) || 0), 0);
}

function HistoryTab({ isActive }) {
    const { salesLog, settings, setSaleVoided, openSaleEditor, printReceipt } = useCassa();

    const [search, setSearch] = useState('');
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');
    const [detailSale, setDetailSale] = useState(null);

    const money = (v) => `${settings.currency} ${(Number(v) || 0).toFixed(2)}`;
    const label = (sale) => formatTicketNum(sale.orderNum, sale.deviceTag);

    const filtered = useMemo(() => {
        const term = search.trim().toLowerCase().replace(/^#/, '').replace(/\s+/g, '');
        return salesLog
            .filter(Boolean)
            .filter((sale) => {
                if (term) {
                    const lbl = label(sale).toLowerCase();
                    const bare = String(sale.orderNum);
                    if (!lbl.includes(term) && !bare.includes(term)) return false;
                }
                const key = ahDateKey(sale);
                if (dateFrom && (!key || key < dateFrom)) return false;
                if (dateTo && (!key || key > dateTo)) return false;
                return true;
            })
            .sort((a, b) => (ahDate(b)?.getTime() || 0) - (ahDate(a)?.getTime() || 0));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [salesLog, search, dateFrom, dateTo]);

    // Codici scontrino duplicati nell'intero registro: può capitare solo se
    // due dispositivi condividono per errore la stessa etichetta.
    const dupCounts = useMemo(() => {
        const counts = {};
        salesLog.forEach((sale) => { const l = label(sale); counts[l] = (counts[l] || 0) + 1; });
        return counts;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [salesLog]);

    const valid = filtered.filter((s) => !s.voided);
    const total = valid.reduce((s, sale) => s + ahTotal(sale), 0);
    const average = valid.length ? total / valid.length : 0;

    const handleResetFilters = () => { setSearch(''); setDateFrom(''); setDateTo(''); };

    const handleToggleVoid = async (sale) => {
        const num = label(sale);
        if (sale.voided) {
            if (!window.confirm(`Ripristinare lo scontrino #${num}? Tornerà a contare nei totali.`)) return;
            await setSaleVoided(sale, false);
        } else {
            if (!window.confirm(`Annullare lo scontrino #${num}? Non verrà più conteggiato nei totali e nella chiusura cassa (resta visibile qui per controllo). Usalo per scontrini battuti male o errori.`)) return;
            const reason = window.prompt("Motivo dell'annullamento (facoltativo):", '') || '';
            await setSaleVoided(sale, true, reason);
        }
        if (detailSale === sale) setDetailSale({ ...sale, voided: !sale.voided });
    };

    const handleReprint = async (sale) => {
        if (sale.voided && !window.confirm('Questo scontrino è stato annullato. Ristampare comunque?')) return;
        await printReceipt(sale);
    };

    return (
        <div className={`tab-pane ${isActive ? 'active' : ''}`} id="page-history">
            <div className="admin-history-topbar">
                <h2>Storico scontrini</h2>
            </div>

            <div className="admin-history-stats">
                <div className="admin-history-stat">
                    <span>Scontrini</span>
                    <strong id="adminHistoryCount">{valid.length}</strong>
                </div>
                <div className="admin-history-stat">
                    <span>Incasso</span>
                    <strong id="adminHistoryTotal">{money(total)}</strong>
                </div>
                <div className="admin-history-stat">
                    <span>Media scontrino</span>
                    <strong id="adminHistoryAverage">{money(average)}</strong>
                </div>
            </div>

            <div className="admin-history-filters">
                <div className="admin-history-search">
                    <span>⌕</span>
                    <input id="adminHistorySearch" type="search" placeholder="Cerca numero scontrino..." value={search} onChange={(e) => setSearch(e.target.value)} />
                </div>
                <label htmlFor="adminHistoryDateFrom">
                    <span>Da</span>
                    <input id="adminHistoryDateFrom" type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
                </label>
                <label htmlFor="adminHistoryDateTo">
                    <span>A</span>
                    <input id="adminHistoryDateTo" type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
                </label>
                <button type="button" id="adminHistoryClearFilters" className="secondary" onClick={handleResetFilters}>Reset</button>
            </div>

            <div className="admin-history-table-card">
                <div className="admin-history-table-head">
                    <span>Scontrino</span>
                    <span>Data e ora</span>
                    <span>Articoli</span>
                    <span>Totale</span>
                    <span></span>
                </div>
                <div id="adminHistoryList">
                    {filtered.length === 0 ? (
                        <div className="empty-hint" style={{ padding: '16px' }}>Nessuno scontrino trovato.</div>
                    ) : (
                        filtered.map((sale, i) => {
                            const lines = ahLines(sale);
                            const qty = lines.reduce((s, l) => s + (Number(l.qty) || 0), 0);
                            const lbl = label(sale);
                            const voided = !!sale.voided;
                            const isDup = dupCounts[lbl] > 1;
                            return (
                                <div key={sale._fbKey || i} className={`admin-history-row${voided ? ' ah-row-voided' : ''}`}>
                                    <div className="admin-history-number">
                                        #{lbl}{' '}
                                        {voided && <span className="ah-badge ah-badge-void">ANNULLATO</span>}
                                        {isDup && <span className="ah-badge ah-badge-dup" title="Numero scontrino presente più volte: probabile assegnazione doppia da due dispositivi offline">⚠ DOPPIO</span>}
                                    </div>
                                    <div className="muted">{ahDate(sale) ? ahDate(sale).toLocaleDateString('it-IT') + ' · ' + ahDate(sale).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' }) : '—'}</div>
                                    <div>{qty}</div>
                                    <div className="admin-history-total">{money(ahTotal(sale))}</div>
                                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '6px' }}>
                                        <button type="button" className="secondary" disabled={voided} onClick={() => openSaleEditor(sale)}>Modifica</button>
                                        <button type="button" className="secondary" onClick={() => handleToggleVoid(sale)}>{voided ? 'Ripristina' : 'Annulla'}</button>
                                        <button type="button" className="secondary" onClick={() => setDetailSale(sale)}>Dettagli</button>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
            </div>

            {detailSale && (
                <div className="admin-history-modal" style={{ display: 'flex' }}>
                    <div className="admin-history-modal-card">
                        <div className="admin-history-modal-head">
                            <div>
                                <div className="muted">Dettaglio scontrino</div>
                                <h2>#{label(detailSale)}{detailSale.voided ? ' — ANNULLATO' : ''}</h2>
                            </div>
                            <button type="button" className="icon-btn" onClick={() => setDetailSale(null)}>✕</button>
                        </div>
                        <div>
                            <div className="muted" style={{ margin: '10px 0 4px' }}>
                                {ahDate(detailSale) ? ahDate(detailSale).toLocaleDateString('it-IT') + ' · ' + ahDate(detailSale).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' }) : '—'}
                            </div>
                            {detailSale.voided && (
                                <div style={{ margin: '8px 0 14px', padding: '10px 12px', border: '1px solid var(--red)', borderRadius: '8px', background: 'rgba(220,53,69,.08)', color: 'var(--red)', fontSize: '13px' }}>
                                    Scontrino annullato{detailSale.voidedAt ? ' il ' + new Date(detailSale.voidedAt).toLocaleString('it-IT') : ''}.
                                    Non è conteggiato nei totali.{detailSale.voidedReason ? <><br />Motivo: {detailSale.voidedReason}</> : null}
                                </div>
                            )}
                            {ahLines(detailSale).map((line, idx) => {
                                const q = Number(line.qty) || 0;
                                const p = Number(line.price) || 0;
                                return (
                                    <div key={idx}>
                                        <div className="admin-history-detail-line">
                                            <span>{q} × {line.name || 'Prodotto'}</span>
                                            <span>{money(p)}</span>
                                            <strong>{money(q * p)}</strong>
                                        </div>
                                        {line.note && (
                                            <div style={{ gridColumn: '1/-1', fontSize: '11.5px', color: 'var(--text-dim)', fontStyle: 'italic', marginTop: '-6px' }}>— {line.note}</div>
                                        )}
                                    </div>
                                );
                            })}
                            <div className="admin-history-detail-total">
                                <span>TOTALE</span>
                                <span>{money(ahTotal(detailSale))}</span>
                            </div>
                        </div>
                        <div className="admin-history-modal-actions">
                            <button type="button" className="btn-teal" disabled={detailSale.voided} onClick={() => { openSaleEditor(detailSale); setDetailSale(null); }}>✎ Modifica ordine</button>
                            <button type="button" className="btn-red" onClick={() => handleToggleVoid(detailSale)}>{detailSale.voided ? 'Ripristina ordine' : 'Annulla ordine'}</button>
                            <button type="button" onClick={() => handleReprint(detailSale)}>🖨️ Ristampa scontrino</button>
                            <button type="button" className="secondary" onClick={() => setDetailSale(null)}>Chiudi</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default HistoryTab;