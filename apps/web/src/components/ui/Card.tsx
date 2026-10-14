interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

export function Card({ children, className = "", ...props }: CardProps) {
  return (
    <div
      className={`bg-surface-50 rounded-2xl border border-white/5 p-6 hover-lift ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}