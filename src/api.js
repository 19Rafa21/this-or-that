const API_BASE_URL =
  import.meta.env.VITE_API_URL || "http://localhost:50820";

const REQUEST_TIMEOUT_MS = 60000;

async function request(path, options = {}) {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(
    () => controller.abort(),
    REQUEST_TIMEOUT_MS
  );

  try {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(options.headers || {}),
      },
      signal: controller.signal,
    });
    if (!response.ok) {
      const message = await response.text();
      const error = new Error(message || `Erro na API: ${response.status}`);
      error.status = response.status;
      throw error;
    }
    return await response.json();
  } finally {
    window.clearTimeout(timeoutId);
  }
}

export function getComparisons() {
  return request("/api/comparisons");
}

export function getProfileQuestions() {
  return request("/api/v2/profile-questions");
}

export function createSession(language) {
  return request("/api/sessions", {
    method: "POST",
    body: JSON.stringify({ language }),
  });
}

export function saveChoice(choice) {
  return request("/api/choices", {
    method: "POST",
    body: JSON.stringify(choice),
  });
}

export function saveProfileAnswer(answer) {
  return request("/api/profile-answers", {
    method: "POST",
    body: JSON.stringify(answer),
  });
}

export function saveFinalResult(result) {
  return request("/api/final-results", {
    method: "POST",
    body: JSON.stringify(result),
  });
}

export function adminLogin(username, password) {
  return request("/api/admin/login", { method: "POST", body: JSON.stringify({ username, password }) });
}

export function adminLogout(token) {
  return request("/api/admin/logout", { method: "POST", headers: { Authorization: `Bearer ${token}` } });
}

export function getStudyResults(token, filters) {
  return request(`/api/admin/results?${new URLSearchParams({ ...filters, profile: JSON.stringify(filters.profile || {}) })}`, { headers: { Authorization: `Bearer ${token}` } });
}

export function getPublicResults() {
  return request("/api/public/results");
}
