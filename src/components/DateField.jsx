import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Calendar, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { addDays, fromIso, MONTHS, MONTHS_LONG, toIso, todayIso } from '../utils/dates';

const POPOVER_WIDTH = 320;
const POPOVER_HEIGHT = 396;
const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

const formatShown = (iso) => {
  const date = fromIso(iso);
  return date ? date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : null;
};

/**
 * A date box that opens a standard calendar. The title ("October 2026") is a button: it opens a
 * month grid, and the year in that grid opens a year list, so any date is a few clicks away
 * instead of paging month by month or stepping the browser field's day / month / year pieces.
 * Days of the neighbouring months are shown faded; Today is one tap; arrow keys move around.
 *
 * Value and onChange use 'YYYY-MM-DD'; min / max grey out dates outside the range.
 */
const DateField = ({
  value, onChange, min, max, placeholder = 'Select date', compact = true, disabled = false,
  minYear, maxYear, required = false, 'aria-label': ariaLabel, style,
}) => {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState('days'); // 'days' | 'months' | 'years'
  const [view, setView] = useState({ year: 0, month: 0 });
  const [focusIso, setFocusIso] = useState(null);
  const [pos, setPos] = useState({ left: 0, top: 0 });
  const triggerRef = useRef(null);
  const popRef = useRef(null);

  const today = todayIso();
  const selected = fromIso(value);

  // Without an explicit floor the year list goes back to 2000 — far enough for any report, and
  // short. (A date of birth passes its own, earlier, minYear.)
  const lowYear = minYear ?? (min ? fromIso(min)?.getFullYear() : undefined) ?? 2000;
  const highYear = maxYear ?? (max ? fromIso(max)?.getFullYear() : undefined) ?? new Date().getFullYear() + 1;
  const years = useMemo(() => {
    const list = [];
    for (let y = lowYear; y <= highYear; y += 1) list.push(y);
    return list;
  }, [lowYear, highYear]);

  const inRange = useCallback((iso) => (!min || iso >= min) && (!max || iso <= max), [min, max]);

  const openPicker = () => {
    if (disabled) return;
    const start = selected ?? fromIso(today);
    setView({ year: start.getFullYear(), month: start.getMonth() });
    setFocusIso(toIso(start));
    setMode('days');

    // Fixed to the viewport (and rendered in a portal) so no card's overflow can clip it; it
    // opens upward when there is no room below.
    const rect = triggerRef.current.getBoundingClientRect();
    const left = Math.max(8, Math.min(rect.left, window.innerWidth - POPOVER_WIDTH - 8));
    const fitsBelow = rect.bottom + 6 + POPOVER_HEIGHT < window.innerHeight;
    setPos({ left, top: fitsBelow ? rect.bottom + 6 : Math.max(8, rect.top - 6 - POPOVER_HEIGHT) });
    setOpen(true);
  };

  const close = useCallback((returnFocus = true) => {
    setOpen(false);
    if (returnFocus) triggerRef.current?.focus();
  }, []);

  const choose = (iso) => {
    if (!inRange(iso)) return;
    onChange(iso);
    close();
  };

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => {
      if (popRef.current?.contains(e.target) || triggerRef.current?.contains(e.target)) return;
      close(false);
    };
    // The popover is placed from where the box was when it opened; if the page scrolls or
    // resizes under it, close rather than leave it floating in the wrong place.
    const onMove = (e) => { if (!popRef.current?.contains(e.target)) close(false); };
    const onKey = (e) => {
      if (e.key !== 'Escape') return;
      // Escape steps back out of the month / year lists first, and only then closes.
      if (mode !== 'days') setMode('days'); else close();
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    window.addEventListener('scroll', onMove, true);
    window.addEventListener('resize', onMove);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('scroll', onMove, true);
      window.removeEventListener('resize', onMove);
    };
  }, [open, mode, close]);

  // Keep keyboard focus on the day being navigated.
  useEffect(() => {
    if (open && mode === 'days' && focusIso) popRef.current?.querySelector(`[data-iso="${focusIso}"]`)?.focus();
  }, [open, mode, focusIso, view]);

  // Open the year list scrolled to the current year.
  useEffect(() => {
    if (open && mode === 'years') popRef.current?.querySelector('.df-year.is-selected')?.scrollIntoView({ block: 'center' });
  }, [open, mode]);

  const monthIsOutside = (year, month) => {
    const first = toIso(new Date(year, month, 1));
    const last = toIso(new Date(year, month + 1, 0));
    return Boolean((max && first > max) || (min && last < min));
  };
  const keepDayIn = (year, month) =>
    toIso(new Date(year, month, Math.min(fromIso(focusIso)?.getDate() ?? 1, new Date(year, month + 1, 0).getDate())));

  const goMonth = (delta) => {
    const d = new Date(view.year, view.month + delta, 1);
    setView({ year: d.getFullYear(), month: d.getMonth() });
    setFocusIso(keepDayIn(d.getFullYear(), d.getMonth()));
  };
  const goYear = (delta) => setView((v) => ({ ...v, year: Math.min(highYear, Math.max(lowYear, v.year + delta)) }));

  const pickMonth = (month) => {
    setView((v) => ({ ...v, month }));
    setFocusIso(keepDayIn(view.year, month));
    setMode('days');
  };
  const pickYear = (year) => {
    setView((v) => ({ ...v, year }));
    setMode('months');
  };

  // Six full weeks every time, so the popover never changes height between months.
  const gridStart = addDays(new Date(view.year, view.month, 1), -new Date(view.year, view.month, 1).getDay());
  const cells = Array.from({ length: 42 }, (_, i) => {
    const date = addDays(gridStart, i);
    return { iso: toIso(date), day: date.getDate(), outside: date.getMonth() !== view.month };
  });

  const onGridKey = (e) => {
    const step = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }[e.key];
    if (step !== undefined) {
      e.preventDefault();
      const next = toIso(addDays(fromIso(focusIso), step));
      if (!inRange(next)) return;
      const d = fromIso(next);
      setView({ year: d.getFullYear(), month: d.getMonth() });
      setFocusIso(next);
    } else if (e.key === 'PageUp' || e.key === 'PageDown') {
      e.preventDefault();
      goMonth(e.key === 'PageUp' ? -1 : 1);
    }
  };

  const prevMonthOutside = view.month === 0 ? monthIsOutside(view.year - 1, 11) : monthIsOutside(view.year, view.month - 1);
  const nextMonthOutside = view.month === 11 ? monthIsOutside(view.year + 1, 0) : monthIsOutside(view.year, view.month + 1);
  const shown = formatShown(value);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className={`df-trigger${compact ? ' df-trigger--compact' : ''}${shown ? '' : ' is-empty'}`}
        style={style}
        onClick={() => (open ? close(false) : openPicker())}
        disabled={disabled}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={ariaLabel}
      >
        <span>{shown ?? placeholder}</span>
        <Calendar size={compact ? 15 : 17} />
      </button>
      {/* Keeps a form's "required" working: a custom button cannot be required itself. */}
      {required && <input className="df-required" tabIndex={-1} aria-hidden="true" required value={value || ''} onChange={() => {}} />}

      {open && createPortal(
        <div ref={popRef} className="df-pop" role="dialog" aria-label="Choose a date" style={{ left: pos.left, top: pos.top, width: POPOVER_WIDTH }}>
          {mode === 'days' && (
            <>
              <div className="df-head">
                <button type="button" className="df-nav" onClick={() => goMonth(-1)} disabled={prevMonthOutside} aria-label="Previous month">
                  <ChevronLeft size={18} />
                </button>
                <button type="button" className="df-title" onClick={() => setMode('months')} aria-label="Choose month and year">
                  {MONTHS_LONG[view.month]} {view.year} <ChevronDown size={15} />
                </button>
                <button type="button" className="df-nav" onClick={() => goMonth(1)} disabled={nextMonthOutside} aria-label="Next month">
                  <ChevronRight size={18} />
                </button>
              </div>

              <div className="df-weekdays" aria-hidden="true">
                {WEEKDAYS.map((d) => <span key={d}>{d}</span>)}
              </div>

              {/* eslint-disable-next-line jsx-a11y/no-static-element-interactions */}
              <div className="df-grid" onKeyDown={onGridKey}>
                {cells.map(({ iso, day, outside }) => (
                  <button
                    key={iso} type="button" data-iso={iso}
                    tabIndex={iso === focusIso ? 0 : -1}
                    className={`df-day${iso === value ? ' is-selected' : ''}${iso === today ? ' is-today' : ''}${outside ? ' is-outside' : ''}`}
                    disabled={!inRange(iso)}
                    onClick={() => choose(iso)}
                    aria-label={fromIso(iso).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                    aria-pressed={iso === value}
                  >
                    {day}
                  </button>
                ))}
              </div>

              <button type="button" className="df-today" onClick={() => choose(today)} disabled={!inRange(today)}>Today</button>
            </>
          )}

          {mode === 'months' && (
            <>
              <div className="df-head">
                <button type="button" className="df-nav" onClick={() => goYear(-1)} disabled={view.year <= lowYear} aria-label="Previous year">
                  <ChevronLeft size={18} />
                </button>
                <button type="button" className="df-title" onClick={() => setMode('years')} aria-label="Choose year">
                  {view.year} <ChevronDown size={15} />
                </button>
                <button type="button" className="df-nav" onClick={() => goYear(1)} disabled={view.year >= highYear} aria-label="Next year">
                  <ChevronRight size={18} />
                </button>
              </div>
              <div className="df-months">
                {MONTHS.map((name, i) => (
                  <button
                    key={name} type="button"
                    className={`df-month${i === view.month ? ' is-selected' : ''}`}
                    disabled={monthIsOutside(view.year, i)}
                    onClick={() => pickMonth(i)}
                  >
                    {name}
                  </button>
                ))}
              </div>
              <button type="button" className="df-today" onClick={() => setMode('days')}>Back to calendar</button>
            </>
          )}

          {mode === 'years' && (
            <>
              <div className="df-head df-head--center">
                <span className="df-title df-title--plain">Select year</span>
              </div>
              <div className="df-years">
                {years.map((y) => (
                  <button
                    key={y} type="button"
                    className={`df-year${y === view.year ? ' is-selected' : ''}`}
                    onClick={() => pickYear(y)}
                  >
                    {y}
                  </button>
                ))}
              </div>
              <button type="button" className="df-today" onClick={() => setMode('months')}>Back</button>
            </>
          )}
        </div>,
        document.body,
      )}
    </>
  );
};

export default DateField;
