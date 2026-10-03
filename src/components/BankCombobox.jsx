import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, Search } from 'lucide-react';

/**
 * A bank picker you can type into. The list narrows to whatever contains the text
 * (any part of the name, or the bank code), so nobody has to scroll a 200-entry dropdown.
 *
 * `value` is the chosen bank's name, and `onSelect` gets the bank, or null as soon as the
 * text is edited — so the form is never left holding a bank the box no longer shows.
 */
const BankCombobox = ({ banks, value, onSelect, placeholder = 'Type to search banks…' }) => {
  // What the person has typed, or null when they are not editing — in which case the box
  // simply shows the chosen bank. Nothing to keep in sync with `value` that way.
  const [draft, setDraft] = useState(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const rootRef = useRef(null);
  const listRef = useRef(null);

  const text = draft ?? value;

  useEffect(() => {
    if (!open) return undefined;
    const closeIfOutside = (e) => {
      if (rootRef.current?.contains(e.target)) return;
      setOpen(false);
      setDraft(null); // Half-typed text that was never picked goes back to the real choice.
    };
    document.addEventListener('mousedown', closeIfOutside);
    return () => document.removeEventListener('mousedown', closeIfOutside);
  }, [open]);

  const matches = useMemo(() => {
    const needle = (draft ?? '').trim().toLowerCase();
    if (!needle) return banks;
    const found = banks.filter((b) => b.BankName.toLowerCase().includes(needle) || b.BankCode.toLowerCase().includes(needle));
    // Names that start with the text come first.
    return found.sort((a, b) => Number(b.BankName.toLowerCase().startsWith(needle)) - Number(a.BankName.toLowerCase().startsWith(needle)));
  }, [banks, draft]);

  useEffect(() => {
    listRef.current?.children[active]?.scrollIntoView?.({ block: 'nearest' });
  }, [active, open]);

  const choose = (bank) => {
    onSelect(bank);
    setDraft(null);
    setOpen(false);
  };

  const onKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setOpen(true);
      setActive((i) => Math.min(i + 1, matches.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && open) {
      e.preventDefault(); // Do not submit the form while picking a bank.
      if (matches[active]) choose(matches[active]);
    } else if (e.key === 'Escape') {
      setOpen(false);
      setDraft(null);
    }
  };

  return (
    <div ref={rootRef} className="bank-combo">
      <Search size={15} className="bank-combo-icon" />
      <input
        type="text"
        className="form-input no-icon bank-combo-input"
        value={text}
        placeholder={placeholder}
        autoComplete="off"
        role="combobox"
        aria-expanded={open}
        aria-autocomplete="list"
        onFocus={(e) => { setOpen(true); e.target.select(); }}
        onChange={(e) => {
          setDraft(e.target.value);
          setActive(0);
          setOpen(true);
          if (value) onSelect(null);
        }}
        onKeyDown={onKeyDown}
      />
      <ChevronDown size={16} className={`bank-combo-chevron${open ? ' is-open' : ''}`} />

      {open && (
        <ul ref={listRef} className="bank-combo-list" role="listbox">
          {matches.length === 0 && <li className="bank-combo-empty">No bank matches “{(draft ?? '').trim()}”.</li>}
          {matches.map((bank, i) => (
            <li
              key={bank.BankName}
              role="option"
              aria-selected={bank.BankName === value}
              className={`bank-combo-option${i === active ? ' is-active' : ''}${bank.BankName === value ? ' is-selected' : ''}`}
              onMouseDown={(e) => { e.preventDefault(); choose(bank); }}
              onMouseEnter={() => setActive(i)}
            >
              {bank.BankName}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default BankCombobox;
