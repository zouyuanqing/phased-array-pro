import type { ArrayConfig, BeamConfig } from "../api/client";

interface Props {
  array: ArrayConfig;
  beam: BeamConfig;
  onArray: (a: ArrayConfig) => void;
  onBeam: (b: BeamConfig) => void;
  onCompute: (a?: ArrayConfig, b?: BeamConfig) => void;
}

const slider = (label: string, value: number, min: number, max: number, step: number, onChange: (v: number) => void) => (
  <div style={{ marginBottom: "0.6rem" }}>
    <label style={{ fontSize: "0.8rem", color: "#8b949e", display: "flex", justifyContent: "space-between" }}>
      {label} <span style={{ color: "#4fc3f7", fontWeight: 600 }}>{value}{label.includes("°") ? "°" : label.includes("dB") ? " dB" : ""}</span>
    </label>
    <input type="range" min={min} max={max} step={step} value={value}
      onChange={e => onChange(+e.target.value)}
      style={{ width: "100%", height: 5, background: "#21262d", borderRadius: 3, appearance: "none", outline: "none" }} />
  </div>
);

const select = (label: string, value: string, opts: [string, string][], onChange: (v: string) => void) => (
  <div style={{ marginBottom: "0.6rem" }}>
    <label style={{ fontSize: "0.8rem", color: "#8b949e", display: "block", marginBottom: "0.2rem" }}>{label}</label>
    <select value={value} onChange={e => onChange(e.target.value)}
      style={{ width: "100%", padding: "0.4rem 0.6rem", background: "#0d1117", border: "1px solid #30363d", borderRadius: 6, color: "#c9d1d9", fontSize: "0.85rem" }}>
      {opts.map(([v, n]) => <option key={v} value={v}>{n}</option>)}
    </select>
  </div>
);

export function ControlPanel({ array, beam, onArray, onBeam, onCompute }: Props) {
  return (
    <>
      <div style={{ padding: "1rem 1.5rem", borderBottom: "1px solid #21262d" }}>
        <h3 style={{ fontSize: "0.8rem", textTransform: "uppercase", letterSpacing: "0.06em", color: "#8b949e", margin: "0 0 0.75rem" }}>Array Config</h3>
        {select("Geometry", array.geometry, [["rectangular", "Rectangular"], ["circular", "Circular"], ["triangular", "Triangular"]], v => onArray({ ...array, geometry: v as ArrayConfig["geometry"] }))}
        {slider("Nx", array.nx, 2, 32, 1, v => onArray({ ...array, nx: v }))}
        {slider("Ny", array.ny, 2, 32, 1, v => onArray({ ...array, ny: v }))}
        {slider("dx (λ)", array.dx, 0.1, 1.0, 0.05, v => onArray({ ...array, dx: v }))}
        {slider("dy (λ)", array.dy, 0.1, 1.0, 0.05, v => onArray({ ...array, dy: v }))}
      </div>
      <div style={{ padding: "1rem 1.5rem", borderBottom: "1px solid #21262d" }}>
        <h3 style={{ fontSize: "0.8rem", textTransform: "uppercase", letterSpacing: "0.06em", color: "#8b949e", margin: "0 0 0.75rem" }}>Beam Steering</h3>
        {slider("θ (elevation)", beam.theta_deg, -90, 90, 1, v => onBeam({ ...beam, theta_deg: v }))}
        {slider("φ (azimuth)", beam.phi_deg, 0, 360, 1, v => onBeam({ ...beam, phi_deg: v }))}
        {select("Taper", beam.taper, [["uniform", "Uniform"], ["taylor", "Taylor"], ["hamming", "Hamming"], ["hanning", "Hanning"]], v => onBeam({ ...beam, taper: v as BeamConfig["taper"] }))}
        {slider("SLL (dB)", beam.sidelobe_db, -60, -10, 5, v => onBeam({ ...beam, sidelobe_db: v }))}
      </div>
      <div style={{ padding: "1rem 1.5rem" }}>
        <button onClick={() => onCompute()} style={{ width: "100%", padding: "0.65rem", border: "none", borderRadius: 6, fontSize: "0.9rem", fontWeight: 600, cursor: "pointer", background: "linear-gradient(135deg, #4fc3f7, #7c4dff)", color: "#fff" }}>
          Compute Pattern
        </button>
        <div style={{ marginTop: "0.5rem", display: "flex", gap: "0.35rem" }}>
          {[{ label: "Broadside", t: 0, p: 0 }, { label: "45° Scan", t: 45, p: 45 }, { label: "End-fire", t: 90, p: 0 }].map(preset => (
            <button key={preset.label} onClick={() => {
              const newBeam = { ...beam, theta_deg: preset.t, phi_deg: preset.p };
              onBeam(newBeam);
              onCompute(array, newBeam);
            }}
              style={{ flex: 1, padding: "0.35rem", fontSize: "0.7rem", background: "#21262d", color: "#c9d1d9", border: "1px solid #30363d", borderRadius: 4, cursor: "pointer" }}>
              {preset.label}
            </button>
          ))}
        </div>
      </div>
    </>
  );
}
