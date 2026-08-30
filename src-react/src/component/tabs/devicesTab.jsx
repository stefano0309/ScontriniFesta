import { useCassa } from '../../store/CassaContext';

function timeAgo(ts) {
    if (!ts) return '—';
    const d = typeof ts === 'number' ? new Date(ts) : new Date(ts);
    if (Number.isNaN(d.getTime())) return '—';
    const diffMs = Date.now() - d.getTime();
    const mins = Math.round(diffMs / 60000);
    if (mins < 1) return 'proprio ora';
    if (mins < 60) return `${mins} min fa`;
    const hours = Math.round(mins / 60);
    if (hours < 24) return `${hours} h fa`;
    return d.toLocaleString('it-IT');
}

function DevicesTab({ isActive = true }) {
    const { devices, rolesConfig, deviceId, setDeviceRole, removeDevice } = useCassa();

    const list = Object.values(devices || {}).sort((a, b) => (b.lastSeenAt || 0) - (a.lastSeenAt || 0));
    const roleOptions = Object.values(rolesConfig || {});

    const handleRemove = async (d) => {
        if (!window.confirm(`Rimuovere il dispositivo "${d.tag || d.deviceId}" dal registro? Se è ancora attivo si ripresenterà automaticamente alla prossima connessione.`)) return;
        await removeDevice(d.deviceId);
    };

    return (
        <div className={`tab-pane ${isActive ? 'active' : ''}`} id="devicesTab">
            <div className="panel">
                <h2>Dispositivi collegati</h2>
                <p className="hint">
                    Elenco dei dispositivi che si sono connessi a Firebase per questa cassa, con etichetta scontrini, stato online/offline e ultimo contatto. Assegna un ruolo per limitare cosa può fare ciascun dispositivo nell'area amministrazione.
                </p>
                <div id="devicesList">
                    {list.length === 0 ? (
                        <div className="empty-hint">Nessun dispositivo ancora registrato (serve una connessione a Firebase).</div>
                    ) : (
                        list.map((d) => (
                            <div key={d.deviceId} className="dish-row" style={{ alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                                <div>
                                    <strong>{d.tag || '—'}</strong>{d.deviceId === deviceId && <span className="dp"> (questo dispositivo)</span>}
                                    <span
                                        style={{
                                            display: 'inline-block', marginLeft: '8px', width: '8px', height: '8px', borderRadius: '50%',
                                            background: d.online ? 'var(--green, #2ecc71)' : 'var(--red, #e74c3c)', verticalAlign: 'middle',
                                        }}
                                        title={d.online ? 'Online' : 'Offline'}
                                    />
                                    <div className="dp" style={{ marginTop: '2px' }}>
                                        {d.platform || '—'} · {d.appVersion ? 'v' + d.appVersion : ''} · ultimo contatto {timeAgo(d.lastSeenAt)}
                                    </div>
                                </div>
                                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                    <select
                                        value={d.role || 'admin'}
                                        onChange={(e) => setDeviceRole(d.deviceId, e.target.value)}
                                    >
                                        {roleOptions.map((r) => (
                                            <option key={r.id} value={r.id}>{r.name}</option>
                                        ))}
                                    </select>
                                    <button type="button" className="btn-red" onClick={() => handleRemove(d)}>Rimuovi</button>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
}

export default DevicesTab;