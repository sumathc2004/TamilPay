import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, Search } from 'lucide-react';

/**
 * A dropdown you can type into: the list narrows to whatever contains the text, so nobody
 * scrolls a long list for one name. `options` are { value, label, hint? } — the text matched
 * is the label and the hint (e.g. a customer's name and their store).
 *
 * `value` is the chosen option's value ('' for none) and `onChange` receives the new one, or
 * '' as soon as the text is edited — so the page is never left holding a choice the box no
 * longer shows. Styled with the same classes as the bank picker.
 */
const SearchSelect = ({ options, value, onChange, placeholder = 'Type to search…', loading = false, emptyText = 'Nothing matches.', minWidth = 280 }) => {
  // What the person is typing, or null when they are not editing — then the box simply shows
  // the chosen option's label, so there is nothing to keep in sync with `value`.
  const [draft, setDraft] = useState(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const rootRef = useRef(null);
  const listRef = useRef(null);

  const selected = options.find((o) => String(o.value) === String(value));
  const text = draft ?? selected?.label ?? '';

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
    if (!needle) return options;
    const found = options.filter((o) => `${o.label} ${o.hint ?? ''}`.toLowerCase().includes(needle));
    // Labels that start with the text come first.
    return found.sort((a, b) => Number(b.label.toLowerCase().startsWith(needle)) - Number(a.label.toLowerCase().startsWith(needle)));
  }, [options, draft]);

  useEffect(() => {
    listRef.current?.children[active]?.scrollIntoView?.({ block: 'nearest' });
  }, [active, open]);

  const choose = (option) => {
    onChange(String(option.value));
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
      e.preventDefault(); // Do not submit a surrounding form while picking.
      if (matches[active]) choose(matches[active]);
    } else if (e.key === 'Escape') {
      setOpen(false);
      setDraft(null);
    }
  };

  return (
    <div ref={rootRef} className="bank-combo" style={{ minWidth }}>
      <Search size={15} className="bank-combo-icon" />
      <input
        type="text"
        className="form-input no-icon bank-combo-input"
        style={{ height: 34, fontSize: 13, paddingTop: 0, paddingBottom: 0 }}
        value={loading && !selected && draft === null ? '' : text}
        placeholder={loading ? 'Loading customers…' : placeholder}
        disabled={loading}
        autoComplete="off"
        role="combobox"
        aria-expanded={open}
        aria-autocomplete="list"
        onFocus={(e) => { setOpen(true); e.target.select(); }}
        onChange={(e) => {
          setDraft(e.target.value);
          setActive(0);
          setOpen(true);
          if (value) onChange('');
        }}
        onKeyDown={onKeyDown}
      />
      <ChevronDown size={16} className={`bank-combo-chevron${open ? ' is-open' : ''}`} />

      {open && (
        <ul ref={listRef} className="bank-combo-list" role="listbox">
          {matches.length === 0 && <li className="bank-combo-empty">{emptyText}</li>}
          {matches.map((o, i) => (
            <li
              key={o.value}
              role="option"
              aria-selected={String(o.value) === String(value)}
              className={`bank-combo-option${i === active ? ' is-active' : ''}${String(o.value) === String(value) ? ' is-selected' : ''}`}
              onMouseDown={(e) => { e.preventDefault(); choose(o); }}
              onMouseEnter={() => setActive(i)}
            >
              {o.label}
              {o.hint && <span style={{ display: 'block', fontSize: 12, fontWeight: 400, color: '#7C8491' }}>{o.hint}</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default SearchSelect;
