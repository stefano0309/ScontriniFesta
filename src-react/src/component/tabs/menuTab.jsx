// MenuTab.jsx
import { useState } from 'react';

function MenuTab({ isActive, menuList = [], onAddDish, onDeleteDish }) {
    const [dishType, setDishType] = useState('dish');
    const [dishName, setDishName] = useState('');
    const [dishPrice, setDishPrice] = useState('');
    const [dishCat, setDishCat] = useState('');
    const [comboItems, setComboItems] = useState(['']);

    const handleAddComboField = () => {
        setComboItems(prev => [...prev, '']);
    };

    const handleComboChange = (index, value) => {
        const updated = [...comboItems];
        updated[index] = value;
        setComboItems(updated);
    };

    const handleAddDish = () => {
        if (!dishName || !dishPrice || !dishCat) {
            alert('Compila tutti i campi obbligatori');
            return;
        }

        const newDish = {
            id: Date.now(),
            type: dishType,
            name: dishName,
            price: parseFloat(dishPrice),
            category: dishCat,
            comboItems: dishType === 'combo' ? comboItems.filter(i => i.trim() !== '') : []
        };

        if (onAddDish) {
            onAddDish(newDish);
        }

        setDishName('');
        setDishPrice('');
        setDishCat('');
        setComboItems(['']);
    };

    return (
        <div className={`tab-pane ${isActive ? 'active' : ''}`} id="menuTab">
            <div className="panel">
                <h2>Aggiungi piatto al menu</h2>
                <label htmlFor="newDishType">Tipo</label>
                <select
                    id="newDishType"
                    value={dishType}
                    onChange={(e) => setDishType(e.target.value)}
                >
                    <option value="dish">Piatto singolo</option>
                    <option value="combo">Menu (gruppo di piatti)</option>
                </select>
                <div className="form-row">
                    <div>
                        <label id="newDishNameLabel" htmlFor="newDishName">Nome piatto</label>
                        <input
                            type="text"
                            id="newDishName"
                            placeholder="es. Tagliata di manzo"
                            value={dishName}
                            onChange={(e) => setDishName(e.target.value)}
                        />
                    </div>
                    <div>
                        <label htmlFor="newDishPrice">Prezzo (€)</label>
                        <input
                            type="number"
                            id="newDishPrice"
                            placeholder="14.00"
                            step="0.50"
                            min="0"
                            value={dishPrice}
                            onChange={(e) => setDishPrice(e.target.value)}
                        />
                    </div>
                    <div>
                        <label htmlFor="newDishCat">Categoria</label>
                        <input
                            type="text"
                            id="newDishCat"
                            placeholder="es. Secondi"
                            list="catList"
                            value={dishCat}
                            onChange={(e) => setDishCat(e.target.value)}
                        />
                        <datalist id="catList">
                            <option value="Antipasti" />
                            <option value="Primi" />
                            <option value="Secondi" />
                            <option value="Bevande" />
                            <option value="Dolci" />
                        </datalist>
                    </div>
                </div>

                {dishType === 'combo' && (
                    <div id="comboItemsWrap" style={{ marginBottom: '10px' }}>
                        <label>Piatti inclusi nel menu (uno per talloncino separato)</label>
                        <div id="comboItemsList">
                            {comboItems.map((item, index) => (
                                <input
                                    key={index}
                                    type="text"
                                    placeholder={`Piatto #${index + 1}`}
                                    value={item}
                                    onChange={(e) => handleComboChange(index, e.target.value)}
                                    style={{ marginBottom: '6px' }}
                                />
                            ))}
                        </div>
                        <button
                            type="button"
                            className="btn-teal"
                            id="addComboItemBtn"
                            style={{ marginTop: '4px' }}
                            onClick={handleAddComboField}
                        >
                            + Aggiungi piatto al gruppo
                        </button>
                    </div>
                )}

                <button
                    type="button"
                    className="btn-amber btn-block"
                    id="addDishBtn"
                    onClick={handleAddDish}
                >
                    + Aggiungi al menu
                </button>
            </div>

            <div className="panel">
                <h2>Menu attuale</h2>
                <div id="menuList">
                    {menuList.length === 0 ? (
                        <div className="empty-hint">Nessun piatto ancora.</div>
                    ) : (
                        menuList.map((dish) => (
                            <div key={dish.id} className="menu-item-row" style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #333' }}>
                                <div>
                                    <strong>{dish.name}</strong> - €{dish.price.toFixed(2)} ({dish.category})
                                </div>
                                <button type="button" className="btn-red" onClick={() => onDeleteDish && onDeleteDish(dish.id)}>
                                    Elimina
                                </button>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
}

export default MenuTab;