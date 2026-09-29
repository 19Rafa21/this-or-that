export function profileRows(question, sessions, text, language) {
  const counts = question.counts;
  const known = new Set(question.options.map((option) => option.value));
  const answered = Object.values(counts).reduce((total, value) => total + value, 0);
  const other = Object.entries(counts).reduce((total, [key, value]) =>
    total + (!known.has(key) && key !== "skipped" ? value : 0), 0);
  return [
    ...question.options.map((option) => ({ label: option[language], value: counts[option.value] || 0 })),
    { label: text.skipped, value: counts.skipped || 0 },
    { label: text.missing, value: Math.max(0, sessions - answered) },
    ...(other ? [{ label: text.unknown, value: other }] : []),
  ];
}

export function preferenceRows(rows, styles = {}) {
  return rows.map((row) => ({ label: styles[row.style] || row.style, value: row.decided ? row.wins / row.decided * 100 : null,
    wins: row.wins, shown: row.shown, decided: row.decided, skipped: row.skipped }));
}

export function profileFilterLabels(questions, filters = {}, text, language) {
  return questions.filter((question) => filters[question.id]).map((question) => {
    const value = filters[question.id];
    const label = value === "skipped" ? text.skipped : value === "__missing__" ? text.missing
      : question.options.find((option) => option.value === value)?.[language] || value;
    return `${question[`question_${language}`]}: ${label}`;
  });
}
