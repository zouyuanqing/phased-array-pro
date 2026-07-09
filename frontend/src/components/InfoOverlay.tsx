import type { PatternResult } from "../api/client";

export function InfoOverlay({ pattern }: { pattern: PatternResult | null }) {
  if (!pattern) return null;
  const m = pattern.metadata;
  return (
    <div style={{ position: "absolute", top: "1rem", right: "1rem", background: "rgba(22,27,34,0.92)", border: "1px solid #30363d", borderRadius: 8, padding: "1rem", minWidth: 180, backdropFilter: "blur(8px)" }}>
      <Row label="Beam" value={`θ:${m.beam_direction.theta_deg}° φ:${m.beam_direction.phi_deg}°`} />
      <Row label="Array" value={`${m.nx}×${m.ny} (${m.n_elements} elem)`} />
      <Row label="Main lobe" value="0.0 dB" />
      <Row label="Sidelobe" value={`${m.first_sidelobe_db.toFixed(1)} dB`} />
      <Row label="Beamwidth" value={`${m.estimated_beamwidth_deg}°`} />
      <Row label="Backend" value={m.backend} />
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.4rem", fontSize: "0.8rem" }}>
      <span style={{ color: "#8b949e" }}>{label}</span>
      <span style={{ color: "#4fc3f7", fontWeight: 600 }}>{value}</span>
    </div>
  );
}
