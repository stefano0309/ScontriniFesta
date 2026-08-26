import { useEffect, useState } from 'react';

export default function PrintersTab() {
  const [printers, setPrinters] = useState(() => window.PrintersModule?.getSavedPrinters?.() || []);

  useEffect(() => {
    const sync = () => {
      setPrinters(window.PrintersModule?.getSavedPrinters?.() || []);
    };

    sync();
    window.addEventListener('printers:changed', sync);
    return () => window.removeEventListener('printers:changed', sync);
  }, []);

  const openModal = () => {
    if (typeof window !== 'undefined') {
      window.PrintersModule?.addPrinterModal?.();
    }
  };

  return (
    <div className="tab-pane active">
      <div className="panel">
        <h2>Stampanti disponibili</h2>
        <p className="hint">Configura le stampanti termiche ESC/POS per la stampa diretta via Bluetooth, LAN o USB.</p>
        <button type="button" className="btn-teal btn-block" style={{ marginBottom: 14 }} onClick={openModal}>
          + Aggiungi stampante
        </button>

        {printers.length === 0 ? (
          <div className="empty-hint">Nessuna stampante configurata.</div>
        ) : (
          printers.map((printer) => (
            <div key={printer.id} style={{ border: '1px solid var(--line)', borderRadius: 8, padding: 12, marginBottom: 10 }}>
              <div style={{ fontWeight: 700 }}>{printer.name || printer.id}</div>
              <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 3 }}>
                {printer.transport || '—'} · {printer.address || printer.id}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
