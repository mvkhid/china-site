export default function OfertaLayout({ subtitle, children }) {
  return (
    <div className="container" style={{ padding: "60px 40px 100px", maxWidth: 820 }}>
      <a
        href="/"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          color: "var(--text-muted)",
          fontSize: ".92rem",
          textDecoration: "none",
          marginBottom: 28,
        }}
      >
        ← На сайт
      </a>
      <span className="eyebrow" style={{ marginBottom: 14, display: "inline-flex" }}>
        Юридическая информация
      </span>
      <h1 className="modal-title">
        Публичная <span className="sec-title-accent">оферта</span>
      </h1>
      <p className="about-lead" style={{ fontWeight: 600, color: "var(--text-primary)" }}>
        {subtitle}
      </p>
      {children}
    </div>
  );
}
