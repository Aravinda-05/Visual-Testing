/**
 * Zero-dependency Procedural Web Audio API Synthesizer for NASA MSL Curiosity.
 * Synthesizes servo actuator whines, metallic rock crunches, ChemCam LIBS laser plasma snaps,
 * elemental spectrometer chimes, and deep-space X-band telemetry carrier waves.
 */

class SoundEngine {
  private ctx: AudioContext | null = null;
  private driveOsc: OscillatorNode | null = null;
  private driveGain: GainNode | null = null;
  private noiseNode: AudioBufferSourceNode | null = null;
  private noiseGain: GainNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  private isDriving: boolean = false;

  private initCtx() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioCtx();
      this.createNoiseBuffer();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  private createNoiseBuffer() {
    if (!this.ctx) return;
    const bufferSize = this.ctx.sampleRate * 2;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    this.noiseBuffer = buffer;
  }

  /**
   * 6-wheel Rocker-Bogie drive motor whine + metallic wheel grouser crunch
   */
  public updateDriveSound(speed: number, wheelDamagePct: number) {
    this.initCtx();
    if (!this.ctx) return;

    const absSpeed = Math.abs(speed);

    if (absSpeed < 0.1) {
      if (this.isDriving) {
        this.stopDriveLoop();
      }
      return;
    }

    if (!this.isDriving) {
      this.startDriveLoop();
    }

    if (this.driveOsc && this.driveGain && this.noiseGain) {
      const now = this.ctx.currentTime;
      // Pitch increases with velocity (100Hz to 320Hz)
      const targetFreq = 110 + absSpeed * 28;
      this.driveOsc.frequency.setTargetAtTime(targetFreq, now, 0.08);

      // Volume scaling
      const targetGain = Math.min(0.18, absSpeed * 0.025);
      this.driveGain.gain.setTargetAtTime(targetGain, now, 0.08);

      // Wheel rock crunch noise increases if wheels are punctured/damaged
      const damageFactor = 1.0 + (100 - wheelDamagePct) / 50.0;
      const noiseVol = Math.min(0.12, absSpeed * 0.015 * damageFactor);
      this.noiseGain.gain.setTargetAtTime(noiseVol, now, 0.08);
    }
  }

  private startDriveLoop() {
    if (!this.ctx || this.isDriving) return;
    this.isDriving = true;
    const now = this.ctx.currentTime;

    // Dual-tone motor whine
    this.driveOsc = this.ctx.createOscillator();
    this.driveOsc.type = 'sawtooth';
    this.driveOsc.frequency.setValueAtTime(110, now);

    // Lowpass filter to muffle harsh harmonics
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(450, now);

    this.driveGain = this.ctx.createGain();
    this.driveGain.gain.setValueAtTime(0.01, now);

    this.driveOsc.connect(filter);
    filter.connect(this.driveGain);
    this.driveGain.connect(this.ctx.destination);
    this.driveOsc.start();

    // Metallic crunch noise
    if (this.noiseBuffer) {
      this.noiseNode = this.ctx.createBufferSource();
      this.noiseNode.buffer = this.noiseBuffer;
      this.noiseNode.loop = true;

      const bandpass = this.ctx.createBiquadFilter();
      bandpass.type = 'bandpass';
      bandpass.frequency.setValueAtTime(800, now);
      bandpass.Q.setValueAtTime(2.0, now);

      this.noiseGain = this.ctx.createGain();
      this.noiseGain.gain.setValueAtTime(0.01, now);

      this.noiseNode.connect(bandpass);
      bandpass.connect(this.noiseGain);
      this.noiseGain.connect(this.ctx.destination);
      this.noiseNode.start();
    }
  }

  public stopDriveLoop() {
    if (!this.isDriving) return;
    this.isDriving = false;
    const now = this.ctx ? this.ctx.currentTime : 0;

    if (this.driveGain && this.ctx) {
      this.driveGain.gain.setTargetAtTime(0, now, 0.05);
    }
    if (this.noiseGain && this.ctx) {
      this.noiseGain.gain.setTargetAtTime(0, now, 0.05);
    }

    setTimeout(() => {
      try {
        this.driveOsc?.stop();
        this.driveOsc?.disconnect();
        this.noiseNode?.stop();
        this.noiseNode?.disconnect();
      } catch {
        // Safe cleanup
      }
      this.driveOsc = null;
      this.driveGain = null;
      this.noiseNode = null;
      this.noiseGain = null;
    }, 80);
  }

  /**
   * ChemCam 1064nm Pulsed Laser LIBS Plasma Acoustic "ZAP / SNAP" Shockwave
   */
  public playChemCamSnap() {
    this.initCtx();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;

    // 1. Fast pitch-drop sine transient (laser electrical ionization shockwave)
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(2600, now);
    osc.frequency.exponentialRampToValueAtTime(75, now + 0.045);

    gain.gain.setValueAtTime(0.4, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.055);

    // 2. High-passed plasma crackle noise burst
    if (this.noiseBuffer) {
      const noise = this.ctx.createBufferSource();
      noise.buffer = this.noiseBuffer;

      const hpFilter = this.ctx.createBiquadFilter();
      hpFilter.type = 'highpass';
      hpFilter.frequency.setValueAtTime(2200, now);

      const noiseGain = this.ctx.createGain();
      noiseGain.gain.setValueAtTime(0.35, now);
      noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);

      noise.connect(hpFilter);
      hpFilter.connect(noiseGain);
      noiseGain.connect(this.ctx.destination);
      noise.start(now);
      noise.stop(now + 0.065);
    }
  }

  /**
   * Spectrometer Harmonic Lock Chime when element peaks are resolved
   */
  public playElementChime(index: number) {
    this.initCtx();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;

    // Harmonic frequencies for H (656nm), Si (288nm), Fe (404nm), Mg (518nm)
    const freqs = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6
    const freq = freqs[index % freqs.length];

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, now);

    gain.gain.setValueAtTime(0.22, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.7);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.75);
  }

  /**
   * Ascending X-Band carrier wave for MRO Relay Soul-Transfer
   */
  public playSoulTransferBeam() {
    this.initCtx();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;

    // Rising FM telemetry carrier
    const osc1 = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc1.type = 'sine';
    osc2.type = 'triangle';

    osc1.frequency.setValueAtTime(320, now);
    osc1.frequency.exponentialRampToValueAtTime(1760, now + 3.0);

    osc2.frequency.setValueAtTime(324, now);
    osc2.frequency.exponentialRampToValueAtTime(1772, now + 3.0);

    gain.gain.setValueAtTime(0.01, now);
    gain.gain.linearRampToValueAtTime(0.3, now + 0.5);
    gain.gain.linearRampToValueAtTime(0.35, now + 2.5);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 4.0);

    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(this.ctx.destination);

    osc1.start(now);
    osc2.start(now);
    osc1.stop(now + 4.0);
    osc2.stop(now + 4.0);
  }

  /**
   * Stepper motor click for High-Gain Antenna gimbal adjustment
   */
  public playAntennaClick() {
    this.initCtx();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(1200, now);
    osc.frequency.exponentialRampToValueAtTime(200, now + 0.02);

    gain.gain.setValueAtTime(0.15, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.02);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.025);
  }

  /**
   * Thermal overload / countdown warning beep
   */
  public playWarningBeep() {
    this.initCtx();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'square';
    osc.frequency.setValueAtTime(880, now);

    gain.gain.setValueAtTime(0.12, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.13);
  }

  /**
   * Subtle high-tech UI blip for hovering over 3D hotspots
   */
  public playUiBlip() {
    this.initCtx();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(1480, now);
    osc.frequency.exponentialRampToValueAtTime(1920, now + 0.035);

    gain.gain.setValueAtTime(0.08, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.035);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.04);
  }

  /**
   * Confirmatory electronic chime when selecting a 3D hardware hotspot
   */
  public playHotspotSelect() {
    this.initCtx();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(880, now);
    osc.frequency.setValueAtTime(1320, now + 0.05);

    gain.gain.setValueAtTime(0.14, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.25);
  }

  /**
   * Mechanical adjustment or dust clearing pulse
   */
  public playDrillFeedback() {
    this.initCtx();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(240, now);
    osc.frequency.exponentialRampToValueAtTime(80, now + 0.15);
    gain.gain.setValueAtTime(0.12, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.16);
  }

  /**
   * Scientific discovery or triangulated site fanfare
   */
  public playDiscoveryFanfare() {
    this.initCtx();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const freqs = [587.33, 739.99, 880.0, 1174.66]; // D5, F#5, A5, D6
    freqs.forEach((freq, idx) => {
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + idx * 0.08);
      gain.gain.setValueAtTime(0.15, now + idx * 0.08);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.08 + 0.4);
      osc.connect(gain);
      gain.connect(this.ctx!.destination);
      osc.start(now + idx * 0.08);
      osc.stop(now + idx * 0.08 + 0.45);
    });
  }

  /**
   * Target or instrument telemetry lock sound
   */
  public playTargetAcquired() {
    this.initCtx();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(1046.5, now);
    osc.frequency.setValueAtTime(1318.5, now + 0.08);
    gain.gain.setValueAtTime(0.16, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.32);
  }

  /**
   * Deploy beep for Soul-Transfer descent beam
   */
  public playDeployBeep() {
    this.initCtx();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1760, now);
    osc.frequency.exponentialRampToValueAtTime(440, now + 0.25);
    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.26);
  }

  /**
   * Ascent chime for mission transition
   */
  public playAscendChime() {
    this.playSoulTransferBeam();
  }
}

export const soundEngine = new SoundEngine();

