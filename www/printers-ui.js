/* Tabby - thermal printer bridge for the static Capacitor web app. */
(function () {
  'use strict';

  const STORAGE_KEY = 'talloncini-cassa:printer-profiles';
  const ASSIGNMENTS_KEY = 'talloncini-cassa:printer-category-assignments';
  let thermalPrinter = null;
  let printers = [];
  let initialized = false;
  let discoverySubscription = null;
  let statusSubscription = null;

  const log = (...a) => console.log('[PrintersModule]', ...a);
  const warn = (...a) => console.warn('[PrintersModule]', ...a);
  const cap = () => window.Capacitor || null;

  function getThermalPrinter() {
    if (thermalPrinter) return thermalPrinter;
    const c = cap();
    if (!c) return null;
    // IMPORTANT: Capacitor Android injects native plugins here at document start.
    // The previous implementation only tried registerPlugin(), which is not
    // available in this static-web runtime and caused silent no-op discovery.
    thermalPrinter = c.Plugins?.ThermalPrinter || null;
    if (!thermalPrinter && typeof c.registerPlugin === 'function') {
      thermalPrinter = c.registerPlugin('ThermalPrinter');
    }
    return thermalPrinter;
  }

  function isNative() {
    const c = cap();
    return !!c && (typeof c.isNativePlatform !== 'function' || c.isNativePlatform());
  }

  function readJson(key, fallback) {
    try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; }
    catch (e) { warn('localStorage read', e); return fallback; }
  }
  function writeJson(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); return true; }
    catch (e) { warn('localStorage write', e); return false; }
  }
  const saved = () => Array.isArray(readJson(STORAGE_KEY, [])) ? readJson(STORAGE_KEY, []) : [];
  const assignments = () => readJson(ASSIGNMENTS_KEY, {}) || {};
  const notify = (m, error = false) => typeof window.flash === 'function' ? window.flash(m, error) : (error ? console.error(m) : console.log(m));
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

  function rememberPrinter(p) {
    if (!p?.id) return;
    const list = saved();
    const profile = { id:p.id, name:p.name || p.id, transport:p.transport || '', address:p.address || '', brand:p.brand || '', model:p.model || '', capabilities:p.capabilities || {} };
    const i = list.findIndex(x => x.id === p.id);
    if (i >= 0) list[i] = {...list[i], ...profile}; else list.push(profile);
    writeJson(STORAGE_KEY, list);
  }

  function merge(a, b) {
    const m = new Map();
    [...a, ...b].forEach(p => { if (p?.id) m.set(p.id, {...m.get(p.id), ...p}); });
    return [...m.values()];
  }

  async function checkPermissions() {
    const p = getThermalPrinter();
    if (!p) throw new Error('ThermalPrinter non esposto dal bridge Capacitor.');
    const result = p.checkPermissions ? await p.checkPermissions() : null;
    log('permission state:', result);
    return result;
  }

  async function requestPermissions() {
    const p = getThermalPrinter();
    if (!p) throw new Error('ThermalPrinter non esposto dal bridge Capacitor.');
    if (!p.requestPermissions) throw new Error('Il plugin non espone requestPermissions().');
    const result = await p.requestPermissions();
    log('permission request result:', result);
    return result;
  }

  async function discover(timeoutMs = 10000) {
    const p = getThermalPrinter();
    if (!p) throw new Error('Plugin ThermalPrinter non disponibile nel bridge Android.');
    if (!isNative()) throw new Error('Apri l\'app Android Capacitor per cercare stampanti.');

    const before = await checkPermissions().catch(e => { warn('checkPermissions', e); return null; });
    // This call must happen immediately from the user action path. Android 12+
    // can show the Nearby Devices dialog here when BLUETOOTH_SCAN/CONNECT are prompt.
    const after = await requestPermissions();
    log('permissions before/after:', before, after);

    const old = saved();
    const found = [];
    if (p.addListener) {
      try {
        if (discoverySubscription?.remove) await discoverySubscription.remove();
        discoverySubscription = await p.addListener('printerFound', e => {
          if (!e?.printer?.id) return;
          const i = found.findIndex(x => x.id === e.printer.id);
          if (i >= 0) found[i] = {...found[i], ...e.printer}; else found.push(e.printer);
          printers = merge(found, old);
          renderPrinters();
        });
      } catch (e) { warn('printerFound listener', e); }
    }

    const result = await p.discoverPrinters({timeoutMs});
    const discovered = Array.isArray(result?.printers) ? result.printers : [];
    printers = merge(discovered, old);
    printers.forEach(rememberPrinter);
    renderPrinters();
    log('discoverPrinters:', result);
    return printers;
  }

  async function connect(printerId, setAsDefault = false) {
    const p = getThermalPrinter();
    if (!p?.connectPrinter) throw new Error('connectPrinter() non disponibile.');
    const r = await p.connectPrinter({printerId, setAsDefault});
    if (!r?.connected) throw new Error('Connessione alla stampante fallita.');
    return r;
  }

  async function testPrint(printerId) {
    const p = getThermalPrinter();
    if (!p?.printText) throw new Error('printText() non disponibile.');
    await connect(printerId, true);
    return p.printText({printerId, encoding:'WPC1252', items:[
      {type:'text', value:'TABBY', style:{align:'center',bold:true,widthMultiplier:2,heightMultiplier:2}},
      {type:'divider', char:'-'},
      {type:'text', value:'TEST STAMPANTE', style:{align:'center',bold:true}},
      {type:'text', value:new Date().toLocaleString('it-IT'), style:{align:'center'}},
      {type:'feed', lines:2},
      {type:'cut', mode:'partial', feedBefore:2}
    ], autoReconnect:true});
  }

  async function printText(printerId, items, options = {}) {
    const p = getThermalPrinter();
    if (!p?.printText) throw new Error('printText() non disponibile.');
    let result;
    for (let i=0; i<Math.max(1, Number(options.copies)||1); i++) {
      result = await p.printText({printerId, items, encoding:options.encoding||'WPC1252', paperWidthMm:options.paperWidthMm, timeoutMs:options.timeoutMs||15000, autoReconnect:options.autoReconnect !== false, cut:options.cut===true, feedLines:options.feedLines ?? 3});
    }
    return result;
  }

  async function printReceipt({printerId,ticketNumber,title,lines,total,copies=1,openCashDrawer=false,paperWidthMm=58}) {
    const items=[
      {type:'text',value:title||'ORDINE',style:{align:'center',bold:true,widthMultiplier:2,heightMultiplier:2}},
      {type:'text',value:`Scontrino #${ticketNumber||''}`,style:{align:'center',bold:true}},
      {type:'divider',char:'-'}
    ];
    (lines||[]).forEach(l => { items.push({type:'text',value:`${Number(l.qty)||1} x ${l.name||''}  ${(Number(l.price)||0).toFixed(2)} €`}); if(l.note) items.push({type:'text',value:`  - ${l.note}`}); });
    items.push({type:'divider',char:'-'},{type:'text',value:`TOTALE  ${(Number(total)||0).toFixed(2)} €`,style:{align:'right',bold:true,widthMultiplier:2,heightMultiplier:2}});
    if(openCashDrawer) items.push({type:'cashDrawer',pin:2});
    items.push({type:'feed',lines:2},{type:'cut',mode:'partial',feedBefore:2});
    return printText(printerId,items,{copies,paperWidthMm});
  }

  async function setDefault(printerId) { const p=getThermalPrinter(); if(!p?.setDefaultPrinter) throw new Error('setDefaultPrinter() non disponibile.'); return p.setDefaultPrinter({printerId}); }
  async function disconnect(printerId) { const p=getThermalPrinter(); if(p?.disconnectPrinter) return p.disconnectPrinter({printerId}); }
  async function status(printerId) { const p=getThermalPrinter(); return p?.getPrinterStatus ? p.getPrinterStatus(printerId ? {printerId} : {}) : null; }
  async function remove(printerId) { const p=getThermalPrinter(); if(p?.removePrinter) await p.removePrinter({printerId}); writeJson(STORAGE_KEY,saved().filter(x=>x.id!==printerId)); printers=printers.filter(x=>x.id!==printerId); renderPrinters(); }

  function saveAssignment(category, printerId) {
    const a=assignments(); if(printerId) a[category]=printerId; else delete a[category]; writeJson(ASSIGNMENTS_KEY,a);
    if(window.settings){window.settings.categoryPrinters=a;try{window.safeSet?.('app-settings',window.settings);}catch(_){} }
  }

  function renderAssignments() {
    const el=document.getElementById('categoryAssignmentsContainer'); if(!el) return;
    const menu=Array.isArray(window.menu)?window.menu:[];
    const cats=[...new Set(menu.map(d=>(d.cat||'Senza categoria').trim()||'Senza categoria'))].sort(); const a=assignments();
    if(!cats.length){el.innerHTML='<div class="empty-hint">Aggiungi piatti al menu per configurare le categorie.</div>';return;}
    el.innerHTML=cats.map(cat=>`<div style="display:grid;grid-template-columns:1fr minmax(180px,300px);gap:10px;align-items:center;border-bottom:1px solid var(--line);padding:10px 0"><span>${esc(cat)}</span><select class="printer-assignment" data-category="${esc(cat)}"><option value="">Nessuna / default</option>${printers.map(p=>`<option value="${esc(p.id)}" ${a[cat]===p.id?'selected':''}>${esc(p.name||p.id)}</option>`).join('')}</select></div>`).join('');
    el.querySelectorAll('.printer-assignment').forEach(s=>s.onchange=()=>{saveAssignment(s.dataset.category,s.value);notify('Associazione categoria salvata');renderPrinters();});
  }

  function renderPrinters() {
    const el=document.getElementById('printersListContainer'); if(!el) return;
    const a=assignments();
    if(!printers.length){el.innerHTML='<div class="empty-hint">Nessuna stampante. Premi “Aggiungi stampante” per cercarla.</div>';renderAssignments();return;}
    el.innerHTML=printers.map(p=>`<div style="border:1px solid var(--line);border-radius:8px;padding:12px;margin-bottom:10px;display:flex;gap:10px;align-items:center;justify-content:space-between;flex-wrap:wrap"><div style="min-width:220px;flex:1"><b>${esc(p.name||p.id)}</b><div style="font-size:11px;color:var(--text-dim);margin-top:3px">${esc(p.transport||'—')} · ${esc(p.address||p.id)}</div><div style="font-size:11px;color:var(--text-dim);margin-top:3px">Categorie associate: ${Object.values(a).filter(x=>x===p.id).length}</div></div><div style="display:flex;gap:6px;flex-wrap:wrap"><button class="btn-teal printer-test" data-id="${esc(p.id)}">Test</button><button class="btn-amber printer-default" data-id="${esc(p.id)}">Predefinita</button><button class="btn-red printer-remove" data-id="${esc(p.id)}">Rimuovi</button></div></div>`).join('');
    el.querySelectorAll('.printer-test').forEach(b=>b.onclick=async()=>{b.disabled=true;try{await testPrint(b.dataset.id);notify('Test stampato');}catch(e){notify('Test fallito: '+(e?.message||e),true);}finally{b.disabled=false;}});
    el.querySelectorAll('.printer-default').forEach(b=>b.onclick=async()=>{try{await setDefault(b.dataset.id);notify('Stampante predefinita salvata');}catch(e){notify(e?.message||e,true);}});
    el.querySelectorAll('.printer-remove').forEach(b=>b.onclick=async()=>{if(confirm('Rimuovere questa stampante dalla configurazione?')){await remove(b.dataset.id);notify('Stampante rimossa');}});
    renderAssignments();
  }

  function renderDiscoveryResults(modal,list){
    const el=modal.querySelector('#printerDiscoveryResults');
    if(!list.length){el.innerHTML='<div class="empty-hint">Nessun risultato.</div>';return;}
    el.innerHTML=list.map(p=>`<div style="border:1px solid var(--line);border-radius:8px;padding:10px;margin-bottom:8px;display:flex;justify-content:space-between;gap:10px;align-items:center"><div><b>${esc(p.name||p.id)}</b><div style="font-size:11px;color:var(--text-dim)">${esc(p.transport||'')} · ${esc(p.address||p.id)}</div></div><button class="btn-amber printer-add-result" data-id="${esc(p.id)}">Usa questa</button></div>`).join('');
    el.querySelectorAll('.printer-add-result').forEach(b=>b.onclick=async()=>{b.disabled=true;try{await connect(b.dataset.id,true);rememberPrinter(printers.find(p=>p.id===b.dataset.id));renderPrinters();notify('Stampante collegata e predefinita');modal.remove();}catch(e){notify('Connessione fallita: '+(e?.message||e),true);b.disabled=false;}});
  }

  function addPrinterModal(){
    let modal=document.getElementById('printerDiscoveryModal'); if(modal)return;
    modal=document.createElement('div');modal.id='printerDiscoveryModal';modal.style.cssText='position:fixed;inset:0;z-index:20000;background:rgba(0,0,0,.65);display:flex;align-items:center;justify-content:center;padding:18px';
    modal.innerHTML='<div style="width:min(620px,100%);max-height:90vh;overflow:auto;background:var(--panel);color:var(--text);border:1px solid var(--line);border-radius:12px;padding:18px"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px"><h2 style="margin:0;color:var(--amber)">Aggiungi stampante</h2><button id="printerModalClose" class="btn-outline">Chiudi</button></div><p id="printerDiscoveryStatus" class="hint">Controllo permessi Bluetooth e ricerca stampanti.</p><button id="printerDiscoverBtn" class="btn-teal btn-block">🔎 Cerca stampanti</button><div id="printerDiscoveryResults" style="margin-top:14px"></div></div>';
    document.body.appendChild(modal);modal.querySelector('#printerModalClose').onclick=()=>modal.remove();
    modal.querySelector('#printerDiscoverBtn').onclick=async()=>{const b=modal.querySelector('#printerDiscoverBtn'),s=modal.querySelector('#printerDiscoveryStatus');b.disabled=true;s.textContent='Controllo permessi Bluetooth…';try{const list=await discover(10000);s.textContent=list.length?`${list.length} stampante/i trovata/e.`:'Nessuna stampante trovata. Controlla Bluetooth e associazione della stampante.';renderDiscoveryResults(modal,list);}catch(e){console.error('[PrintersModule]',e);s.textContent='Errore: '+(e?.message||e);renderDiscoveryResults(modal,[]);}finally{b.disabled=false;}};
  }

  async function init(){
    if(initialized){renderPrinters();return;} initialized=true; printers=saved(); renderPrinters();
    const p=getThermalPrinter(); log('Capacitor=',!!cap(),'native=',isNative(),'ThermalPrinter=',!!p,'Plugins=',Object.keys(cap()?.Plugins||{}));
    if(!p)return;
    try{await checkPermissions();}catch(e){warn('checkPermissions failed',e);}
    if(p.addListener){try{statusSubscription=await p.addListener('statusChange',e=>{if(e?.status?.printerId){const x=printers.find(p=>p.id===e.status.printerId);if(x)x.status=e.status;renderPrinters();}});}catch(e){warn('status listener',e);}}
  }

  window.PrintersModule={init,addPrinterModal,addPrinter:addPrinterModal,discover,getPrinters:()=>printers.slice(),getSavedPrinters:saved,getAssignments:assignments,saveAssignment,connect,disconnect,testPrint,printText,printReceipt,status,setDefault,remove,requestPermissions,checkPermissions,getPlugin:getThermalPrinter,isNative,render:renderPrinters};
  window.ThermalPrinter=getThermalPrinter();
  log('loaded; native=',isNative(),'plugin=',!!window.ThermalPrinter,'capacitor=',!!window.Capacitor);
})();
