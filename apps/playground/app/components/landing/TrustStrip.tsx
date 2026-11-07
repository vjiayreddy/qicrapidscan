const FRAMEWORKS = ["React", "Vanilla JS", "Vue", "Angular", "CDN"] as const;

export function TrustStrip() {
  return (
    <div className="pg-trust">
      <span className="pg-trust__label">Works with</span>
      <ul className="pg-trust__items">
        {FRAMEWORKS.map((name) => (
          <li key={name}>{name}</li>
        ))}
      </ul>
    </div>
  );
}
