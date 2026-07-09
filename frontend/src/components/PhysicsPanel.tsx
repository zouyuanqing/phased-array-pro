import { useState } from "react";

interface Props {
  onCompute: (opts: { element_q?: number; coupling_strength?: number; phase_bits?: number; failure_rate?: number }) => void;
}

export function PhysicsPanel({ onCompute }: Props) {
  const [elemQ, setElemQ] = useState(0);
  const [coupling, setCoupling] = useState(0);
  const [bits, setBits] = useState(0);
  const [failRate, setFailRate] = useState(0);

  return (
    <div style={{ padding: "1rem 1.5rem", borderBottom: "1px solid #21262d" }}>
      <h3 style={{ fontSize: "0.8rem", textTransform: "uppercase", letterSpacing: "0.06em", color: "#8b949e", margin: "0 0 0.75rem" }}>Realistic Physics</h3>
      <Slider label="Element cos^q" value={elemQ} min={0} max={3} step={0.25} onChange={setElemQ} />
      <Slider label="Coupling" value={coupling} min={0} max={0.5} step={0.02} onChange={setCoupling} />
      <Slider label="Phase bits" value={bits} min={0} max={8} onChange={setBits} display={v => v === 0 ? "off" : `${v} bit`} />
      <Slider label="Failures" value={failRate} min={0} max={0.3} step={0.01} onChange={setFailRate} display={v => `${Math.round(v * 100)}%`} />
      <button onClick={() => onCompute({ element_q: elemQ, coupling_strength: coupling, phase_bits: bits, failure_rate: failRate })}
        style={{ width: "100%", padding: "0.5rem", border: "none", borderRadius: 6, fontSize: "0.8rem", cursor: "pointer", background: "linear-gradient(135deg, #4fc3f7, #7c4dff)", color: "#fff", marginTop: "0.5rem" }}>
        Compute w/ Effects
      </button>
    </div>
  );
}

function Slider({ label, value, min, max, step = 1, onChange, display }: {
  label: string; value: number; min: number; max: number; step?: number; onChange: (v: number) => void; display?: (v: number) => string;
}) {
  return (
    <div style={{ marginBottom: "0.4rem" }}>
      <label style={{ fontSize: "0.8rem", color: "#8b949e", display: "flex", justifyContent: "space-between" }}>
        {label} <span style={{ color: "#4fc3f7" }}>{display ? display(value) : value}</span>
      </label>
      <input type="range" min={min} max={max} step={step} value={value} onChange={e => onChange(+e.target.value)}
        style={{ width: "100%", height: 4, background: "#21262d", borderRadius: 2, appearance: "none" }} />
    </div>
  );
}
