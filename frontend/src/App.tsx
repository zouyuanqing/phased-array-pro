import { useState, useCallback, useEffect, useRef } from "react";
import { Viewer3D } from "./components/Viewer3D";
import { ControlPanel } from "./components/ControlPanel";
import { DOAPanel } from "./components/DOAPanel";
import { PhysicsPanel } from "./components/PhysicsPanel";
import { InfoOverlay } from "./components/InfoOverlay";
import { computePattern, computeDOA, computeRealistic, type PatternResult, type ArrayConfig, type BeamConfig } from "./api/client";

export default function App() {
  const [pattern, setPattern] = useState<PatternResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");

  const [array, setArray] = useState<ArrayConfig>({
    geometry: "rectangular", nx: 8, ny: 8, dx: 0.5, dy: 0.5,
  });
  const [beam, setBeam] = useState<BeamConfig>({
    theta_deg: 0, phi_deg: 0, taper: "uniform", sidelobe_db: -30,
  });

  const doCompute = useCallback(async (a?: ArrayConfig, b?: BeamConfig) => {
    setLoading(true);
    try {
      const r = await computePattern(a ?? array, b ?? beam, 61);
      setPattern(r);
    } catch (e: unknown) {
      setMsg(`Error: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setLoading(false);
    }
  }, [array, beam]);

  // Debounced auto-compute on array/beam change
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const doComputeRef = useRef(doCompute);
  doComputeRef.current = doCompute;
  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => doComputeRef.current(), 400);
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [array, beam]);

  const doDOA = useCallback(async (method: "music" | "esprit" | "mvdr", n: number, snaps: number, angles: number[], snr: number) => {
    setLoading(true);
    try {
      const r = await computeDOA(method, n, snaps, angles, snr);
      if ("estimated_angles_deg" in r) {
        setMsg(`ESPRIT: ${r.estimated_angles_deg.map(a => a.toFixed(1) + "°").join(", ")}  |  True: ${r.true_angles_deg.map(a => a + "°").join(", ")}`);
      } else {
        const peaks: number[] = [];
        for (let i = 1; i < r.spectrum_db.length - 1; i++) {
          if (r.spectrum_db[i] > r.spectrum_db[i - 1] && r.spectrum_db[i] > r.spectrum_db[i + 1] && r.spectrum_db[i] > -5) {
            peaks.push(r.theta_deg[i]);
          }
        }
        setMsg(`${method.toUpperCase()} peaks: ${peaks.map(a => a.toFixed(1) + "°").join(", ")}`);
      }
    } catch (e: unknown) {
      setMsg(`DOA error: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setLoading(false);
    }
  }, []);

  const doRealistic = useCallback(async (opts: { element_q?: number; coupling_strength?: number; phase_bits?: number; failure_rate?: number }) => {
    setLoading(true);
    try {
      const r = await computeRealistic(array, beam, opts);
      setPattern(r);
      const imp = r.metadata.impairments || {};
      const parts: string[] = [];
      if (imp.element_pattern) parts.push(`cos^${(imp.element_pattern as Record<string,unknown>).q}`);
      if (imp.mutual_coupling) parts.push(`coupling ${(imp.mutual_coupling as Record<string,unknown>).strength}`);
      if (imp.phase_quantization) parts.push(`${(imp.phase_quantization as Record<string,unknown>).bits}-bit`);
      if (imp.element_failures) parts.push(`${(imp.element_failures as Record<string,unknown>).n_failed} failed`);
      setMsg(parts.length ? "Effects: " + parts.join(" | ") : "No impairments");
    } catch (e: unknown) {
      setMsg(`Realistic error: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setLoading(false);
    }
  }, [array, beam]);

  return (
    <div style={{ display: "flex", height: "100vh", background: "#0d1117", color: "#c9d1d9", fontFamily: "system-ui, sans-serif" }}>
      {/* Sidebar */}
      <aside style={{ width: 340, minWidth: 340, background: "#161b22", borderRight: "1px solid #21262d", overflowY: "auto", display: "flex", flexDirection: "column" }}>
        <div style={{ padding: "1.2rem 1.5rem", borderBottom: "1px solid #21262d" }}>
          <h2 style={{ fontSize: "1.25rem", fontWeight: 600, background: "linear-gradient(135deg, #4fc3f7, #7c4dff)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", margin: 0 }}>
            Phased Array Simulator
          </h2>
          <p style={{ fontSize: "0.78rem", color: "#8b949e", margin: "0.25rem 0 0" }}>Rust + CUDA + React</p>
        </div>
        <ControlPanel array={array} beam={beam} onArray={setArray} onBeam={setBeam} onCompute={doCompute} />
        <DOAPanel onCompute={doDOA} />
        <PhysicsPanel onCompute={doRealistic} />
      </aside>

      {/* Main 3D View */}
      <main style={{ flex: 1, position: "relative" }}>
        <Viewer3D pattern={pattern} thetaDeg={beam.theta_deg} phiDeg={beam.phi_deg} arrayConfig={array} />
        <InfoOverlay pattern={pattern} />
        {loading && (
          <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)", background: "rgba(22,27,34,0.95)", border: "1px solid #30363d", borderRadius: 12, padding: "2rem", textAlign: "center", zIndex: 10 }}>
            <div style={{ width: 32, height: 32, border: "3px solid #30363d", borderTopColor: "#4fc3f7", borderRadius: "50%", animation: "spin 0.8s linear infinite", margin: "0 auto 0.75rem" }} />
            <div>Computing...</div>
          </div>
        )}
        {msg && (
          <div style={{ position: "absolute", top: "1rem", left: "50%", transform: "translateX(-50%)", background: "rgba(22,27,34,0.95)", border: "1px solid #30363d", borderRadius: 8, padding: "0.75rem 1.5rem", color: "#4fc3f7", fontSize: "0.85rem", zIndex: 10, maxWidth: "80%", textAlign: "center" }}>
            {msg}
          </div>
        )}
      </main>
    </div>
  );
}
