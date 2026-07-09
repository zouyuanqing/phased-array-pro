# 开发指南

## 环境搭建

### Rust 后端

```bash
# 安装 Rust
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# 编译
cd backend
cargo build

# 运行
cargo run --release
```

### CUDA Kernel 编译

```bash
cd backend/kernels

# 查看 GPU 计算能力
nvidia-smi --query-gpu=compute_cap --format=csv

# 编译 PTX（替换 sm_XX 为实际值）
nvcc -ptx -arch=sm_75 -o kernels.ptx kernels.cu
```

### TypeScript 前端

```bash
cd frontend
npm install

# 开发模式（HMR 热更新）
npm run dev

# 生产构建
npm run build
```

## 项目约定

### Rust 代码风格

- 使用 `cargo fmt` 自动格式化
- 使用 `cargo clippy` 检查 lint
- 模块按功能分离：`array.rs` / `beamforming.rs` / `super_res.rs` / `physics.rs`
- GPU 相关的所有代码在 `src/gpu/` 下

### TypeScript 代码风格

- Vite + React 19 + TypeScript 6
- 组件放在 `src/components/`
- API 类型和 fetch 封装在 `src/api/client.ts`
- 使用 `@react-three/fiber` 进行 3D 渲染，不直接操作 Three.js

### CUDA Kernel 设计

- 每个 kernel 只做一件事
- Grid 大小: `ceil(N / 256)` blocks × 256 threads
- 使用 `double` 精度（`f64`）
- 避免 shared memory bank conflicts
- Kernel 编译参数: `-arch=sm_75`（兼容 Turing+）

## 添加新功能

### 添加新 API 端点

1. 在 `backend/src/main.rs` 添加 handler 函数
2. 在 `Router::new()` 注册路由
3. 在 `frontend/src/api/client.ts` 添加类型和 fetch 函数
4. 在文档 `docs/api-reference.md` 添加说明

### 添加新的物理效应

1. 在 `backend/src/physics.rs` 添加实现
2. 在 `POST /api/pattern-realistic` handler 中接入
3. 在 `frontend/src/components/PhysicsPanel.tsx` 添加控件

### 添加新的 DOA 算法

1. 在 `backend/src/super_res.rs` 添加实现
2. 在 `backend/src/main.rs` 添加路由和 handler
3. 在 `frontend/src/components/DOAPanel.tsx` method 下拉框中添加选项

## 调试

### 后端日志

```bash
RUST_LOG=debug cargo run
```

日志输出到 stdout，包含 CUDA 初始化状态和 GPU/CPU 调度记录。

### 前端调试

浏览器 DevTools → Network 标签查看 API 请求。Redux DevTools（如果安装）查看 state 变化。

### CUDA Kernel 调试

```bash
# 用 cuobjdump 查看 PTX
cuobjdump -sass kernels.ptx

# 用 nvprof 性能分析
nvprof --print-gpu-trace ./target/debug/phased-array-rs

# 用 compute-sanitizer 检查内存错误
compute-sanitizer ./target/debug/phased-array-rs
```

## 性能调优

### CUDA Kernel 优化方向

1. **内存合并**: 确保 `x`, `y`, `w_real`, `w_imag` 的访问模式对全局内存友好
2. **共享内存**: 将 `sin_theta`, `cos_phi`, `sin_phi` 缓存到 shared memory
3. **Occupancy**: 调整 block size 优化 SM 占用率
4. **FMA**: 使用 `fma()` 指令减少精度损失

### CPU 优化方向

1. Rayon `par_chunks_mut` 按 theta 维度分片（每线程计算完整 phi 行）
2. SIMD: 可考虑使用 `std::simd`（nightly）或 `packed_simd`
3. Cache: x, y, weights 数据量小，L1 cache 常驻

## 常见问题

### Q: CUDA 初始化失败？

检查 nvcuda.dll 是否在 PATH（通常在 `C:\Windows\System32`）。日志会显示具体失败原因。

### Q: 前端连不上后端？

CORS 已配置允许所有来源。检查后端是否在 8000 端口运行。

### Q: 3D 方向图看起来是球体？

检查 pattern data 是否归一化（max 应为 0 dB）。GPU 返回的 AF 需要在 Rust 侧归一化。
