// storage.js
// Persistenza locale "sicura": ogni scrittura mantiene anche una copia di
// backup, così se il salvataggio principale viene interrotto a metà (crash,
// batteria scarica, kill del processo Android) il caricamento successivo può
// recuperare l'ultima versione valida invece di perdere tutto.
//
// Porting 1:1 della logica originale (safeGet/safeSet, deviceId, deviceTag),
// reso indipendente da React così può essere usato sia dal Context sia da
// qualunque modulo di supporto (printing, firebase sync, ecc).

export const LS_PREFIX = 'talloncini-cassa:';

// Evento globale usato per notificare la UI di un problema di
// lettura/scrittura, senza accoppiare questo modulo a React.
function emitDataWarning(message) {
  window.dispatchEvent(new CustomEvent('data-warning', { detail: { message } }));
}

export function uid() {
  return 'd' + Math.random().toString(36).slice(2, 9);
}

export function safeSet(key, value) {
  const json = JSON.stringify(value);
  try {
    const current = localStorage.getItem(LS_PREFIX + key);
    if (current !== null) localStorage.setItem(LS_PREFIX + key + ':backup', current);
    localStorage.setItem(LS_PREFIX + key, json);
    return true;
  } catch (e) {
    emitDataWarning(
      'Memoria del dispositivo piena o non disponibile: alcuni dati potrebbero non essere salvati. Esporta subito un backup dalle Impostazioni ed elimina il resto degli ordini nella Chiusura Cassa.'
    );
    return false;
  }
}

export function safeGet(key, fallback) {
  try {
    const raw = localStorage.getItem(LS_PREFIX + key);
    if (raw === null) return fallback;
    return JSON.parse(raw);
  } catch (e) {
    try {
      const backup = localStorage.getItem(LS_PREFIX + key + ':backup');
      if (backup !== null) {
        emitDataWarning(`Dati "${key}" danneggiati: ripristinata l'ultima versione salvata correttamente. Controlla che sia tutto a posto.`);
        return JSON.parse(backup);
      }
    } catch (e2) {
      /* anche il backup è illeggibile */
    }
    emitDataWarning(`Impossibile leggere i dati "${key}". Se hai un file di backup, importalo dalle Impostazioni.`);
    return fallback;
  }
}

// ---------- Identità dispositivo ----------
// deviceId: UUID casuale, univoco per costruzione — mai in conflitto, usato
// come chiave "silenziosa" per la sincronizzazione (sales, cash additions).
let _deviceId = null;
export function getDeviceId() {
  if (_deviceId) return _deviceId;
  try {
    _deviceId = localStorage.getItem(LS_PREFIX + 'device-id');
    if (!_deviceId) {
      _deviceId = uid() + uid();
      localStorage.setItem(LS_PREFIX + 'device-id', _deviceId);
    }
  } catch (e) {
    _deviceId = uid() + uid(); // fallback in memoria se localStorage non è disponibile
  }
  return _deviceId;
}

// deviceTag: etichetta breve (es. "A", "B") che precede il numero scontrino
// — "A-0007" — per garantire unicità per costruzione tra dispositivi diversi,
// sempre, anche offline, senza coordinamento di rete.
let _deviceTag = null;
export function getDeviceTag() {
  if (_deviceTag) return _deviceTag;
  try {
    _deviceTag = localStorage.getItem(LS_PREFIX + 'device-tag');
  } catch (e) {
    /* noop */
  }
  if (!_deviceTag) {
    _deviceTag = getDeviceId().replace(/[^a-z0-9]/gi, '').slice(0, 2).toUpperCase() || 'X1';
    try {
      localStorage.setItem(LS_PREFIX + 'device-tag', _deviceTag);
    } catch (e) {
      /* noop */
    }
  }
  return _deviceTag;
}

export function setDeviceTagLocal(tag) {
  _deviceTag = tag;
  try {
    localStorage.setItem(LS_PREFIX + 'device-tag', tag);
  } catch (e) {
    /* noop */
  }
}

export function normalizeTagInput(raw) {
  return String(raw || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4);
}

// ---------- Bozza ordine corrente (sopravvive a crash/kill del processo) ----------
export function saveOrderDraft(order) {
  try {
    localStorage.setItem(LS_PREFIX + 'current-order-draft', JSON.stringify(order));
  } catch (e) {
    /* noop */
  }
}
export function clearOrderDraft() {
  try {
    localStorage.removeItem(LS_PREFIX + 'current-order-draft');
  } catch (e) {
    /* noop */
  }
}