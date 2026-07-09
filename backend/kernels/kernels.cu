// phased-array-pro CUDA Kernels — Optimized for Blackwell (sm_120)
//
// Optimizations:
//   1. FP32 (float) — 64× throughput vs FP64 on Blackwell
//   2. 2D grid/block — no integer div/mod for index calculation
//   3. __constant__ memory for sin/cos lookup tables
//   4. Warp shuffle reduction in find_max (skip __syncthreads below warp)
//
// Compile: nvcc -ptx -arch=compute_120 -o kernels.ptx kernels.cu

#define _USE_MATH_DEFINES
#include <math.h>

#ifndef M_PI
#define M_PI 3.14159265358979323846f
#endif
#define M_PI_F 3.14159265358979323846f

// ─── Constant Memory: Angular lookup tables ──────────────
// Populated by host before kernel launch.
// Max constant memory: 64KB. sin_theta + cos_phi + sin_phi = 3 × N × 4B.

#define MAX_ANGLES 256

__constant__ float c_sin_theta[MAX_ANGLES];
__constant__ float c_cos_phi[MAX_ANGLES];
__constant__ float c_sin_phi[MAX_ANGLES];

// ═══════════════════════════════════════════════════════════
// Kernel 1: Array Factor (2D grid, FP32, __sinf/__cosf)
// ═══════════════════════════════════════════════════════════
//
// Grid:  dim3(ceil(n_phi/32), ceil(n_theta/32), 1)
// Block: dim3(32, 32, 1)
// Each thread handles exactly one (theta, phi) pair.
//
// Total warps per block: (32×32)/32 = 32 warps
// Occupancy: 32 warps × 4 schedulers = 8 waves → good

extern "C" __global__ void array_factor_kernel(
    const float* __restrict__ x,
    const float* __restrict__ y,
    const float* __restrict__ w_real,
    const float* __restrict__ w_imag,
    float* __restrict__ output_db,
    int n_theta,
    int n_phi,
    int n_elements
) {
    // 2D index — no div/mod!
    int it = blockIdx.y * blockDim.y + threadIdx.y;
    int ip = blockIdx.x * blockDim.x + threadIdx.x;
    if (it >= n_theta || ip >= n_phi) return;

    // Load from constant memory (broadcast via Constant Cache)
    float st = c_sin_theta[it];
    float cp = c_cos_phi[ip];
    float sp = c_sin_phi[ip];

    float u = st * cp;
    float v = st * sp;

    float sum_real = 0.0f;
    float sum_imag = 0.0f;

    // Element accumulation — use fast math intrinsics
    for (int ie = 0; ie < n_elements; ie++) {
        float phase = 2.0f * M_PI_F * (x[ie] * u + y[ie] * v);
        float c, s;
        __sincosf(phase, &s, &c);  // single intrinsic for sin+cos
        sum_real += w_real[ie] * c - w_imag[ie] * s;
        sum_imag += w_real[ie] * s + w_imag[ie] * c;
    }

    float mag = __fsqrt_rn(sum_real * sum_real + sum_imag * sum_imag);
    int idx = it * n_phi + ip;
    output_db[idx] = (mag > 1e-15f) ? 20.0f * __log10f(mag) : -150.0f;
}

// ═══════════════════════════════════════════════════════════
// Kernel 2: Beam Cut (1D, FP32)
// ═══════════════════════════════════════════════════════════

extern "C" __global__ void beam_cut_kernel(
    const float* __restrict__ x,
    const float* __restrict__ y,
    const float* __restrict__ w_real,
    const float* __restrict__ w_imag,
    const float* __restrict__ theta_deg,
    float cos_phi,
    float sin_phi,
    float* __restrict__ output,
    int n_angles,
    int n_elements
) {
    int idx = blockIdx.x * blockDim.x + threadIdx.x;
    if (idx >= n_angles) return;

    float th = theta_deg[idx] * M_PI_F / 180.0f;
    float s, c;
    __sincosf(th, &s, &c);
    float u = s * cos_phi;
    float v = s * sin_phi;

    float sum_real = 0.0f;
    float sum_imag = 0.0f;

    for (int ie = 0; ie < n_elements; ie++) {
        float phase = 2.0f * M_PI_F * (x[ie] * u + y[ie] * v);
        float pc, ps;
        __sincosf(phase, &ps, &pc);
        sum_real += w_real[ie] * pc - w_imag[ie] * ps;
        sum_imag += w_real[ie] * ps + w_imag[ie] * pc;
    }

    float mag = __fsqrt_rn(sum_real * sum_real + sum_imag * sum_imag);
    output[idx] = (mag > 1e-15f) ? 20.0f * __log10f(mag) : -150.0f;
}

// ═══════════════════════════════════════════════════════════
// Kernel 3: Block-Warp Hybrid Reduction (extern shared mem)
// ═══════════════════════════════════════════════════════════
//
// Uses dynamic shared memory (extern __shared__).
// Stride > 32: shared memory + __syncthreads
// Stride ≤ 32: warp shuffle (no __syncthreads needed)

extern "C" __global__ void find_max_kernel(
    const float* __restrict__ data,
    float* __restrict__ result,
    int n
) {
    // Dynamic shared memory: float array, size passed at launch
    extern __shared__ float smem[];

    int tid = threadIdx.x;
    int idx = blockIdx.x * blockDim.x + tid;

    // Grid-stride loop: each thread accumulates its own max
    float local_max = -1e30f;
    for (int i = idx; i < n; i += blockDim.x * gridDim.x) {
        local_max = fmaxf(local_max, data[i]);
    }
    smem[tid] = local_max;
    __syncthreads();

    // Block-level reduction
    #pragma unroll
    for (int s = blockDim.x / 2; s > 32; s >>= 1) {
        if (tid < s) {
            smem[tid] = fmaxf(smem[tid], smem[tid + s]);
        }
        __syncthreads();
    }

    // Warp-level reduction via shuffle (no __syncthreads)
    if (tid < 32) {
        float val = smem[tid];
        #pragma unroll
        for (int s = 16; s > 0; s >>= 1) {
            val = fmaxf(val, __shfl_down_sync(0xffffffff, val, s));
        }
        if (tid == 0) {
            result[blockIdx.x] = val;
        }
    }
}

// ═══════════════════════════════════════════════════════════
// Host-side helper: copy angular tables to constant memory
// ═══════════════════════════════════════════════════════════
// Call from host via cudaMemcpyToSymbol before kernel launch.
// Symbol names for reference (used in Rust FFI):
//   c_sin_theta, c_cos_phi, c_sin_phi
//
// Usage (pseudocode):
//   cudaMemcpyToSymbol(c_sin_theta, h_sin_theta, n_theta * sizeof(float));
//   cudaMemcpyToSymbol(c_cos_phi,   h_cos_phi,   n_phi   * sizeof(float));
//   cudaMemcpyToSymbol(c_sin_phi,   h_sin_phi,   n_phi   * sizeof(float));
