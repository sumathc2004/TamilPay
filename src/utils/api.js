// Empty by default: relative paths, resolved via Vite's dev proxy or same-origin
// production hosting. Set VITE_API_BASE_URL only if frontend and backend are
// ever deployed to different origins.
const API_BASE = import.meta.env.VITE_API_BASE_URL ?? '';

export const apiUrl = (path) => `${API_BASE}${path}`;
