# 物理模型

## 1. 阵列因子

相控阵的方向图由阵列因子（Array Factor）和单元方向图（Element Pattern）的乘积决定：

$$F(\theta,\phi) = AF(\theta,\phi) \cdot EP(\theta,\phi)$$

### 阵列因子

$$AF(\theta,\phi) = \sum_{n=1}^{N} w_n \cdot e^{j\frac{2\pi}{\lambda}(x_n u + y_n v)}$$

其中 $u = \sin\theta\cos\phi$，$v = \sin\theta\sin\phi$。

$w_n$ 为第 $n$ 个阵元的复激励（幅度 × 相位）。

### 波束扫描

对于扫描方向 $(\theta_0, \phi_0)$，相位权重为：

$$w_n^{steer} = e^{-j\frac{2\pi}{\lambda}(x_n\sin\theta_0\cos\phi_0 + y_n\sin\theta_0\sin\phi_0)}$$

### 波束宽度

均匀加权矩形阵列的 3 dB 波束宽度（broadside）：

$$\Delta\theta_{3dB} \approx \frac{51\degree}{N_x \cdot d_x/\lambda}$$

扫描角增大时波束展宽：

$$\Delta\theta_{3dB}(\theta_0) \approx \frac{\Delta\theta_{3dB}(0)}{\cos\theta_0}$$

## 2. 幅度锥削

锥削通过降低边缘阵元的幅度来抑制旁瓣，代价是波束展宽。

### Taylor 锥削

Taylor 锥削在指定旁瓣电平下最小化波束展宽：

$$w(x) = 1 + 2\sum_{m=1}^{\bar{n}-1} F_m \cos(m\pi x)$$

其中 $\bar{n}$ 控制等旁瓣区域的数目，$F_m$ 由目标旁瓣电平推导。

### Hamming / Hanning

$$w_{Hamming}(n) = 0.54 - 0.46\cos\left(\frac{2\pi n}{N-1}\right)$$

$$w_{Hanning}(n) = 0.5 - 0.5\cos\left(\frac{2\pi n}{N-1}\right)$$

## 3. 超分辨 DOA

### MUSIC 算法

1. 估计协方差矩阵: $\hat{\mathbf{R}} = \frac{1}{K}\sum_{k=1}^{K} \mathbf{x}_k \mathbf{x}_k^H$
2. 特征分解: $\hat{\mathbf{R}} = \mathbf{E}_s \mathbf{\Lambda}_s \mathbf{E}_s^H + \mathbf{E}_n \mathbf{\Lambda}_n \mathbf{E}_n^H$
3. 伪谱: $P_{MUSIC}(\theta) = \frac{1}{\mathbf{a}^H(\theta) \mathbf{E}_n \mathbf{E}_n^H \mathbf{a}(\theta)}$

### ESPRIT 算法

利用子阵列的旋转不变性：
- 子阵列 1: 阵元 0..M-2
- 子阵列 2: 阵元 1..M-1

$\mathbf{E}_2 = \mathbf{E}_1 \mathbf{\Psi}$，其中 $\mathbf{\Psi}$ 的特征值给出 DOA 估计。

## 4. 真实物理效应

### 单元方向图 (cos^q)

$$EP(\theta) = \cos^q(\theta), \quad \cos\theta \geq 0$$

- $q = 0$: 各向同性
- $q = 0.5$: 理想偶极子近似
- $q = 1.0$: 典型贴片天线
- $q = 1.5$: 窄波束贴片

### 互耦合

Toeplitz 耦合矩阵模型：

$$C_{ij} = \alpha \cdot e^{-|i-j|/d} \cdot e^{j\phi_{ij}}$$

其中 $\alpha$ 为耦合强度，$d$ 为衰减距离。

实际激励: $\mathbf{w}_{actual} = \mathbf{C} \cdot \mathbf{w}_{ideal}$

### 相位量化

模拟数字移相器的有限分辨率：

$$w_n^{quantized} = |w_n| \cdot e^{j \cdot \text{round}(\arg(w_n) / \Delta\phi) \cdot \Delta\phi}$$

其中 $\Delta\phi = 2\pi / 2^N$（N-bit 移相器）。

RMS 相位误差: $\phi_{rms} = \sqrt{\frac{1}{N}\sum (\phi_n - \hat{\phi}_n)^2}$

### 宽带 Squint

传统相控阵用移相器实现波束扫描，移相量在偏离设计频率时产生指向误差：

$$\sin\theta_{actual} = \frac{f_0}{f} \cdot \sin\theta_{design}$$

## 参考文献

- Van Trees, H. L. "Optimum Array Processing" (2002)
- Schmidt, R. O. "Multiple Emitter Location and Signal Parameter Estimation" (1986)
- Roy, R. & Kailath, T. "ESPRIT — Estimation of Signal Parameters via Rotational Invariance Techniques" (1989)
- Capon, J. "High-Resolution Frequency-Wavenumber Spectrum Analysis" (1969)
