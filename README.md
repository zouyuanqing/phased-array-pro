# Phased Array Pro

**GPU 加速相控阵雷达波束聚合模拟器** — Rust + CUDA + React + Three.js

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Rust](https://img.shields.io/badge/Rust-1.96+-orange.svg)](https://rust-lang.org)
[![CUDA](https://img.shields.io/badge/CUDA-13.2-green.svg)](https://developer.nvidia.com/cuda-toolkit)
[![React](https://img.shields.io/badge/React-19-61dafb.svg)](https://react.dev)

## 概述

相控阵雷达通过控制各阵元的相位差实现电子扫描，无需机械转动。本项目提供：

- **3D 交互式波束方向图可视化**（Three.js / React Three Fiber）
- **超分辨 DOA 估计**（MUSIC / ESPRIT / MVDR）
- **真实物理建模**（单元方向图、互耦合、相位量化、宽带 squint、阵元故障）
- **CUDA GPU 加速 + Rayon 多核 CPU 并行**

## 架构

```
phased-array-pro/
├── backend/                    # Rust 后端
│   ├── Cargo.toml
│   ├── src/
│   │   ├── main.rs             # Axum HTTP server (10 endpoints)
│   │   ├── array.rs            # 阵列几何生成
│   │   ├── beamforming.rs      # AF / 波束形成 / Taylor 锥削 (Rayon 并行)
│   │   ├── super_res.rs        # MUSIC / ESPRIT / MVDR
│   │   ├── physics.rs          # cos^q / 互耦合 / 相位量化 / squint / 故障
│   │   └── gpu/
│   │       ├── mod.rs          # GPU 调度 + CPU fallback
│   │       └── cuda_ffi.rs     # CUDA Driver API FFI (libloading)
│   └── kernels/
│       ├── kernels.cu          # CUDA C kernel 源码
│       └── kernels.ptx         # 预编译 PTX (include_bytes! 嵌入)
├── frontend/                   # React + TypeScript 前端
│   ├── package.json
│   ├── vite.config.ts
│   └── src/
│       ├── App.tsx             # 主布局 + 状态管理 + auto-compute
│       ├── api/client.ts       # 类型安全 API 客户端
│       └── components/
│           ├── Viewer3D.tsx    # @react-three/fiber 3D 场景
│           ├── ControlPanel.tsx# 阵列 + 波束控制面板
│           ├── DOAPanel.tsx    # MUSIC/ESPRIT/MVDR 面板
│           ├── PhysicsPanel.tsx# 真实物理效应面板
│           └── InfoOverlay.tsx # 元数据面板
├── docs/                       # 文档
│   ├── architecture.md         # 架构设计
│   ├── api-reference.md        # API 参考
│   ├── physics.md              # 物理模型
│   └── development.md          # 开发指南
├── LICENSE                     # MIT
└── README.md
```

## 快速启动

### 环境要求

- Rust 1.96+
- Node.js 20+
- CUDA Toolkit 13.2（可选，用于 GPU 加速；无 CUDA 时自动 CPU 模式）
- Windows / Linux / macOS

### 1. 启动后端

```bash
cd backend
cargo run --release
```

后端运行在 `http://localhost:8000`，API 文档 `http://localhost:8000/docs`

### 2. 启动前端

```bash
cd frontend
npm install
npm run dev
```

打开 `http://localhost:5173`

### 3. 编译 CUDA Kernel（可选）

```bash
cd backend/kernels
nvcc -ptx -arch=sm_75 -o kernels.ptx kernels.cu
```

PTX 会在 Rust 编译时通过 `include_bytes!` 嵌入二进制。

## 物理原理

### 阵列因子

$$AF(\theta,\phi) = \sum_{n=1}^{N} w_n \cdot e^{j\frac{2\pi}{\lambda}(x_n\sin\theta\cos\phi + y_n\sin\theta\sin\phi)}$$

### 波束宽度（3 dB）

$$\Delta\theta_{3dB} \approx \frac{51\degree}{N \cdot d/\lambda}$$

### 波束 Squint

$$\sin\theta_{actual} = \frac{f_0}{f} \cdot \sin\theta_{design}$$

### MUSIC 伪谱

$$P_{MUSIC}(\theta) = \frac{1}{\mathbf{a}^H(\theta) \mathbf{E}_n \mathbf{E}_n^H \mathbf{a}(\theta)}$$

## API 参考

| 端点 | 方法 | 说明 |
|------|------|------|
| `/api/health` | GET | 健康检查（返回 backend、CUDA 状态） |
| `/api/geometries` | GET | 支持的阵列几何形状 |
| `/api/compute-pattern` | POST | 计算波束方向图（3D/2D/切面） |
| `/api/element-positions` | POST | 获取阵元位置 |
| `/api/music` | POST | MUSIC DOA 超分辨估计 |
| `/api/esprit` | POST | ESPRIT DOA 估计 |
| `/api/mvdr` | POST | MVDR/Capon 自适应波束形成 |
| `/api/pattern-realistic` | POST | 含真实物理效应的方向图 |
| `/api/beam-squint` | POST | 宽带波束 squint 分析 |

详细参数见 [docs/api-reference.md](docs/api-reference.md)

## 性能

| 场景 | CPU (Rayon) | GPU (CUDA) |
|------|-------------|------------|
| 16×16 阵列, 122×122 网格 | ~15 ms | ~0.5 ms |
| 32×32 阵列, 182×182 网格 | ~80 ms | ~2 ms |
| MUSIC (16 elem, 500 snap) | ~5 ms | ~0.3 ms |

*实测于 RTX 5070 Laptop GPU + AMD Ryzen*

## 功能清单

- [x] 3 种阵列几何（矩形 / 圆形 / 三角形）
- [x] 4 种幅度锥削（Uniform / Taylor / Hamming / Hanning）
- [x] 实时角度偏转（θ / φ 滑块 + 3D 实时更新）
- [x] 3D 辐射方向图（指数增益映射，主瓣尖峰清晰可见）
- [x] E-plane / H-plane 切面图
- [x] MUSIC 超分辨 DOA
- [x] ESPRIT 闭式解 DOA
- [x] MVDR / Capon 自适应波束形成
- [x] 单元方向图 cos^q(θ)
- [x] 互耦合矩阵（Toeplitz）
- [x] 相位量化（n-bit 移相器模拟）
- [x] 阵元故障模拟（开路 / 短路 / 漂移）
- [x] 宽带波束 squint 分析
- [x] CUDA GPU 加速 + CPU Rayon fallback
- [x] PTX 嵌入二进制（include_bytes!）
- [x] TypeScript 类型安全 API 客户端

## License

MIT © 2026 邹源清 (zouyuanqing)
