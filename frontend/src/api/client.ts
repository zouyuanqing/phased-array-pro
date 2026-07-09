// Type-safe API client for Phased Array Simulator (Rust backend)

const API = "http://localhost:8000";

export interface ArrayConfig {
  geometry: "rectangular" | "circular" | "triangular";
  nx: number; ny: number; dx: number; dy: number;
}

export interface BeamConfig {
  theta_deg: number; phi_deg: number;
  taper: "uniform" | "taylor" | "hamming" | "hanning";
  sidelobe_db: number;
}

export interface PatternMetadata {
  geometry: string; n_elements: number; nx: number; ny: number;
  spacing: { dx: number; dy: number };
  beam_direction: { theta_deg: number; phi_deg: number };
  taper: string; main_lobe_db: number;
  first_sidelobe_db: number; estimated_beamwidth_deg: number;
  backend: string; impairments?: Record<string, unknown>;
}

export interface PatternResult {
  type: string; metadata: PatternMetadata;
  theta_deg: number[]; phi_deg: number[];
  pattern_db: number[][];
  cut_through_beam: { theta_deg: number[]; pattern_db: number[] };
}

export interface DOAResult {
  theta_deg: number[]; spectrum_db: number[]; true_angles: number[];
}

export interface EspritResult {
  estimated_angles_deg: number[]; true_angles_deg: number[];
}

export interface HealthResult {
  status: string; version: string; backend: string; cuda_available: boolean;
}

export async function health(): Promise<HealthResult> {
  return fetch(`${API}/api/health`).then(r => r.json());
}

export async function computePattern(a: ArrayConfig, b: BeamConfig, resolution = 61): Promise<PatternResult> {
  return fetch(`${API}/api/compute-pattern`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ array: a, beam: b, pattern_type: "3d", resolution }),
  }).then(r => r.json());
}

export async function computeDOA(
  method: "music" | "esprit" | "mvdr",
  n_elements: number, n_snapshots: number,
  source_angles_deg: number[], snr_db: number
): Promise<DOAResult | EspritResult> {
  const ep = method === "esprit" ? "/api/esprit" : method === "mvdr" ? "/api/mvdr" : "/api/music";
  return fetch(`${API}${ep}`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ n_elements, n_snapshots, source_angles_deg, snr_db }),
  }).then(r => r.json());
}

export async function computeRealistic(
  a: ArrayConfig, b: BeamConfig,
  opts: { element_q?: number; coupling_strength?: number; phase_bits?: number; failure_rate?: number; resolution?: number }
): Promise<PatternResult> {
  return fetch(`${API}/api/pattern-realistic`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ array: a, beam: b, element_q: opts.element_q ?? 0, coupling_strength: opts.coupling_strength ?? 0, phase_bits: opts.phase_bits ?? 0, failure_rate: opts.failure_rate ?? 0, pattern_type: "3d", resolution: opts.resolution ?? 61 }),
  }).then(r => r.json());
}
