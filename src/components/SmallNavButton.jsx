export default function SmallNavButton({ children, onClick, className = "" }) {
  return (
    <button className={`small-nav-button ${className}`} onClick={onClick}>
      {children}
    </button>
  );
}