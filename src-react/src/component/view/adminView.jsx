import { useState } from 'react';
import CsvTab from "../tabs/csvTab";
import CashTab from "../tabs/cashTab";
import MenuTab from "../tabs/menuTab";
import CloseTab from "../tabs/closeTab";
import SettingsTab from "../tabs/settingsTab";
import PrinterTab from "../tabs/printerTab";
import HistoryTab from "../tabs/historyTab";

function AdminView({ onBack }) {
    const [activeTab, setActiveTab] = useState('menuTab');

    return (
        <div id="adminView">
            <div className="admin-wrap">
                <div className="admin-top">
                    <h1>Area <span>Amministrazione</span></h1>
                    <button className="back-btn" id="backToCashierBtn" onClick={onBack}>
                        ← Torna alla cassa
                    </button>
                </div>

                {/* Barra di navigazione Tab */}
                <div className="tabs">
                    <button 
                        className={`tab-btn ${activeTab === 'menuTab' ? 'active' : ''}`} 
                        onClick={() => setActiveTab('menuTab')}
                    >
                        Menu
                    </button>
                    <button 
                        className={`tab-btn ${activeTab === 'csvTab' ? 'active' : ''}`} 
                        onClick={() => setActiveTab('csvTab')}
                    >
                        Importa CSV
                    </button>
                    <button 
                        className={`tab-btn ${activeTab === 'cashFloatTab' ? 'active' : ''}`} 
                        onClick={() => setActiveTab('cashFloatTab')}
                    >
                        💰 Fondo Cassa
                    </button>
                    <button 
                        className={`tab-btn ${activeTab === 'closeTab' ? 'active' : ''}`} 
                        onClick={() => setActiveTab('closeTab')}
                    >
                        Chiusura Cassa
                    </button>
                    <button 
                        className={`tab-btn ${activeTab === 'page-history' ? 'active' : ''}`} 
                        onClick={() => setActiveTab('page-history')}
                    >
                        🧾 Storico
                    </button>
                    <button 
                        className={`tab-btn ${activeTab === 'printersTab' ? 'active' : ''}`} 
                        onClick={() => setActiveTab('printersTab')}
                    >
                        🖨️ Stampanti
                    </button>
                    <button 
                        className={`tab-btn ${activeTab === 'settingsTab' ? 'active' : ''}`} 
                        onClick={() => setActiveTab('settingsTab')}
                    >
                        Impostazioni
                    </button>
                </div>

                {/* Componenti Tab con prop isActive */}
                <MenuTab isActive={activeTab === 'menuTab'} />
                <CsvTab isActive={activeTab === 'csvTab'} />
                <CashTab isActive={activeTab === 'cashFloatTab'} />
                <CloseTab isActive={activeTab === 'closeTab'} />
                <SettingsTab isActive={activeTab === 'settingsTab'} />
                <PrinterTab isActive={activeTab === 'printersTab'} />
                <HistoryTab isActive={activeTab === 'page-history'} />
            </div>
        </div>
    );
}

export default AdminView;