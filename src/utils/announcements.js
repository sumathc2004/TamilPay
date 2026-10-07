// Announcements: shared helpers for the daily popup, the home banner and the admin page.
// Rows come straight from the remote (Id, title, message, isActive, createdTime, updatedTime),
// so every read goes through normalizeAnnouncement instead of trusting one casing.
import { apiUrl } from './api';
import { pick } from './pick';

export const normalizeAnnouncement = (row) => ({
  id: pick(row, ['Id', 'id']),
  title: pick(row, ['title', 'Title']) ?? '',
  message: pick(row, ['message', 'Message']) ?? '',
  isActive: pick(row, ['isActive', 'IsActive']) !== false,
  createdTime: pick(row, ['createdTime', 'CreatedTime']) ?? null,
  updatedTime: pick(row, ['updatedTime', 'UpdatedTime']) ?? null,
});

const newestFirst = (a, b) => String(b.createdTime ?? '').localeCompare(String(a.createdTime ?? ''));

async function load(path) {
  const res = await fetch(apiUrl(path));
  if (!res.ok) throw new Error(`Request failed (${res.status})`);
  return (await res.json()).map(normalizeAnnouncement).sort(newestFirst);
}

export const fetchActiveAnnouncements = () => load('/api/announcements');
export const fetchAllAnnouncements = () => load('/api/announcements/all');

export const formatAnnouncementTime = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? ''
    : d.toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
};

// ---- Once-a-day popup ----
// The popup is for the first time someone is signed in on a given calendar day (local time),
// per person, on this browser. It is marked at the moment it is shown, so a refresh or a second
// tab the same day doesn't pop it again; tomorrow's first visit does.
const seenKey = (userId) => `tamilpay_announcements_seen_${userId}`;

const todayKey = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export function shouldShowAnnouncementPopup(userId) {
  try {
    return localStorage.getItem(seenKey(userId)) !== todayKey();
  } catch {
    return true; // Storage blocked: showing once per page load is better than never.
  }
}

export function markAnnouncementPopupShown(userId) {
  try {
    localStorage.setItem(seenKey(userId), todayKey());
  } catch {
    // Storage unavailable — it may show again on the next load; harmless.
  }
}

// ---- Announcements already shown in a popup ----
// A popup shows an announcement once per person: either as part of the daily popup or, for one
// posted later, the moment it turns up while they are on Home (or when they next get there).
// The ids are kept per person in this browser, plus in memory in case storage is blocked, so a
// blocked-storage browser sees a new announcement once per page load rather than on every check.
const knownKey = (userId) => `tamilpay_announcements_known_${userId}`;
const memoryKnown = new Map();

export function getKnownAnnouncementIds(userId) {
  const ids = new Set(memoryKnown.get(userId) ?? []);
  try {
    JSON.parse(localStorage.getItem(knownKey(userId)) || '[]').forEach((id) => ids.add(id));
  } catch {
    // Unreadable or blocked: fall back to what this page load has already shown.
  }
  return ids;
}

export function addKnownAnnouncementIds(userId, newIds) {
  const ids = getKnownAnnouncementIds(userId);
  newIds.forEach((id) => ids.add(id));
  memoryKnown.set(userId, [...ids]);
  try {
    localStorage.setItem(knownKey(userId), JSON.stringify([...ids]));
  } catch {
    // Storage unavailable — the in-memory copy still covers this page load.
  }
}
