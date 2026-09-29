import { useEffect, useRef, useState } from "react";
import { Chart, BarController, BarElement, CategoryScale, LinearScale, Tooltip, Title, SubTitle } from "chart.js";

Chart.register(BarController, BarElement, CategoryScale, LinearScale, Tooltip, Title, SubTitle);

function wrapLabel(value, maxLength) {
  const lines = [""];
  for (const word of value.split(" ")) {
    if (lines.at(-1).length && lines.at(-1).length + word.length + 1 > maxLength) lines.push(word);
    else lines[lines.length - 1] += `${lines.at(-1) ? " " : ""}${word}`;
  }
  return lines;
}

export default function ResultsChart({ title, rows, text, percent = false, metadata = "" }) {
  const canvas = useRef(null);
  const chart = useRef(null);
  const [exportError, setExportError] = useState(false);
  const hasValues = rows.some((row) => row.value != null && (percent || row.value > 0));
  useEffect(() => {
    chart.current = new Chart(canvas.current, {
      type: "bar",
      data: { labels: rows.map((row) => wrapLabel(row.label, 22)), datasets: [{ data: rows.map((row) => row.value),
        backgroundColor: "#8660d7", borderRadius: 5, maxBarThickness: 24 }] },
      options: {
        indexAxis: "y", responsive: true, maintainAspectRatio: false, animation: false,
        layout: { padding: 12 },
        plugins: {
          title: { display: true, text: wrapLabel(title, 42), color: "#271343", font: { size: 15 } },
          subtitle: { display: true, text: metadata.split(" · "), color: "#665777", font: { size: 10 }, padding: { bottom: 14 } },
          tooltip: { callbacks: { label: (context) => {
            const row = rows[context.dataIndex];
            const value = `${context.parsed.x?.toFixed(percent ? 1 : 0)}${percent ? "%" : ""}`;
            return row.decided !== undefined ? `${value} (${row.wins}/${row.decided})` : value;
          } } },
        },
        scales: {
          x: { beginAtZero: true, ...(percent ? { max: 100 } : {}),
            title: { display: true, text: percent ? text.percentage : text.count },
            ticks: { precision: 0 }, grid: { color: "#eee9f4" } },
          y: { grid: { display: false }, ticks: { color: "#3b2b51" } },
        },
      },
      plugins: [{ id: "whiteBackground", beforeDraw(instance) {
        const { ctx, width, height } = instance;
        ctx.save(); ctx.globalCompositeOperation = "destination-over";
        ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, width, height); ctx.restore();
      } }],
    });
    return () => { chart.current.destroy(); chart.current = null; };
  }, [title, rows, text, percent, metadata]);

  async function exportPng() {
    try {
      const blob = await new Promise((resolve) => canvas.current.toBlob(resolve, "image/png"));
      if (!blob) throw new Error("PNG export failed");
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.download = `${title.replace(/[^\p{L}\p{N}]+/gu, "-")}.png`;
      link.href = url;
      link.target = "_blank";
      link.rel = "noopener";
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 60000);
      setExportError(false);
    } catch { setExportError(true); }
  }
  const detailed = rows.some((row) => row.shown !== undefined);
  const skipCounts = rows.some((row) => row.total !== undefined);
  return <article className="results-chart-card">
    <h3>{title}</h3>
    {!hasValues && <p className="results-muted">{text.empty}</p>}
    <div className="results-canvas" style={{ height: Math.max(300, rows.length * 42 + 165) }}>
      <canvas ref={canvas} role="img" aria-label={title} />
    </div>
    <div className="results-chart-actions"><button type="button" onClick={exportPng}>{text.png}</button></div>
    {exportError && <p role="alert">{text.exportError}</p>}
    <details><summary>{text.table}</summary><div className="results-table-scroll"><table>
      <thead><tr><th>{text.label}</th><th>{percent ? text.percentage : text.count}</th>
        {detailed && <><th>{text.won}</th><th>{text.decided}</th><th>{text.shown}</th><th>{text.skipped}</th></>}
        {skipCounts && <><th>{text.count}</th><th>{text.skipped}</th></>}
      </tr></thead>
      <tbody>{rows.map((row, index) => <tr key={index}><th scope="row">{row.label}</th>
        <td>{row.value === null ? "—" : percent ? `${row.value.toFixed(1)}%` : row.value}</td>
        {detailed && <><td>{row.wins}</td><td>{row.decided}</td><td>{row.shown}</td><td>{row.skipped}</td></>}
        {skipCounts && <><td>{row.total}</td><td>{row.skipped}</td></>}
      </tr>)}</tbody>
    </table></div></details>
  </article>;
}
