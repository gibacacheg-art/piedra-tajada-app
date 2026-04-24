export function PageIntro({
  eyebrow,
  title,
  description,
  actions
}: {
  eyebrow: string;
  title: string;
  description: string;
  actions?: React.ReactNode;
}) {
  return (
    <header className="mvp-page-intro">
      <div>
        <p className="mvp-kicker">{eyebrow}</p>
        <h2>{title}</h2>
        <p className="mvp-subtle">{description}</p>
      </div>
      {actions ? <div className="mvp-actions">{actions}</div> : null}
    </header>
  );
}
