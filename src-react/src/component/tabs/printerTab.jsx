import { useCassa } from '../../store/CassaContext';
import PrintersBridge from '../../module/printersBridge';

function PrinterTab({ isActive }) {
    const { printers, categories, printerAssignments, savePrinterAssignments, addPrinter, deletePrinter } = useCassa();

    const handlePrinterChange = (category, printerId) => {
        savePrinterAssignments({ ...printerAssignments, [category]: printerId });
    };

    const handleAddPrinter = async () => {
        // Prefer native bridge when available
        try {
            const res = PrintersBridge.addPrinterModal();
            const printer = res instanceof Promise ? await res : res;
            if (!printer) return;
            // If native bridge handled UI internally it may return null; otherwise add returned printer
            if (printer.name) addPrinter(printer);
        } catch (e) {
            console.error('Printer add failed:', e);
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
                    onClick={handleAddPrinter}
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
                                <button type="button" className="btn-red" onClick={() => deletePrinter(printer.id)}>
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
                                    value={printerAssignments[cat] || ''}
                                    onChange={(e) => handlePrinterChange(cat, e.target.value)}
                                >
                                    <option value="">Nessuna stampante (Predefinita)</option>
                                    {printers.map((p) => (
                                        <option key={p.id} value={p.id}>{p.name}</option>
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