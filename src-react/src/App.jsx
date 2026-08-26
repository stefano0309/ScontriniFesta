import { useEffect, useMemo, useRef, useState } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously } from 'firebase/auth';
import { getDatabase, onValue, ref, set } from 'firebase/database';
import CashierView from './components/CashierView';
import AdminView from './components/AdminView';
import SaleEditorModal from './components/SaleEditorModal';
import { initPrintersModule } from './lib/printers';
import { buildPrintPayload, formatTicketNum, sendViaRawBt } from './lib/pos';

const firebaseConfig = {
  apiKey: 'AIzaSyDp8d5_dJRef3xwA9VYhDusemMjXZ8xYRs',
  authDomain: 'cassa-festa-2026.firebaseapp.com',
  databaseURL: 'https://cassa-festa-2026-default-rtdb.europe-west1.firebasedatabase.app',
  projectId: 'cassa-festa-2026',
  storageBucket: 'cassa-festa-2026.firebasestorage.app',
  messagingSenderId: '1014481421953',
  appId: '1:1014481421953:web:3b209106ec7fede6782f80',
  measurementId: 'G-55S7V2QE37',
};

const defaultSettings = {
  bizName: 'La Mia Attività',
  footer: 'Grazie e arrivederci',
  vat: '',
  currency: '€',
  paperWidth: 58,
  showPricesKitchen: false,
  autoSummary: true,
  printMethod: 'rawbt',
  rawbtCut: false,
  rawbtCutFeedLines: 5,
  theme: 'dark',
  categoryCumulative: {},
  categorySpacer3cm: {},
  categoryPrintTicket: {},
};

const defaultMenu = [
  { id: 'pizza-margherita', name: 'Pizza Margherita', price: 12, category: 'Pizze', type: 'dish', showInCashier: true },
  { id: 'pasta-al-pomodoro', name: 'Pasta al pomodoro', price: 10, category: 'Primi', type: 'dish', showInCashier: true },
  { id: 'tagliata', name: 'Tagliata di manzo', price: 18, category: 'Secondi', type: 'dish', showInCashier: true },
  { id: 'menu-festa', name: 'Menu Festa', price: 22, category: 'Menù', type: 'combo', items: ['Pizza Margherita', 'Acqua'], showInCashier: true },
];

const defaultCashFloat = { amount: 0, note: '', setAt: null };
const defaultCredentials = { username: 'admin', password: 'admin' };

function readStorage(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function writeStorage(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // noop
  }
}

function normalizeSettings(raw = {}) {
  return {
    ...defaultSettings,
    ...raw,
    categoryCumulative: { ...defaultSettings.categoryCumulative, ...(raw.categoryCumulative || {}) },
    categorySpacer3cm: { ...defaultSettings.categorySpacer3cm, ...(raw.categorySpacer3cm || {}) },
    categoryPrintTicket: { ...defaultSettings.categoryPrintTicket, ...(raw.categoryPrintTicket || {}) },
  };
}

function App() {
  const [menu, setMenu] = useState(() => readStorage('tabby-menu', defaultMenu));
  const [order, setOrder] = useState(() => readStorage('tabby-order', []));
  const [salesLog, setSalesLog] = useState(() => readStorage('tabby-sales', []));
  const [settings, setSettings] = useState(() => normalizeSettings(readStorage('tabby-settings', defaultSettings)));
  const [ticketCounter, setTicketCounter] = useState(() => readStorage('tabby-counter', 1));
  const [cashFloat, setCashFloat] = useState(() => readStorage('tabby-cashFloat', defaultCashFloat));
  const [cashAdditions, setCashAdditions] = useState(() => readStorage('tabby-cashAdditions', []));
  const [creds, setCreds] = useState(() => readStorage('tabby-creds', defaultCredentials));
  const [deviceTag, setDeviceTag] = useState(() => readStorage('tabby-deviceTag', 'A1'));
  const [adminLoggedIn, setAdminLoggedIn] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [activeTab, setActiveTab] = useState('menuTab');
  const [loginData, setLoginData] = useState({ username: '', password: '' });
  const [loginError, setLoginError] = useState('');
  const [firebaseReady, setFirebaseReady] = useState(false);
  const [firebaseStatus, setFirebaseStatus] = useState('connessione');
  const firebaseRef = useRef(null);
  const firebaseInitRef = useRef(false);

  useEffect(() => {
    initPrintersModule();
  }, []);

  useEffect(() => {
    writeStorage('tabby-menu', menu);
  }, [menu]);

  useEffect(() => {
    writeStorage('tabby-order', order);
  }, [order]);

  useEffect(() => {
    writeStorage('tabby-sales', salesLog);
  }, [salesLog]);

  useEffect(() => {
    const nextSettings = normalizeSettings(settings);
    writeStorage('tabby-settings', nextSettings);
    document.documentElement.dataset.theme = nextSettings.theme || 'dark';
  }, [settings]);

  useEffect(() => {
    writeStorage('tabby-counter', ticketCounter);
  }, [ticketCounter]);

  useEffect(() => {
    writeStorage('tabby-cashFloat', cashFloat);
  }, [cashFloat]);

  useEffect(() => {
    writeStorage('tabby-cashAdditions', cashAdditions);
  }, [cashAdditions]);

  useEffect(() => {
    writeStorage('tabby-creds', creds);
  }, [creds]);

  useEffect(() => {
    writeStorage('tabby-deviceTag', deviceTag);
  }, [deviceTag]);

  useEffect(() => {
    if (!creds?.username || !creds?.password) {
      setCreds(defaultCredentials);
    }
  }, []);

  useEffect(() => {
    if (firebaseInitRef.current) return;
    firebaseInitRef.current = true;

    const firebaseApp = initializeApp(firebaseConfig);
    const auth = getAuth(firebaseApp);
    const db = getDatabase(firebaseApp);

    firebaseRef.current = { app: firebaseApp, auth, db };

    const hydrateRemote = async () => {
      try {
        await signInAnonymously(auth);
        setFirebaseReady(true);
        setFirebaseStatus('sincronizzato');

        const bind = (path, setter) => {
          onValue(ref(db, path), (snapshot) => {
            const value = snapshot.val();
            if (value !== null && value !== undefined) {
              setter(value);
            }
          });
        };

        bind('cassa/menu', (value) => setMenu(Object.values(value || {})));
        bind('cassa/settings', (value) => setSettings((current) => normalizeSettings({ ...current, ...value })));
        bind('cassa/sales', (value) => setSalesLog(Object.values(value || {})));
        bind('cassa/counters/react-client', (value) => typeof value === 'number' && setTicketCounter(value));
        bind('cassa/cashFloat', (value) => value && setCashFloat(value));
        bind('cassa/cashAdditions', (value) => value && setCashAdditions(Object.values(value)));
      } catch (error) {
        console.error('Firebase init error:', error);
        setFirebaseReady(false);
        setFirebaseStatus('offline');
      }
    };

    hydrateRemote();
  }, []);

  useEffect(() => {
    if (firebaseReady && !firebaseRef.current?.db) return;
    const { db } = firebaseRef.current;
    set(ref(db, 'cassa/menu'), Object.fromEntries(menu.map((dish) => [dish.id, dish]))).catch(() => undefined);
  }, [menu, firebaseReady]);

  useEffect(() => {
    if (firebaseReady && !firebaseRef.current?.db) return;
    const { db } = firebaseRef.current;
    set(ref(db, 'cassa/settings'), settings).catch(() => undefined);
  }, [settings, firebaseReady]);

  useEffect(() => {
    if (firebaseReady && !firebaseRef.current?.db) return;
    const { db } = firebaseRef.current;
    set(ref(db, 'cassa/sales'), Object.fromEntries(salesLog.map((sale) => [sale.id, sale]))).catch(() => undefined);
  }, [salesLog, firebaseReady]);

  useEffect(() => {
    if (firebaseReady && !firebaseRef.current?.db) return;
    const { db } = firebaseRef.current;
    set(ref(db, 'cassa/counters/react-client'), ticketCounter).catch(() => undefined);
  }, [ticketCounter, firebaseReady]);

  useEffect(() => {
    if (firebaseReady && !firebaseRef.current?.db) return;
    const { db } = firebaseRef.current;
    set(ref(db, 'cassa/cashFloat'), cashFloat).catch(() => undefined);
  }, [cashFloat, firebaseReady]);

  useEffect(() => {
    if (firebaseReady && !firebaseRef.current?.db) return;
    const { db } = firebaseRef.current;
    set(ref(db, 'cassa/cashAdditions'), Object.fromEntries(cashAdditions.map((item, index) => [item.id || `entry-${index}`, item]))).catch(() => undefined);
  }, [cashAdditions, firebaseReady]);

  const categories = useMemo(
    () => [...new Set(menu.map((dish) => dish.category || 'Senza categoria'))].sort(),
    [menu],
  );

  const totalSales = useMemo(
    () => salesLog.reduce((sum, sale) => sum + Number(sale.total || 0), 0),
    [salesLog],
  );

  const totalCashAdditions = useMemo(
    () => cashAdditions.reduce((sum, item) => sum + Number(item.amount || 0), 0),
    [cashAdditions],
  );

  const addToOrder = (dish) => {
    setOrder((current) => {
      const existing = current.find((line) => line.name === dish.name && !line.note);
      if (existing) {
        return current.map((line) =>
          line.name === dish.name && !line.note ? { ...line, qty: Number(line.qty) + 1 } : line,
        );
      }

      return [
        ...current,
        {
          id: dish.id,
          name: dish.name,
          price: Number(dish.price || 0),
          qty: 1,
          note: '',
        },
      ];
    });
  };

  const updateQty = (idx, delta) => {
    setOrder((current) => {
      const next = [...current];
      const line = next[idx];
      if (!line) return current;
      const updatedQty = Number(line.qty) + delta;
      if (updatedQty <= 0) next.splice(idx, 1);
      else next[idx] = { ...line, qty: updatedQty };
      return next;
    });
  };

  const removeOrderLine = (idx) => {
    setOrder((current) => current.filter((_, index) => index !== idx));
  };

  const clearOrder = () => {
    setOrder([]);
  };

  const checkout = () => {
    if (!order.length) return;

    const total = order.reduce((sum, line) => sum + Number(line.price) * Number(line.qty), 0);
    const sale = {
      id: crypto.randomUUID(),
      ticket: ticketCounter,
      total,
      createdAt: new Date().toISOString(),
      lines: order.map((line) => ({
        id: line.id,
        name: line.name,
        qty: line.qty,
        price: Number(line.price || 0),
      })),
    };

    const now = new Date();
    const payload = buildPrintPayload({
      lines: sale.lines,
      orderNum: ticketCounter,
      now,
      tag: deviceTag,
      menu,
      settings,
    });

    if (settings.printMethod === 'rawbt') {
      sendViaRawBt(payload);
    } else {
      const printArea = document.getElementById('printArea') || document.createElement('div');
      if (!printArea.id) {
        printArea.id = 'printArea';
        printArea.style.display = 'none';
        document.body.appendChild(printArea);
      }
      printArea.innerHTML = `
        <div class="print-page">
          <div class="p-head"><div class="biz">${settings.bizName || 'La Mia Attività'}</div><div class="kind">Scontrino riepilogativo</div><div class="ticket-number">#${formatTicketNum(ticketCounter, deviceTag)}</div><div class="meta">${now.toLocaleDateString('it-IT')} · ${now.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}</div></div>
          <hr>
          ${sale.lines.map((line) => `<div class="line"><span>${line.qty}x ${line.name}</span><span>${settings.currency || '€'} ${(Number(line.price || 0) * Number(line.qty || 0)).toFixed(2)}</span></div>${line.note ? `<div class="l-note">— ${line.note}</div>` : ''}`).join('')}
          <hr>
          <div class="total"><span>Totale</span><span>${settings.currency || '€'} ${total.toFixed(2)}</span></div>
          <div class="foot">${settings.footer || 'Grazie e arrivederci'}</div>
        </div>
      `;
      window.print();
    }

    setSalesLog((current) => [sale, ...current]);
    setTicketCounter((current) => current + 1);
    setOrder([]);
  };

  const addDish = (dish) => {
    setMenu((current) => [...current, dish]);
  };

  const removeDish = (dishId) => {
    setMenu((current) => current.filter((dish) => dish.id !== dishId));
  };

  const getCategories = () => categories;

  const resolvedCreds = creds?.username ? creds : defaultCredentials;

  const handleLogin = () => {
    const username = loginData.username.trim();
    const password = loginData.password.trim();

    if ((username === defaultCredentials.username && password === defaultCredentials.password)
      || (username === resolvedCreds.username && password === resolvedCreds.password)) {
      setAdminLoggedIn(true);
      setShowLoginModal(false);
      setLoginError('');
      setLoginData({ username: '', password: '' });
      setCreds({ username: resolvedCreds.username || defaultCredentials.username, password: resolvedCreds.password || defaultCredentials.password });
      return;
    }

    setLoginError('Credenziali non valide.');
  };

  const handleOpenAdmin = () => {
    setShowLoginModal(true);
    setLoginError('');
  };

  const handleCloseLogin = () => {
    setShowLoginModal(false);
    setLoginData({ username: '', password: '' });
    setLoginError('');
  };

  const handleResetCounter = () => {
    setTicketCounter(1);
  };

  const saveCashFloat = (amount, note) => {
    setCashFloat({ amount: Number(amount || 0), note: String(note || ''), setAt: new Date().toISOString() });
  };

  const addCashAddition = (amount, note) => {
    const value = Number(amount || 0);
    if (value <= 0) return;
    setCashAdditions((current) => [
      {
        id: crypto.randomUUID(),
        amount: value,
        note: String(note || ''),
        ts: new Date().toISOString(),
      },
      ...current,
    ]);
  };

  const resetCashSession = () => {
    setSalesLog([]);
    setCashFloat(defaultCashFloat);
    setCashAdditions([]);
  };

  const importCsvMenu = (items, replace = false) => {
    setMenu((current) => (replace ? items : [...current, ...items]));
  };

  const updateSettings = (nextSettings) => {
    setSettings(normalizeSettings(nextSettings));
  };

  const importSettingsFromPayload = (payload) => {
    if (!payload || typeof payload !== 'object') return false;
    if (Array.isArray(payload.menu)) setMenu(payload.menu);
    if (payload.settings && typeof payload.settings === 'object') {
      setSettings(normalizeSettings(payload.settings));
    }
    if (payload.creds && typeof payload.creds === 'object') {
      setCreds({ username: payload.creds.username || 'admin', password: payload.creds.password || 'admin' });
    }
    if (payload.deviceTag) setDeviceTag(String(payload.deviceTag).slice(0, 4).toUpperCase());
    return true;
  };

  const exportSettings = () => {
    const payload = {
      exportedAt: new Date().toISOString(),
      app: 'talloncini-cassa',
      version: 2,
      menu,
      settings,
      creds,
      deviceTag,
      cashFloat,
      cashAdditions,
      salesLog,
    };

    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const stamp = new Date().toISOString().slice(0, 10);
    link.href = url;
    link.download = `talloncini-cassa-impostazioni-${stamp}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const latestEditableSale = useMemo(() => {
    const editable = [...salesLog].filter((sale) => !sale.voided);
    if (!editable.length) return null;
    return editable.sort((a, b) => new Date(b.createdAt || b.ts || 0) - new Date(a.createdAt || a.ts || 0))[0];
  }, [salesLog]);

  const toggleSaleVoided = (saleId, nextState) => {
    setSalesLog((current) => current.map((sale) => {
      if (sale.id !== saleId) return sale;
      return {
        ...sale,
        voided: nextState,
        voidedAt: nextState ? new Date().toISOString() : null,
        voidedReason: nextState ? 'Annullato dall’admin' : '',
      };
    }));
  };

  const reprintSale = (sale) => {
    if (!sale) return;
    if (typeof window !== 'undefined') window.print();
  };

  const updateDishOption = (dishId, field, value) => {
    setMenu((current) => current.map((dish) => {
      if (dish.id !== dishId) return dish;
      return { ...dish, [field]: value };
    }));
  };

  const updateCategorySetting = (category, field, value) => {
    setSettings((current) => ({
      ...current,
      [field]: {
        ...(current[field] || {}),
        [category]: value,
      },
    }));
  };

  const saveEditedSale = (draftLines) => {
    if (!editorSale) return;
    const nextSale = {
      ...editorSale,
      lines: draftLines.map((line) => ({
        id: line.id || line.dishId || line.name,
        dishId: line.dishId || line.name,
        name: line.name,
        qty: Number(line.qty || 0),
        price: Number(line.price || 0),
        note: line.note || '',
      })),
    };
    nextSale.total = nextSale.lines.reduce((sum, line) => sum + Number(line.price || 0) * Number(line.qty || 0), 0);
    setSalesLog((current) => current.map((sale) => sale.id === editorSale.id ? nextSale : sale));
    setEditorSale(null);
  };

  return (
    <>
      <CashierView
        menu={menu}
        order={order}
        settings={settings}
        ticketCounter={ticketCounter}
        addToOrder={addToOrder}
        updateQty={updateQty}
        removeOrderLine={removeOrderLine}
        clearOrder={clearOrder}
        checkout={checkout}
        onOpenAdmin={handleOpenAdmin}
        latestEditableSale={latestEditableSale}
        onEditLastOrder={() => setEditorSale(latestEditableSale)}
      />

      <AdminView
        adminLoggedIn={adminLoggedIn}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        menu={menu}
        setMenu={setMenu}
        settings={settings}
        setSettings={updateSettings}
        salesLog={salesLog}
        ticketCounter={ticketCounter}
        setTicketCounter={setTicketCounter}
        addDish={addDish}
        removeDish={removeDish}
        getCategories={getCategories}
        importCsvMenu={importCsvMenu}
        handleResetCounter={handleResetCounter}
        cashFloat={cashFloat}
        cashAdditions={cashAdditions}
        totalSales={totalSales}
        totalCashAdditions={totalCashAdditions}
        saveCashFloat={saveCashFloat}
        addCashAddition={addCashAddition}
        resetCashSession={resetCashSession}
        firebaseReady={firebaseReady}
        firebaseStatus={firebaseStatus}
        creds={creds}
        setCreds={setCreds}
        deviceTag={deviceTag}
        setDeviceTag={setDeviceTag}
        exportSettings={exportSettings}
        importSettingsFromPayload={importSettingsFromPayload}
        latestEditableSale={latestEditableSale}
        onToggleSaleVoided={toggleSaleVoided}
        onReprintSale={reprintSale}
        updateDishOption={updateDishOption}
        updateCategorySetting={updateCategorySetting}
        onBackToCashier={() => setAdminLoggedIn(false)}
      />

      {editorSale && (
        <SaleEditorModal
          sale={editorSale}
          menu={menu}
          settings={settings}
          onClose={() => setEditorSale(null)}
          onSave={saveEditedSale}
        />
      )}

      {showLoginModal && (
        <div className="login-overlay show">
          <div className="login-card">
            <h3>Accesso amministratore</h3>
            <label>Utente</label>
            <input
              type="text"
              value={loginData.username}
              onChange={(event) => setLoginData((current) => ({ ...current, username: event.target.value }))}
              placeholder="admin"
            />
            <label>Password</label>
            <input
              type="password"
              value={loginData.password}
              onChange={(event) => setLoginData((current) => ({ ...current, password: event.target.value }))}
              placeholder="••••••"
            />
            <div className="login-err">{loginError}</div>
            <div className="login-actions">
              <button type="button" className="btn-outline" onClick={handleCloseLogin}>
                Annulla
              </button>
              <button type="button" className="btn-amber" onClick={handleLogin}>
                Accedi
              </button>
            </div>
          </div>
        </div>
      )}

      <div id="flashMsg" className="flash-msg" aria-live="polite" />
    </>
  );
}

export default App;
