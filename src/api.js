const API_BASE_URL =
  import.meta.env.VITE_API_URL || "http://localhost:50820";

async function request(path, options = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
    ...options,
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `Erro na API: ${response.status}`);
  }

  return response.json();
}

export function getSnippets() {
  return request("/api/snippets");
}

export function getProfileQuestions() {
  return request("/api/profile-questions");
}

export function createSession() {
  return request("/api/sessions", {
    method: "POST",
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