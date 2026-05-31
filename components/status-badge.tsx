type StatusBadgeProps = {
  children: string;
  tone?: "neutral" | "success" | "warning" | "danger";
};

export function StatusBadge({ children, tone = "neutral" }: StatusBadgeProps) {
  return <span className={`badge badge-${tone}`}>{children}</span>;
}
