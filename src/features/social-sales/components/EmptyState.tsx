export function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className="mvp-empty-state">
      <h3>{title}</h3>
      <p className="mvp-subtle">{description}</p>
    </div>
  );
}
