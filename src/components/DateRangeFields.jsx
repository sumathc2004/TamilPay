import React from 'react';
import DateField from './DateField';
import { QUICK_RANGES, quickRange, todayIso } from '../utils/dates';

/**
 * The From / To pair every report uses, plus a "Quick range" drop-down (Today, Last 7 days, This
 * month…) that sets both at once. Renders three blocks to sit inside the page's own filter row;
 * choosing dates only changes the values — the page's Search button still runs the report.
 */
const DateRangeFields = ({ fromDate, toDate, onFromChange, onToChange }) => {
  const applyQuick = (key) => {
    const range = quickRange(key);
    if (!range) return;
    onFromChange(range.from);
    onToChange(range.to);
  };

  return (
    <>
      <div>
        <label className="df-label">From</label>
        <DateField value={fromDate} onChange={onFromChange} max={toDate} aria-label="From date" />
      </div>
      <div>
        <label className="df-label">To</label>
        <DateField value={toDate} onChange={onToChange} min={fromDate} max={todayIso()} aria-label="To date" />
      </div>
      <div>
        <label className="df-label">Quick range</label>
        <select
          className="df-quick" value="" aria-label="Quick range"
          onChange={(e) => applyQuick(e.target.value)}
        >
          <option value="" disabled>Choose…</option>
          {QUICK_RANGES.map((q) => <option key={q.key} value={q.key}>{q.label}</option>)}
        </select>
      </div>
    </>
  );
};

export default DateRangeFields;
