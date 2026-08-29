// PrinterTab.jsx
import { useState } from 'react';

function PrinterTab({ isActive, printers = [], categories = [], categoryAssignments = {}, onSaveAssignments, onAddPrinter, onDeletePrinter }) {
    const [assignments, setAssignments] = useState(categoryAssignments);

    const handlePrinterChange = (category, printerId) => {
        const updated = { ...assignments, [category]: printerId };
        setAssignments(updated);
        if (onSaveAssignments) {
            onSaveAssignments(updated);
        }
    };

    return (
        <div className={`tab-pane ${isActive ? 'active' : ''}`} id="printersTab">
            <div className="panel">
                <h2>Stampanti disponibili</h2>
                <p className="hint">Configura le stampanti termiche ESC/POS per la stampa diretta via Bluetooth, LAN o USB.</p>
                <button
                    type="button"
                    className="btn-teal btn-block"
                    id="addPrinterBtn"
                    style={{ marginBottom: '14px' }}
                    onClick={() => {
                        if (typeof window.PrintersModule !== 'undefined' && window.PrintersModule.addPrinterModal) {
                            window.PrintersModule.addPrinterModal();
                        } else if (onAddPrinter) {
                            onAddPrinter();
                        }
                    }}
                >
                    + Aggiungi stampante
                </button>
                <div id="printersListContainer">
                    {printers.length === 0 ? (
                        <div className="empty-hint">Nessuna stampante configurata.</div>
                    ) : (
                        printers.map((printer) => (
                            <div key={printer.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #333' }}>
                                <div>
                                    <strong>{printer.name}</strong> <small>({printer.type} - {printer.address})</small>
                                </div>
                                <button type="button" className="btn-red" onClick={() => onDeletePrinter && onDeletePrinter(printer.id)}>
                                    Rimuovi
                                </button>
                            </div>
                        ))
                    )}
                </div>
            </div>

            <div className="panel">
                <h2>Associa stampanti alle categorie</h2>
                <p className="hint">Per ogni categoria del menu, seleziona la stampante a cui inviare i talloncini.</p>
                <div id="categoryAssignmentsContainer">
                    {categories.length === 0 ? (
                        <div className="empty-hint">Aggiungi prima delle categorie nel menu.</div>
                    ) : (
                        categories.map((cat) => (
                            <div key={cat} className="form-row-2" style={{ marginBottom: '10px', alignItems: 'center' }}>
                                <span><strong>{cat}</strong></span>
                                <select
                                    value={assignments[cat] || ''}
                                    onChange={(e) => handlePrinterChange(cat, e.target.value)}
                                >
                                    <option value="">Nessuna stampante (Predefinita)</option>
                                    {printers.map((p) => (
                                        <option key={p.id} value={p.id}>
                                            {p.name}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
}

export default PrinterTab;