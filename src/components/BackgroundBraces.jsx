export default function BackgroundBraces({ variant = "default" }) {
  return (
    <div className={`background-braces ${variant}`} aria-hidden="true">
      <span className="brace brace-left">{"{"}</span>
      <span className="brace brace-right">{"}"}</span>
    </div>
  );
}
