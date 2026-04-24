export function MetricCard({ label, value, helper }: { label: string; value: string; helper: string }) {
  return (
    <article className="mvp-metric-card">
      <p className="mvp-subtle">{label}</p>
      <strong>{value}</strong>
      <span>{helper}</span>
    </article>
  );
}
