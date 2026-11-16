const API = import.meta.env.VITE_API_URL || "http://localhost:8000";

const WS_API = API.replace(/^http/, "ws");

export { API, WS_API };
