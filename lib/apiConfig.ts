/** API origin without /api — used for Socket.IO (path /socket.io). */
export const API_ORIGIN =
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_ORIGIN) || 'http://localhost:8000';

export const API = `${API_ORIGIN.replace(/\/$/, '')}/api`;

export const SOCKET_URL = API_ORIGIN.replace(/\/$/, '');
