// HistoryTab.jsx
import { useState } from 'react';

function HistoryTab({ isActive, history = [] }) {
    const [search, setSearch] = useState('');
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');

    const filteredHistory = history.filter((item) => {
        const matchesSearch = item.ticketNo?.toLowerCase().includes(search.toLowerCase());
        const matchesFrom = dateFrom ? new Date(item.date) >= new Date(dateFrom) : true;
        const matchesTo = dateTo ? new Date(item.date) <= new Date(dateTo) : true;
        return matchesSearch && matchesFrom && matchesTo;
    });

    const totalRevenue = filteredHistory.reduce((acc, curr) => acc + (curr.total || 0), 0);
    const averageTicket = filteredHistory.length > 0 ? totalRevenue / filteredHistory.length : 0;

    const handleResetFilters = () => {
        setSearch('');
        setDateFrom('');
        setDateTo('');
    };

    return (
        <div className={`tab-pane ${isActive ? 'active' : ''}`} id="page-history">
            <div className="admin-history-topbar">
                <h2>Storico scontrini</h2>
            </div>

            <div className="admin-history-stats">
                <div className="admin-history-stat">
                    <span>Scontrini</span>
                    <strong id="adminHistoryCount">{filteredHistory.length}</strong>
                </div>
                <div className="admin-history-stat">
                    <span>Incasso</span>
                    <strong id="adminHistoryTotal">€{totalRevenue.toFixed(2)}</strong>
                </div>
                <div className="admin-history-stat">
                    <span>Media scontrino</span>
                    <strong id="adminHistoryAverage">€{averageTicket.toFixed(2)}</strong>
                </div>
            </div>

            <div className="admin-history-filters">
                <div className="admin-history-search">
                    <span>⌕</span>
                    <input
                        id="adminHistorySearch"
                        type="search"
                        placeholder="Cerca numero scontrino..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>
                <label htmlFor="adminHistoryDateFrom">
                    <span>Da</span>
                    <input
                        id="adminHistoryDateFrom"
                        type="date"
                        value={dateFrom}
                        onChange={(e) => setDateFrom(e.target.value)}
                    />
                </label>
                <label htmlFor="adminHistoryDateTo">
                    <span>A</span>
                    <input
                        id="adminHistoryDateTo"
                        type="date"
                        value={dateTo}
                        onChange={(e) => setDateTo(e.target.value)}
                    />
                </label>
                <button
                    type="button"
                    id="adminHistoryClearFilters"
                    className="secondary"
                    onClick={handleResetFilters}
                >
                    Reset
                </button>
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
                    {filteredHistory.length === 0 ? (
                        <div className="empty-hint" style={{ padding: '16px' }}>Nessun ordine trovato.</div>
                    ) : (
                        filteredHistory.map((item) => (
                            <div key={item.id} className="admin-history-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr 2fr 1fr auto', padding: '10px', borderBottom: '1px solid #333' }}>
                                <span>#{item.ticketNo}</span>
                                <span>{item.date}</span>
                                <span>{item.itemsCount} articoli</span>
                                <span>€{item.total.toFixed(2)}</span>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
}

export default HistoryTab;