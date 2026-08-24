/**
 * Modulo di configurazione stampanti nella webapp.
 * Integrato nel tab "Stampanti" delle Impostazioni.
 * Comunica con AndroidPrinterInterface via JavaScript bridge.
 */
(function() {
  let printers = [];
  let selectedPrinterForEdit = null;
  let categoryPrinterAssignments = {};
  let categoryPrinterCopies = {};

  window.PrintersModule = {
    init: initPrinters,
    render: renderPrinters,
    addPrinterModal: showAddPrinterModal,
    deletePrinter: deletePrinter,
    testPrinter: testPrinter,
    savePrinterConfig: savePrinterConfig,
    setCategoryPrinter: setCategoryPrinter,
    getCategoryPrinter: getCategoryPrinter,
    setCategoryEnabled: setCategoryPrinterEnabled,
    reloadPrinters: reloadPrinters
  };

  function initPrinters() {
    loadPrintersFromAndroid();
    renderPrinters();
    renderCategoryAssignments();
  }

  function loadPrintersFromAndroid() {
    if (typeof AndroidPrinter === 'undefined') {
      console.error('AndroidPrinter non disponibile - il bridge JavaScript-Android non è stato registrato correttamente');
      printers = [];
      return;
    }

    try {
      const json = AndroidPrinter.getPrinters();
      if (!json) {
        console.warn('getPrinters ha ritornato null');
        printers = [];
        return;
      }
      printers = JSON.parse(json);
      console.log('Caricate ' + printers.length + ' stampanti');
    } catch (e) {
      console.error('Errore nel caricamento stampanti:', e);
      console.error('Risposta ricevuta:', AndroidPrinter.getPrinters());
      printers = [];
    }
  }

  function reloadPrinters() {
    loadPrintersFromAndroid();
    renderPrinters();
    renderCategoryAssignments();
  }

  function renderPrinters() {
    const container = document.getElementById('printersListContainer');
    if (!container) {
      console.warn('printersListContainer non trovato');
      return;
    }

    if (printers.length === 0) {
      container.innerHTML = '<div class="empty-hint">Nessuna stampante configurata. Aggiungine una.</div>';
      return;
    }

    const html = printers.map(p => `
      <div class="printer-card" style="padding:12px; background:var(--panel-2); border-radius:8px; margin-bottom:10px; border:1px solid var(--line);">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
          <div>
            <div style="font-weight:600; font-size:14px;">${escapeHtml(p.name)}</div>
            <div style="font-size:12px; color:var(--text-dim); margin-top:4px;">
              ${p.type === 'bluetooth' ? '📱 Bluetooth' : p.type === 'network' ? '🌐 LAN' : '🔌 USB'}
              ${p.enabled ? ' • Abilitata' : ' • Disabilitata'}
            </div>
          </div>
          <div style="display:flex; gap:6px;">
            <button class="btn-teal" onclick="PrintersModule.testPrinter('${escapeHtml(p.id)}')" style="padding:6px 10px; font-size:12px;">Test</button>
            <button class="btn-teal" onclick="PrintersModule.editPrinter('${escapeHtml(p.id)}')" style="padding:6px 10px; font-size:12px;">Modifica</button>
            <button class="btn-red" onclick="PrintersModule.deletePrinter('${escapeHtml(p.id)}')" style="padding:6px 10px; font-size:12px;">Elimina</button>
          </div>
        </div>
        <div id="printer-status-${escapeHtml(p.id)}" style="font-size:11px; color:var(--text-dim);">—</div>
      </div>
    `).join('');

    container.innerHTML = html;

    // Aggiorna stato di ogni stampante
    printers.forEach(p => {
      updatePrinterStatus(p.id);
    });
  }

  function updatePrinterStatus(printerId) {
    if (typeof AndroidPrinter === 'undefined') return;

    try {
      const statusJson = AndroidPrinter.getPrinterStatus(printerId);
      const status = JSON.parse(statusJson);
      const el = document.getElementById('printer-status-' + printerId);
      if (el) {
        if (status.status === 'connected') {
          el.textContent = '✓ Connessa';
          el.style.color = 'var(--green)';
        } else if (status.status === 'error') {
          el.textContent = '✗ Errore: ' + (status.message || 'sconosciuto');
          el.style.color = 'var(--red)';
        } else {
          el.textContent = '○ Non connessa';
          el.style.color = 'var(--text-dim)';
        }
      }
    } catch (e) {
      console.error('Errore nel caricamento stato stampante:', e);
    }
  }

  function showAddPrinterModal() {
    const html = `
      <div id="addPrinterModal" style="position:fixed; inset:0; background:rgba(0,0,0,0.6); display:flex; align-items:center; justify-content:center; z-index:9000;">
        <div style="background:var(--panel); padding:24px; border-radius:12px; border:1px solid var(--line); width:min(500px,90vw); max-height:80vh; overflow-y:auto;">
          <h2 style="margin:0 0 14px; color:var(--amber); font-size:16px;">Aggiungi stampante</h2>
          
          <label style="font-size:12px; color:var(--text-dim); display:block; margin-bottom:4px;">Nome stampante</label>
          <input id="newPrinterName" type="text" placeholder="es. Stampante Bar" style="width:100%; margin-bottom:12px; padding:9px 10px; border:1px solid var(--line); border-radius:6px; background:var(--panel-2); color:var(--text); font-size:14px;">
          
          <label style="font-size:12px; color:var(--text-dim); display:block; margin-bottom:4px;">Tipo di connessione</label>
          <select id="newPrinterType" onchange="updatePrinterTypeFields()" style="width:100%; margin-bottom:12px; padding:9px 10px; border:1px solid var(--line); border-radius:6px; background:var(--panel-2); color:var(--text); font-size:14px;">
            <option value="bluetooth">Bluetooth</option>
            <option value="network">LAN (TCP/IP)</option>
            <option value="usb">USB OTG</option>
          </select>

          <div id="btFields" style="display:block; margin-bottom:12px;">
            <label style="font-size:12px; color:var(--text-dim); display:block; margin-bottom:4px;">Indirizzo Bluetooth (MAC)</label>
            <input id="newPrinterBtAddr" type="text" placeholder="es. AA:BB:CC:DD:EE:FF" style="width:100%; margin-bottom:8px; padding:9px 10px; border:1px solid var(--line); border-radius:6px; background:var(--panel-2); color:var(--text); font-size:14px;">
            <label style="font-size:12px; color:var(--text-dim); display:block; margin-bottom:4px;">Nome Bluetooth</label>
            <input id="newPrinterBtName" type="text" placeholder="es. CSN-58II" style="width:100%; padding:9px 10px; border:1px solid var(--line); border-radius:6px; background:var(--panel-2); color:var(--text); font-size:14px;">
          </div>

          <div id="netFields" style="display:none; margin-bottom:12px;">
            <label style="font-size:12px; color:var(--text-dim); display:block; margin-bottom:4px;">Indirizzo IP</label>
            <input id="newPrinterNetAddr" type="text" placeholder="es. 192.168.1.50" style="width:100%; margin-bottom:8px; padding:9px 10px; border:1px solid var(--line); border-radius:6px; background:var(--panel-2); color:var(--text); font-size:14px;">
            <label style="font-size:12px; color:var(--text-dim); display:block; margin-bottom:4px;">Porta TCP</label>
            <input id="newPrinterNetPort" type="number" placeholder="9100" value="9100" style="width:100%; padding:9px 10px; border:1px solid var(--line); border-radius:6px; background:var(--panel-2); color:var(--text); font-size:14px;">
          </div>

          <div id="usbFields" style="display:none; margin-bottom:12px;">
            <label style="font-size:12px; color:var(--text-dim); display:block; margin-bottom:4px;">Vendor ID (hex)</label>
            <input id="newPrinterUsbVid" type="text" placeholder="es. 0483" style="width:100%; margin-bottom:8px; padding:9px 10px; border:1px solid var(--line); border-radius:6px; background:var(--panel-2); color:var(--text); font-size:14px;">
            <label style="font-size:12px; color:var(--text-dim); display:block; margin-bottom:4px;">Product ID (hex)</label>
            <input id="newPrinterUsbPid" type="text" placeholder="es. 3105" style="width:100%; padding:9px 10px; border:1px solid var(--line); border-radius:6px; background:var(--panel-2); color:var(--text); font-size:14px;">
          </div>

          <div style="display:flex; gap:10px; margin-top:16px;">
            <button class="btn-outline" onclick="closeAddPrinterModal()" style="flex:1; padding:10px; border-radius:8px;">Annulla</button>
            <button class="btn-amber" onclick="confirmAddPrinter()" style="flex:1; padding:10px; border-radius:8px;">Aggiungi</button>
          </div>
        </div>
      </div>`;

    document.body.insertAdjacentHTML('beforeend', html);
  }

  window.updatePrinterTypeFields = function() {
    const type = document.getElementById('newPrinterType').value;
    document.getElementById('btFields').style.display = type === 'bluetooth' ? 'block' : 'none';
    document.getElementById('netFields').style.display = type === 'network' ? 'block' : 'none';
    document.getElementById('usbFields').style.display = type === 'usb' ? 'block' : 'none';
  };

  window.closeAddPrinterModal = function() {
    const modal = document.getElementById('addPrinterModal');
    if (modal) modal.remove();
  };

  window.confirmAddPrinter = function() {
    const name = document.getElementById('newPrinterName').value.trim();
    const type = document.getElementById('newPrinterType').value;
    
    if (!name) {
      alert('Inserisci un nome per la stampante');
      return;
    }

    let config = '';
    if (type === 'bluetooth') {
      const addr = document.getElementById('newPrinterBtAddr').value.trim();
      const btName = document.getElementById('newPrinterBtName').value.trim();
      if (!addr) {
        alert('Inserisci l\'indirizzo Bluetooth');
        return;
      }
      config = `address=${addr},name=${btName}`;
    } else if (type === 'network') {
      const addr = document.getElementById('newPrinterNetAddr').value.trim();
      const port = document.getElementById('newPrinterNetPort').value.trim();
      if (!addr) {
        alert('Inserisci l\'indirizzo IP');
        return;
      }
      config = `address=${addr},port=${port}`;
    } else if (type === 'usb') {
      const vid = document.getElementById('newPrinterUsbVid').value.trim();
      const pid = document.getElementById('newPrinterUsbPid').value.trim();
      if (!vid) {
        alert('Inserisci Vendor ID');
        return;
      }
      config = `vid=${vid},pid=${pid}`;
    }

    if (typeof AndroidPrinter === 'undefined') {
      alert('AndroidPrinter bridge non disponibile. Verifica che l\'app sia correttamente compilata.');
      console.error('AndroidPrinter is undefined - bridge not registered');
      return;
    }

    try {
      const printerId = AndroidPrinter.addPrinter(name, type, config);
      if (printerId && printerId !== '') {
        flash('✓ Stampante aggiunta con successo');
        closeAddPrinterModal();
        setTimeout(() => reloadPrinters(), 500);
      } else {
        alert('Errore: impossibile aggiungere la stampante. Verifica i dettagli.');
      }
    } catch (e) {
      console.error('confirmAddPrinter exception:', e);
      alert('Errore JavaScript: ' + e.message);
    }
  };

  window.PrintersModule.deletePrinter = function(printerId) {
    if (!confirm('Eliminare questa stampante?')) return;
    
    try {
      AndroidPrinter.deletePrinter(printerId);
      flash('Stampante eliminata');
      reloadPrinters();
    } catch (e) {
      alert('Errore: ' + e.message);
    }
  };

  window.PrintersModule.testPrinter = function(printerId) {
    if (typeof AndroidPrinter === 'undefined') {
      alert('AndroidPrinter non disponibile');
      return;
    }

    const printer = printers.find(p => p.id === printerId);
    if (!printer) {
      alert('Stampante non trovata');
      return;
    }

    flash('Test di stampa in corso su "' + printer.name + '"...');

    try {
      // BUG FIX: prima veniva chiamato testPrint('__TEST__'), una categoria
      // fittizia a cui non è mai assegnata alcuna stampante, quindi il test
      // falliva sempre indipendentemente dal pulsante premuto. Ora si testa
      // direttamente la stampante scelta tramite il suo ID.
      AndroidPrinter.testPrintPrinter(printerId);
    } catch (e) {
      alert('Errore nel test: ' + e.message);
    }
  };

  window.PrintersModule.editPrinter = function(printerId) {
    const printer = printers.find(p => p.id === printerId);
    if (!printer) {
      alert('Stampante non trovata');
      return;
    }
    selectedPrinterForEdit = printer;
    // TODO: Implementare modifica
    alert('Modifica non ancora implementata');
  };

  function renderCategoryAssignments() {
    const container = document.getElementById('categoryAssignmentsContainer');
    if (!container) return;

    // Carica le categorie dalla webapp
    const categories = [...new Set((menu || []).map(d => (d.cat && d.cat.trim()) || 'Senza categoria'))].sort();
    if (categories.length === 0) {
      container.innerHTML = '<div class="empty-hint">Aggiungi piatti al menu per configurare le categorie.</div>';
      return;
    }

    const html = categories.map(cat => {
      const printerId = getCategoryPrinter(cat) || '';
      const copies = getCategoryPrinterCopies(cat) || 1;
      const enabled = isCategoryPrinterEnabled(cat);
      const printerName = printers.find(p => p.id === printerId)?.name || '(nessuna)';

      return `
        <div style="padding:12px 0; border-bottom:1px solid var(--line);">
          <div style="font-weight:600; margin-bottom:8px;">${escapeHtml(cat)}</div>
          <div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:10px; font-size:13px;">
            <div>
              <label style="font-size:11px; color:var(--text-dim); display:block; margin-bottom:4px;">Stampante</label>
              <select onchange="PrintersModule.setCategoryPrinter('${escapeHtml(cat)}', this.value)" style="width:100%; padding:6px; border:1px solid var(--line); border-radius:6px; background:var(--panel-2); color:var(--text); font-size:12px;">
                <option value="">— Nessuna —</option>
                ${printers.map(p => `<option value="${p.id}" ${p.id === printerId ? 'selected' : ''}>${escapeHtml(p.name)}</option>`).join('')}
              </select>
            </div>
            <div>
              <label style="font-size:11px; color:var(--text-dim); display:block; margin-bottom:4px;">Copie</label>
              <input type="number" min="1" value="${copies}" onchange="setCategoryPrinterCopies('${escapeHtml(cat)}', this.value)" style="width:100%; padding:6px; border:1px solid var(--line); border-radius:6px; background:var(--panel-2); color:var(--text); font-size:12px;">
            </div>
            <div>
              <label style="font-size:11px; color:var(--text-dim); display:block; margin-bottom:4px;">Stampa</label>
              <label style="display:flex; align-items:center; gap:6px; font-size:12px; margin:6px 0; cursor:pointer;">
                <input type="checkbox" ${enabled ? 'checked' : ''} onchange="PrintersModule.setCategoryEnabled('${escapeHtml(cat)}', this.checked)">
                Abilitata
              </label>
            </div>
          </div>
        </div>`;
    }).join('');

    container.innerHTML = html;
  }

  function getCategoryPrinter(category) {
    if (typeof AndroidPrinter === 'undefined') return null;
    try {
      return AndroidPrinter.getPrinterForCategory(category) || null;
    } catch (e) {
      return null;
    }
  }

  function getCategoryPrinterCopies(category) {
    if (typeof AndroidPrinter === 'undefined') return 1;
    try {
      return AndroidPrinter.getCopiesForCategory(category) || 1;
    } catch (e) {
      return 1;
    }
  }

  function isCategoryPrinterEnabled(category) {
    if (typeof AndroidPrinter === 'undefined') return true;
    try {
      return AndroidPrinter.isCategoryEnabled(category) !== false;
    } catch (e) {
      return true;
    }
  }

  window.setCategoryPrinterCopies = function(category, copies) {
    const c = Math.max(1, parseInt(copies));
    if (typeof AndroidPrinter === 'undefined') return;
    try {
      AndroidPrinter.setCopiesForCategory(category, c);
    } catch (e) {
      console.error('Errore nel salvataggio copie:', e);
    }
  };

  window.PrintersModule.setCategoryPrinter = function(category, printerId) {
    if (typeof AndroidPrinter === 'undefined') return;
    try {
      AndroidPrinter.setPrinterForCategory(category, printerId);
      renderCategoryAssignments();
      flash('Stampante assegnata alla categoria');
    } catch (e) {
      alert('Errore: ' + e.message);
    }
  };

  window.PrintersModule.setCategoryEnabled = function(category, enabled) {
    if (typeof AndroidPrinter === 'undefined') return;
    try {
      AndroidPrinter.setCategoryEnabled(category, enabled);
      flash(enabled ? 'Stampa abilitata' : 'Stampa disabilitata');
    } catch (e) {
      alert('Errore: ' + e.message);
    }
  };

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => ({
      '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
    }[c]));
  }
})();