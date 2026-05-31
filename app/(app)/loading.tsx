export default function AppLoading() {
  return (
    <div className="page">
      <section className="grid grid-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div className="card skeleton-card" key={index}>
            <div className="skeleton-line skeleton-line-short" />
            <div className="skeleton-line skeleton-line-large" />
          </div>
        ))}
      </section>

      <section className="table-card">
        <div className="section-header">
          <div className="stack">
            <div className="skeleton-line skeleton-line-medium" />
          </div>
        </div>
        <div className="stack">
          <div className="skeleton-row" />
          <div className="skeleton-row" />
          <div className="skeleton-row" />
        </div>
      </section>
    </div>
  );
}
