# API 参考

Base URL: `http://localhost:8000`

## 通用类型

### ArrayConfig

```json
{
  "geometry": "rectangular",  // "rectangular" | "circular" | "triangular"
  "nx": 8,                    // X 轴阵元数 (2-64)
  "ny": 8,                    // Y 轴阵元数 (2-64)
  "dx": 0.5,                  // X 方向间距 (λ)
  "dy": 0.5                   // Y 方向间距 (λ)
}
```

### BeamConfig

```json
{
  "theta_deg": 0,             // 俯仰角 (-90 to 90)
  "phi_deg": 0,               // 方位角 (0 to 360)
  "taper": "taylor",          // "uniform" | "taylor" | "hamming" | "hanning"
  "sidelobe_db": -30          // 旁瓣抑制 (Taylor 目标, -60 to -10)
}
```

### PatternResult

```json
{
  "type": "3d",
  "metadata": {
    "geometry": "rectangular",
    "n_elements": 64,
    "nx": 8, "ny": 8,
    "spacing": { "dx": 0.5, "dy": 0.5 },
    "beam_direction": { "theta_deg": 30, "phi_deg": 45 },
    "taper": "taylor",
    "first_sidelobe_db": -29.8,
    "estimated_beamwidth_deg": 12.75,
    "backend": "cpu_rayon",
    "impairments": {}
  },
  "theta_deg": [0.0, ..., 180.0],   // 122 points
  "phi_deg": [0.0, ..., 360.0],     // 122 points
  "pattern_db": [[...], ...],       // 122×122 matrix
  "cut_through_beam": {
    "theta_deg": [-90, ..., 90],    // 181 points
    "pattern_db": [...]             // 181 values
  }
}
```

---

## Endpoints

### GET /api/health

健康检查。

**Response:**
```json
{
  "status": "healthy",
  "version": "0.1.0",
  "backend": "rust",
  "cuda_available": false
}
```

### GET /api/geometries

支持的阵列几何形状。

### POST /api/compute-pattern

计算波束方向图。

**Request:**
```json
{
  "array": { "geometry": "rectangular", "nx": 16, "ny": 16, "dx": 0.5, "dy": 0.5 },
  "beam": { "theta_deg": 30, "phi_deg": 0, "taper": "taylor", "sidelobe_db": -30 },
  "pattern_type": "3d",
  "resolution": 61
}
```

`resolution` 控制角度分辨率。61 → θ: 122点, φ: 122点。

### POST /api/element-positions

获取阵元坐标。

**Request:** `ArrayConfig`

**Response:**
```json
{
  "n_elements": 256,
  "positions": [
    { "x": -3.75, "y": -3.75, "z": 0.0 },
    ...
  ]
}
```

### POST /api/music

MUSIC DOA 估计。

**Request:**
```json
{
  "n_elements": 16,
  "n_snapshots": 500,
  "source_angles_deg": [-10, 5],
  "snr_db": 20
}
```

**Response:**
```json
{
  "theta_deg": [-90, ..., 90],
  "spectrum_db": [...],
  "true_angles": [-10, 5],
  "n_elements": 16,
  "n_snapshots": 500,
  "snr_db": 20
}
```

### POST /api/esprit

ESPRIT DOA 估计。请求同 MUSIC。

**Response:**
```json
{
  "estimated_angles_deg": [-10.0, 5.0],
  "true_angles_deg": [-10, 5]
}
```

### POST /api/mvdr

MVDR/Capon 自适应波束形成。请求同 MUSIC。

### POST /api/pattern-realistic

含真实物理效应的方向图。

**Request:**
```json
{
  "array": { ... },
  "beam": { ... },
  "element_q": 1.5,
  "coupling_strength": 0.1,
  "phase_bits": 4,
  "failure_rate": 0.05,
  "pattern_type": "3d",
  "resolution": 61
}
```

**Response:** `PatternResult`，metadata 含 `impairments` 字段。

### POST /api/beam-squint

宽带波束 squint 分析。

**Request:**
```json
{
  "n_elements": 16,
  "spacing": 0.5,
  "theta_steer_deg": 30,
  "f0": 10,
  "bandwidth_ghz": 4
}
```

**Response:**
```json
{
  "frequency_ghz": [8.0, ..., 12.0],
  "theta_actual_deg": [38.7, ..., 24.6],
  "squint_error_deg": [8.7, ..., -5.4],
  "design_freq_ghz": 10,
  "design_theta_deg": 30
}
```

## 错误响应

所有端点返回 500 时包含：
```json
{ "detail": "Error description" }
```
