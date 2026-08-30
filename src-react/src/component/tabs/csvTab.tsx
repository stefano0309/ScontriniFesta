import { useState } from 'react';
import { useCassa } from '../../store/CassaContext';
import { parseCsvMenu } from '../../utils/csv';

function CsvTab({ isActive = true }) {
    const { importMenu } = useCassa();
    const [file, setFile] = useState(null);
    const [replace, setReplace] = useState(false);
    const [status, setStatus] = useState('');
    const [statusColor, setStatusColor] = useState('');

    const handleImport = () => {
        if (!file) {
            setStatus('Seleziona prima un file CSV.');
            setStatusColor('var(--red)');
            return;
        }
        const reader = new FileReader();
        reader.onload = async (e) => {
            const text = e.target.result;
            const { items, errors } = parseCsvMenu(text);
            if (items.length === 0) {
                setStatus('Nessun piatto valido trovato nel CSV. Controlla il formato.');
                setStatusColor('var(--red)');
                return;
            }
            if (replace && !window.confirm(`Sostituire l'intero menu con ${items.length} piatti importati?`)) return;
            await importMenu(items, replace);
            let msg = `Importati ${items.length} piatti.`;
            if (errors.length > 0) msg += ` ${errors.length} righe saltate.`;
            setStatus(msg);
            setStatusColor(errors.length > 0 ? 'var(--amber)' : 'var(--green)');
            if (errors.length > 0) console.warn('Errori import CSV:', errors);
            setFile(null);
        };
        reader.onerror = () => {
            setStatus('Errore nella lettura del file.');
            setStatusColor('var(--red)');
        };
        reader.readAsText(file, 'UTF-8');
    };

    return (
        <div className={`tab-pane ${isActive ? 'active' : ''}`} id="csvTab">
            <div className="panel">
                <h2>Importa menu da CSV</h2>
                <p className="hint">
                    Colonne attese: <code>nome,prezzo,categoria</code> (con o senza intestazione, rilevata da sola). Separatore <code>,</code> o <code>;</code>.
                </p>
                <input
                    type="file"
                    id="csvFile"
                    accept=".csv,text/csv"
                    style={{ marginBottom: '10px', width: '100%', color: 'var(--text-dim)', fontSize: '13px' }}
                    onChange={(e) => setFile(e.target.files[0])}
                />
                <div className="toggle-row">
                    <input
                        type="checkbox"
                        id="csvReplace"
                        checked={replace}
                        onChange={(e) => setReplace(e.target.checked)}
                    />
                    <label style={{ margin: 0 }} htmlFor="csvReplace">
                        Sostituisci il menu esistente invece di aggiungere
                    </label>
                </div>
                <button
                    type="button"
                    className="btn-teal btn-block"
                    id="importCsvBtn"
                    onClick={handleImport}
                >
                    ⇪ Importa CSV
                </button>
                <div className="status-line" id="csvStatus" style={{ color: statusColor }}>{status}</div>
            </div>
        </div>
    );
}

export default CsvTab;