//! GPU dispatch layer — Optimized CUDA kernels (FP32 + 2D grid + constant memory).
//!
//! Architecture:
//!   Public API accepts f64 → internally converts to f32 → CUDA kernel → convert back
//!   CPU fallback uses Rayon parallel f64.

pub mod cuda_ffi;

pub const PTX_BYTES: &[u8] = include_bytes!("../../kernels/kernels.ptx");
pub const KERNEL_NAMES: &[&str] = &["array_factor_kernel", "beam_cut_kernel", "find_max_kernel"];

pub fn init_cuda() -> bool {
    if cuda_ffi::available() { return true; }
    cuda_ffi::init()
}
pub fn cuda_available() -> bool { cuda_ffi::available() }

// ═══ Public Dispatch API (f64 interface → f32 GPU) ═══════

use std::ffi::c_void;

pub fn compute_array_factor(
    x: &[f64], y: &[f64],
    w_real: &[f64], w_imag: &[f64],
    sin_theta: &[f64], cos_phi: &[f64], sin_phi: &[f64],
) -> Vec<f64> {
    if cuda_ffi::available() {
        // Convert to f32 for GPU
        let x_f: Vec<f32> = x.iter().map(|&v| v as f32).collect();
        let y_f: Vec<f32> = y.iter().map(|&v| v as f32).collect();
        let wr_f: Vec<f32> = w_real.iter().map(|&v| v as f32).collect();
        let wi_f: Vec<f32> = w_imag.iter().map(|&v| v as f32).collect();
        let st_f: Vec<f32> = sin_theta.iter().map(|&v| v as f32).collect();
        let cp_f: Vec<f32> = cos_phi.iter().map(|&v| v as f32).collect();
        let sp_f: Vec<f32> = sin_phi.iter().map(|&v| v as f32).collect();

        match array_factor_cuda(&x_f, &y_f, &wr_f, &wi_f, &st_f, &cp_f, &sp_f) {
            Ok(result) => return result.into_iter().map(|v| v as f64).collect(),
            Err(e) => tracing::warn!("GPU AF failed: {e}, CPU fallback"),
        }
    }
    array_factor_cpu(x, y, w_real, w_imag, sin_theta, cos_phi, sin_phi)
}

pub fn compute_beam_cut(
    x: &[f64], y: &[f64],
    w_real: &[f64], w_imag: &[f64],
    theta_deg: &[f64], phi_deg: f64,
) -> Vec<f64> {
    if cuda_ffi::available() {
        let x_f: Vec<f32> = x.iter().map(|&v| v as f32).collect();
        let y_f: Vec<f32> = y.iter().map(|&v| v as f32).collect();
        let wr_f: Vec<f32> = w_real.iter().map(|&v| v as f32).collect();
        let wi_f: Vec<f32> = w_imag.iter().map(|&v| v as f32).collect();
        let th_f: Vec<f32> = theta_deg.iter().map(|&v| v as f32).collect();

        match beam_cut_cuda(&x_f, &y_f, &wr_f, &wi_f, &th_f, phi_deg as f32) {
            Ok(result) => return result.into_iter().map(|v| v as f64).collect(),
            Err(e) => tracing::warn!("GPU beam_cut failed: {e}, CPU fallback"),
        }
    }
    beam_cut_cpu(x, y, w_real, w_imag, theta_deg, phi_deg)
}

// ═══ CUDA Implementations (FP32) ════════════════════════

fn array_factor_cuda(
    x: &[f32], y: &[f32],
    w_real: &[f32], w_imag: &[f32],
    sin_theta: &[f32], cos_phi: &[f32], sin_phi: &[f32],
) -> Result<Vec<f32>, String> {
    let n_theta = sin_theta.len();
    let n_phi = cos_phi.len();
    let n_elem = x.len();
    let total = n_theta * n_phi;

    // Allocate device buffers
    let d_x = cuda_ffi::GpuBuffer::alloc(x.len(), 4)?;
    let d_y = cuda_ffi::GpuBuffer::alloc(y.len(), 4)?;
    let d_wr = cuda_ffi::GpuBuffer::alloc(w_real.len(), 4)?;
    let d_wi = cuda_ffi::GpuBuffer::alloc(w_imag.len(), 4)?;
    let d_out = cuda_ffi::GpuBuffer::alloc(total, 4)?;

    // Copy element data
    d_x.copy_host_to_device(x)?;
    d_y.copy_host_to_device(y)?;
    d_wr.copy_host_to_device(w_real)?;
    d_wi.copy_host_to_device(w_imag)?;

    // Copy angular tables to constant memory (hardware broadcast cache)
    cuda_ffi::copy_to_symbol("c_sin_theta", sin_theta)?;
    cuda_ffi::copy_to_symbol("c_cos_phi", cos_phi)?;
    cuda_ffi::copy_to_symbol("c_sin_phi", sin_phi)?;

    // 2D grid: each thread handles one (theta, phi) pair
    let grid = (
        ((n_phi as u32 + 31) / 32),
        ((n_theta as u32 + 31) / 32),
        1,
    );
    let block = (32u32, 32u32, 1u32);

    let n_theta_i32 = n_theta as i32;
    let n_phi_i32 = n_phi as i32;
    let n_elem_i32 = n_elem as i32;

    let args: Vec<*mut c_void> = vec![
        &d_x as *const _ as *mut c_void,
        &d_y as *const _ as *mut c_void,
        &d_wr as *const _ as *mut c_void,
        &d_wi as *const _ as *mut c_void,
        &d_out as *const _ as *mut c_void,
        &n_theta_i32 as *const i32 as *mut c_void,
        &n_phi_i32 as *const i32 as *mut c_void,
        &n_elem_i32 as *const i32 as *mut c_void,
    ];

    unsafe { cuda_ffi::launch_kernel("array_factor_kernel", grid, block, &args)?; }
    cuda_ffi::synchronize()?;

    let mut output = vec![0.0f32; total];
    d_out.copy_device_to_host(&mut output)?;

    d_x.free()?;
    d_y.free()?;
    d_wr.free()?;
    d_wi.free()?;
    d_out.free()?;

    Ok(output)
}

fn beam_cut_cuda(
    x: &[f32], y: &[f32],
    w_real: &[f32], w_imag: &[f32],
    theta_deg: &[f32], phi_deg: f32,
) -> Result<Vec<f32>, String> {
    let n_angles = theta_deg.len();
    let n_elem = x.len();
    let (cos_phi, sin_phi) = {
        let r = phi_deg.to_radians();
        (r.cos() as f32, r.sin() as f32)
    };

    let d_x = cuda_ffi::GpuBuffer::alloc(x.len(), 4)?;
    let d_y = cuda_ffi::GpuBuffer::alloc(y.len(), 4)?;
    let d_wr = cuda_ffi::GpuBuffer::alloc(w_real.len(), 4)?;
    let d_wi = cuda_ffi::GpuBuffer::alloc(w_imag.len(), 4)?;
    let d_th = cuda_ffi::GpuBuffer::alloc(theta_deg.len(), 4)?;
    let d_out = cuda_ffi::GpuBuffer::alloc(n_angles, 4)?;

    d_x.copy_host_to_device(x)?;
    d_y.copy_host_to_device(y)?;
    d_wr.copy_host_to_device(w_real)?;
    d_wi.copy_host_to_device(w_imag)?;
    d_th.copy_host_to_device(theta_deg)?;

    let n_angles_i32 = n_angles as i32;
    let n_elem_i32 = n_elem as i32;

    let args: Vec<*mut c_void> = vec![
        &d_x as *const _ as *mut c_void,
        &d_y as *const _ as *mut c_void,
        &d_wr as *const _ as *mut c_void,
        &d_wi as *const _ as *mut c_void,
        &d_th as *const _ as *mut c_void,
        &cos_phi as *const f32 as *mut c_void,
        &sin_phi as *const f32 as *mut c_void,
        &d_out as *const _ as *mut c_void,
        &n_angles_i32 as *const i32 as *mut c_void,
        &n_elem_i32 as *const i32 as *mut c_void,
    ];

    let grid = ((n_angles as u32 + 255) / 256, 1, 1);
    unsafe { cuda_ffi::launch_kernel("beam_cut_kernel", grid, (256, 1, 1), &args)?; }
    cuda_ffi::synchronize()?;

    let mut output = vec![0.0f32; n_angles];
    d_out.copy_device_to_host(&mut output)?;

    d_x.free()?;
    d_y.free()?;
    d_wr.free()?;
    d_wi.free()?;
    d_th.free()?;
    d_out.free()?;

    Ok(output)
}

// ═══ CPU Fallback (Rayon, f64) ══════════════════════════

pub fn array_factor_cpu(
    x: &[f64], y: &[f64],
    wr: &[f64], wi: &[f64],
    sin_theta: &[f64], cos_phi: &[f64], sin_phi: &[f64],
) -> Vec<f64> {
    use rayon::prelude::*;
    let n_theta = sin_theta.len();
    let n_phi = cos_phi.len();
    let n_elem = x.len();
    let mut output = vec![0.0f64; n_theta * n_phi];
    output.par_chunks_mut(n_phi).enumerate().for_each(|(it, row)| {
        for (ip, val) in row.iter_mut().enumerate() {
            let u = sin_theta[it] * cos_phi[ip];
            let v = sin_theta[it] * sin_phi[ip];
            let mut sr = 0.0; let mut si = 0.0;
            for ie in 0..n_elem {
                let ph = 2.0 * std::f64::consts::PI * (x[ie] * u + y[ie] * v);
                sr += wr[ie] * ph.cos() - wi[ie] * ph.sin();
                si += wr[ie] * ph.sin() + wi[ie] * ph.cos();
            }
            let mag = (sr * sr + si * si).sqrt();
            *val = if mag > 1e-15 { 20.0 * mag.log10() } else { -150.0 };
        }
    });
    output
}

pub fn beam_cut_cpu(
    x: &[f64], y: &[f64],
    wr: &[f64], wi: &[f64],
    theta_deg: &[f64], phi_deg: f64,
) -> Vec<f64> {
    use rayon::prelude::*;
    let n_elem = x.len();
    let cp = phi_deg.to_radians().cos();
    let sp = phi_deg.to_radians().sin();
    theta_deg.par_iter().map(|&th| {
        let tr = th.to_radians();
        let u = tr.sin() * cp; let v = tr.sin() * sp;
        let mut sr = 0.0; let mut si = 0.0;
        for ie in 0..n_elem {
            let ph = 2.0 * std::f64::consts::PI * (x[ie] * u + y[ie] * v);
            sr += wr[ie] * ph.cos() - wi[ie] * ph.sin();
            si += wr[ie] * ph.sin() + wi[ie] * ph.cos();
        }
        let mag = (sr * sr + si * si).sqrt();
        if mag > 1e-15 { 20.0 * mag.log10() } else { -150.0 }
    }).collect()
}
