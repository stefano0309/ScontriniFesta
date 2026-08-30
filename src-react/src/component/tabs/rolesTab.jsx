import { useState } from 'react';
import { useCassa } from '../../store/CassaContext';

const TAB_LABELS = {
    menuTab: 'Menu',
    csvTab: 'Importa CSV',
    cashFloatTab: 'Fondo Cassa',
    closeTab: 'Chiusura Cassa',
    'page-history': 'Storico',
    printersTab: 'Stampanti',
    devicesTab: 'Dispositivi',
    rolesTab: 'Ruoli',
    settingsTab: 'Impostazioni',
};

function RolesTab({ isActive = true }) {
    const { rolesConfig, addRole, updateRole, deleteRole } = useCassa();
    const [newRoleName, setNewRoleName] = useState('');

    const roles = Object.values(rolesConfig || {});

    const handleAddRole = async () => {
        if (!newRoleName.trim()) return;
        await addRole({ name: newRoleName.trim(), permissions: {} });
        setNewRoleName('');
    };

    const togglePermission = async (role, tabId, value) => {
        await updateRole(role.id, { permissions: { [tabId]: value } });
    };

    const renameRole = async (role) => {
        const name = window.prompt('Nome ruolo:', role.name);
        if (name === null || !name.trim()) return;
        await updateRole(role.id, { name: name.trim() });
    };

    return (
        <div className={`tab-pane ${isActive ? 'active' : ''}`} id="rolesTab">
            <div className="panel">
                <h2>Ruoli e permessi</h2>
                <p className="hint">
                    Definisci quali sezioni dell'area amministrazione sono visibili per ciascun ruolo. Assegna poi un ruolo a ogni dispositivo dalla vista Dispositivi. Il ruolo "Amministratore" vede sempre tutto e non può essere eliminato.
                </p>

                <div style={{ display: 'flex', gap: '10px', marginBottom: '16px' }}>
                    <input
                        type="text"
                        placeholder="Nome nuovo ruolo (es. Cucina)"
                        value={newRoleName}
                        onChange={(e) => setNewRoleName(e.target.value)}
                        style={{ flex: 1 }}
                    />
                    <button type="button" className="btn-amber" onClick={handleAddRole}>+ Aggiungi ruolo</button>
                </div>

                {roles.length === 0 ? (
                    <div className="empty-hint">Nessun ruolo configurato.</div>
                ) : (
                    roles.map((role) => (
                        <div key={role.id} style={{ borderBottom: '1px solid #333', paddingBottom: '14px', marginBottom: '14px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                <strong style={{ fontSize: '15px' }}>{role.name}{role.id === 'admin' && <span className="dp"> (predefinito)</span>}</strong>
                                <div style={{ display: 'flex', gap: '8px' }}>
                                    <button type="button" className="btn-teal" onClick={() => renameRole(role)}>Rinomina</button>
                                    {role.id !== 'admin' && (
                                        <button type="button" className="btn-red" onClick={() => deleteRole(role.id)}>Elimina</button>
                                    )}
                                </div>
                            </div>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                                {Object.entries(TAB_LABELS).map(([tabId, label]) => {
                                    const allowed = role.id === 'admin' ? true : role.permissions?.[tabId] !== false;
                                    return (
                                        <label
                                            key={tabId}
                                            style={{ display: 'flex', alignItems: 'center', gap: '6px', margin: 0, fontSize: '12px', color: 'var(--text-dim)', cursor: role.id === 'admin' ? 'default' : 'pointer' }}
                                        >
                                            <input
                                                type="checkbox"
                                                checked={allowed}
                                                disabled={role.id === 'admin'}
                                                onChange={(e) => togglePermission(role, tabId, e.target.checked)}
                                            />
                                            {label}
                                        </label>
                                    );
                                })}
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}

export default RolesTab;