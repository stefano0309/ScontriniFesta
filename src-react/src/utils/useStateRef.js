import { useRef, useState, useCallback } from 'react';

export function useStateRef(initial) {
  const [state, setState] = useState(initial);
  // NB: `state` qui è già il valore risolto (React esegue l'eventuale
  // funzione lazy passata a useState prima di questa riga, nello stesso
  // render). useRef, a differenza di useState, NON supporta un initializer
  // a funzione: se gli passassimo `initial` direttamente e `initial` fosse
  // una funzione (es. () => safeGet(...)), ref.current resterebbe quella
  // funzione invece del valore vero, finché non arriva il primo set().
  // Passando `state` invece di `initial` evitiamo il problema.
  const ref = useRef(state);

  const set = useCallback((value) => {
    setState((prev) => {
      const next = typeof value === 'function' ? value(prev) : value;
      ref.current = next;
      return next;
    });
  }, []);

  return [state, set, ref];
}