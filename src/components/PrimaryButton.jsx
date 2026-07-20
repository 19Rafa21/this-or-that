export default function PrimaryButton({ children, className = "", ...props }) {
  return (
    <button
      type="button"
      className={`primary-button ${className}`.trim()}
      {...props}
    >
      {children}
    </button>
  );
}
