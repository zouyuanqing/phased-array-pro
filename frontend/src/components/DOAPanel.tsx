import { useState } from "react";

interface Props {
  onCompute: (method: "music" | "esprit" | "mvdr", n: number, snaps: number, angles: number[], snr: number) => void;
}

export function DOAPanel({ onCompute }: Props) {
  const [method, setMethod] = useState<"music" | "esprit" | "mvdr">("music");
  const [n, setN] = useState(16);
  const [snaps, setSnaps] = useState(500);
  const [snr, setSnr] = useState(20);
  const [angles, setAngles] = useState("-10, 5");

  const doIt = () => {
    const a = angles.split(",").map(s => +s.trim()).filter(x => !isNaN(x));
    onCompute(method, n, snaps, a, snr);
  };

  return (
    <div style={{ padding: "1rem 1.5rem", borderBottom: "1px solid #21262d" }}>
      <h3 style={{ fontSize: "0.8rem", textTransform: "uppercase", letterSpacing: "0.06em", color: "#8b949e", margin: "0 0 0.75rem" }}>Super-Res DOA</h3>
      <select value={method} onChange={e => setMethod(e.target.value as typeof method)}
        style={{ width: "100%", padding: "0.4rem", background: "#0d1117", border: "1px solid #30363d", borderRadius: 6, color: "#c9d1d9", fontSize: "0.85rem", marginBottom: "0.5rem" }}>
        <option value="music">MUSIC</option>
        <option value="esprit">ESPRIT</option>
        <option value="mvdr">MVDR / Capon</option>
      </select>
      <Slider label="Elements" value={n} min={4} max={64} onChange={setN} />
      <Slider label="Snapshots" value={snaps} min={50} max={2000} step={50} onChange={setSnaps} />
      <Slider label="SNR (dB)" value={snr} min={-5} max={40} onChange={setSnr} />
      <div style={{ marginBottom: "0.5rem" }}>
        <label style={{ fontSize: "0.8rem", color: "#8b949e" }}>Sources (°)</label>
        <input type="text" value={angles} onChange={e => setAngles(e.target.value)}
          style={{ width: "100%", padding: "0.4rem", background: "#0d1117", border: "1px solid #30363d", borderRadius: 6, color: "#c9d1d9", fontSize: "0.85rem", marginTop: "0.2rem" }} />
      </div>
      <button onClick={doIt} style={{ width: "100%", padding: "0.5rem", border: "none", borderRadius: 6, fontSize: "0.8rem", cursor: "pointer", background: "linear-gradient(135deg, #4fc3f7, #7c4dff)", color: "#fff" }}>
        Estimate DOA
      </button>
    </div>
  );
}

function Slider({ label, value, min, max, step = 1, onChange }: { label: string; value: number; min: number; max: number; step?: number; onChange: (v: number) => void }) {
  return (
    <div style={{ marginBottom: "0.4rem" }}>
      <label style={{ fontSize: "0.8rem", color: "#8b949e", display: "flex", justifyContent: "space-between" }}>
        {label} <span style={{ color: "#4fc3f7" }}>{value}</span>
      </label>
      <input type="range" min={min} max={max} step={step} value={value} onChange={e => onChange(+e.target.value)}
        style={{ width: "100%", height: 4, background: "#21262d", borderRadius: 2, appearance: "none" }} />
    </div>
  );
}
