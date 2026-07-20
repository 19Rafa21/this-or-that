export default function SmallNavButton({ children, className = "", ...props }) {
  return (
    <button
      type="button"
      className={`small-nav-button ${className}`.trim()}
      {...props}
    >
      {children}
    </button>
  );
}
