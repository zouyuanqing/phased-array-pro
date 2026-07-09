# 架构设计

## 系统架构

```
┌─────────────────────────────────────────────┐
│                  Browser                    │
│  ┌───────────────────────────────────────┐  │
│  │   React + Three.js (Vite)             │  │
│  │   ┌─────────┐ ┌──────────┐ ┌───────┐  │  │
│  │   │Viewer3D │ │Controls  │ │DOA    │  │  │
│  │   │(R3F)    │ │Panel     │ │Panel  │  │  │
│  │   └────┬────┘ └────┬─────┘ └───┬───┘  │  │
│  │        │           │           │       │  │
│  │   ┌────┴───────────┴───────────┴───┐   │  │
│  │   │     api/client.ts (fetch)      │   │  │
│  │   └───────────────┬───────────────┘   │  │
│  └───────────────────┼───────────────────┘  │
└──────────────────────┼──────────────────────┘
                       │ HTTP
┌──────────────────────┼──────────────────────┐
│               Rust Backend                  │
│  ┌───────────────┴────────────────────┐     │
│  │   Axum HTTP Server (Tokio async)   │     │
│  │   ┌─────┐ ┌──────┐ ┌────────────┐  │     │
│  │   │beam │ │super │ │physics     │  │     │
│  │   │form │ │_res  │ │            │  │     │
│  │   └──┬──┘ └──┬───┘ └─────┬──────┘  │     │
│  └──────┼───────┼────────────┼─────────┘     │
│         │       │            │               │
│  ┌──────┴───────┴────────────┴─────────┐    │
│  │         GPU Dispatch Layer          │    │
│  │  ┌──────────┐  ┌────────────────┐   │    │
│  │  │ CUDA FFI │  │ CPU Rayon      │   │    │
│  │  │(nvcuda)  │  │ (par_iter)     │   │    │
│  │  └────┬─────┘  └───────┬────────┘   │    │
│  └───────┼────────────────┼────────────┘    │
└──────────┼────────────────┼─────────────────┘
           │ GPU            │ CPU
    ┌──────┴──────┐  ┌──────┴──────┐
    │ CUDA cores  │  │ CPU cores   │
    │ (RTX 5070)  │  │ (Ryzen)     │
    └─────────────┘  └─────────────┘
```

## 数据流

### 波束计算请求

1. 前端滑块变化 → `useEffect` debounce 400ms → `computePattern()`
2. `api/client.ts` → `POST /api/compute-pattern` (JSON)
3. Axum handler → `generate_positions()` + `apply_taper()` + `steering_vector()`
4. `gpu::compute_array_factor()` → 尝试 CUDA → 失败则 CPU fallback
5. 归一化 → 转 Array2 → JSON response
6. 前端 `PatternMesh` → 构建 BufferGeometry → Three.js 渲染

### DOA 估计请求

1. 前端 `DOAPanel` → `computeDOA("music", ...)`
2. `POST /api/music` → `generate_snapshots()` → `music_ula()`
3. 协方差矩阵 → `eigh` 特征分解 → 噪声子空间投影 → 伪谱
4. 返回 `{theta_deg, spectrum_db}` → 前端 Canvas 渲染谱图

## GPU 调度策略

```rust
// gpu/mod.rs
pub fn compute_array_factor(...) -> Vec<f64> {
    if cuda_ffi::available() {
        match array_factor_cuda(...) {   // PTX → cuLaunchKernel
            Ok(result) => return result, // GPU 成功
            Err(e) => warn!("GPU fail: {}", e), // 降级
        }
    }
    array_factor_cpu(...)  // Rayon CPU fallback
}
```

CUDA kernel 在 `kernels/kernels.cu`，编译为 PTX，`include_bytes!` 嵌入二进制。

## 性能关键路径

| 操作 | 复杂度 | 加速方式 |
|------|--------|----------|
| Array Factor | O(N × nθ × nφ) | CUDA 并行 (1 thread/pair) / Rayon 分片 |
| Beam Cut | O(N × n) | CUDA / Rayon |
| MUSIC EVD | O(M³) | Jacobi 迭代 (纯 Rust) |
| Taylor Taper | O(N) | 解析公式，无循环 |
| 互耦合 | O(N²) | 双循环，N ≤ 1024 |

## 目录结构

```
backend/src/
├── main.rs           # 入口 + 路由 (10 endpoints, ~380 lines)
├── lib.rs            # 模块导出
├── array.rs          # 几何生成 (矩形/圆形/三角形)
├── beamforming.rs    # AF + 锥削 + 波束切割
├── super_res.rs      # MUSIC + ESPRIT + MVDR
├── physics.rs        # cos^q / 耦合 / 量化 / squint / 故障
└── gpu/
    ├── mod.rs        # 调度层 (CUDA dispatch + CPU fallback)
    └── cuda_ffi.rs   # libloading → nvcuda.dll
```

```
frontend/src/
├── App.tsx           # 主布局 + 状态 + auto-compute
├── api/client.ts     # 类型安全 fetch 封装
├── components/
│   ├── Viewer3D.tsx  # @react-three/fiber Canvas
│   ├── ControlPanel.tsx
│   ├── DOAPanel.tsx
│   ├── PhysicsPanel.tsx
│   └── InfoOverlay.tsx
└── main.tsx          # React 入口
```
