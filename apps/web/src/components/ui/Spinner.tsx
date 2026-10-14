export function Spinner({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
  const sizes = {
    sm: "w-4 h-4",
    md: "w-8 h-8",
    lg: "w-12 h-12",
  };

  return (
    <div className="flex items-center justify-center py-12">
      <div
        className={`${sizes[size]} border-2 border-vybe-500/30 border-t-vybe-500 rounded-full animate-spin`}
      />
    </div>
  );
}