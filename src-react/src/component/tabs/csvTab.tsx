// CsvTab.jsx
import { useState } from 'react';

function CsvTab({ isActive, onImportCsv }) {
    const [file, setFile] = useState(null);
    const [replace, setReplace] = useState(false);
    const [status, setStatus] = useState('');

    const handleImport = () => {
        if (!file) {
            setStatus('Seleziona un file CSV da importare.');
            return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            const content = e.target.result;
            const lines = content.split('\n');
            const parsedDishes = [];

            lines.forEach((line) => {
                const parts = line.split(/[,;]/);
                if (parts.length >= 3) {
                    const name = parts[0].trim();
                    const price = parseFloat(parts[1].trim());
                    const category = parts[2].trim();

                    if (name && !isNaN(price) && category) {
                        parsedDishes.push({ id: Date.now() + Math.random(), name, price, category, type: 'dish' });
                    }
                }
            });

            if (parsedDishes.length > 0) {
                if (onImportCsv) {
                    onImportCsv(parsedDishes, replace);
                }
                setStatus(`Importati con successo ${parsedDishes.length} piatti.`);
            } else {
                setStatus('Impossibile leggere piatti dal file CSV.');
            }
        };

        reader.readAsText(file);
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
                <div className="status-line" id="csvStatus">{status}</div>
            </div>
        </div>
    );
}

export default CsvTab;