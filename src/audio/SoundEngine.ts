/**
 * Âm thanh lai: ưu tiên FILE ÂM THANH GỐC của Mobi Army 3 (public/assets/audio,
 * trích từ bản Unity) cho nhạc nền + tiếng bắn/vật phẩm/nước; các tiếng còn lại
 * dùng bộ tổng hợp WebAudio làm dự phòng khi file chưa nạp kịp hoặc không có file.
 */
export class SoundEngine {
  private ctx: AudioContext | null = null;
  public muted = false;
  private chargeOsc: OscillatorNode | null = null;
  private chargeGain: GainNode | null = null;
  private buffers = new Map<string, AudioBuffer>();
  private loadingBuffers = new Set<string>();
  private bgm: HTMLAudioElement | null = null;
  private bgmTrack: string | null = null;

  private ensureContext(): AudioContext | null {
    if (this.muted) return null;
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  public toggleMute(): boolean {
    this.muted = !this.muted;
    if (this.muted) {
      this.stopCharge();
    }
    if (this.bgm) {
      this.bgm.muted = this.muted;
    }
    return this.muted;
  }

  /** Nạp lười một file âm thanh gốc (.ogg) vào bộ đệm WebAudio. */
  private loadBuffer(name: string): void {
    if (this.buffers.has(name) || this.loadingBuffers.has(name)) return;
    const ctx = this.ensureContext();
    if (!ctx) return;
    this.loadingBuffers.add(name);
    fetch(`./assets/audio/${name}.ogg`)
      .then((res) => (res.ok ? res.arrayBuffer() : Promise.reject(new Error(String(res.status)))))
      .then((data) => ctx.decodeAudioData(data))
      .then((buffer) => {
        this.buffers.set(name, buffer);
        this.loadingBuffers.delete(name);
      })
      .catch(() => {
        this.loadingBuffers.delete(name);
      });
  }

  /**
   * Phát file âm thanh gốc nếu đã nạp xong; trả về false (và kích hoạt nạp nền)
   * để nơi gọi dùng tiếng tổng hợp dự phòng cho lần phát này.
   */
  private playFile(name: string, volume = 1, rate = 1): boolean {
    const ctx = this.ensureContext();
    if (!ctx) return false;
    const buffer = this.buffers.get(name);
    if (!buffer) {
      this.loadBuffer(name);
      return false;
    }
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.playbackRate.setValueAtTime(rate, ctx.currentTime);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(volume, ctx.currentTime);
    src.connect(gain).connect(ctx.destination);
    src.start();
    return true;
  }

  /** Mở khóa âm thanh sau thao tác đầu tiên (chính sách autoplay của trình duyệt). */
  public unlockAudio(): void {
    this.ensureContext();
    if (this.bgm && this.bgm.paused && this.bgmTrack) {
      this.bgm.play().catch(() => {});
    }
  }

  /**
   * Nhạc nền lặp vô hạn.
   * GD4 (rebuild Army 2): 'music_army2' = nhạc nền gốc Mobi Army 2 (vòng 24s,
   * chỉ có bản .mp3) dùng cho cả sảnh + trận; music_0/music_1 của Army 3 giữ
   * lại trong thư mục audio làm phương án dự phòng khi cần.
   */
  public startMusic(track: 'music_0' | 'music_1' | 'music_army2'): void {
    if (this.bgmTrack === track && this.bgm && !this.bgm.paused) return;
    if (!this.bgm) {
      this.bgm = new Audio();
      this.bgm.loop = true;
      this.bgm.volume = 0.42;
      this.bgm.preload = 'auto';
    }
    const canOgg = this.bgm.canPlayType('audio/ogg; codecs="vorbis"') !== '';
    const file =
      track === 'music_army2'
        ? './assets/audio/music_army2.mp3'
        : `./assets/audio/${track}.${canOgg ? 'ogg' : 'mp3'}`;
    if (this.bgmTrack !== track || !this.bgm.src.endsWith(file)) {
      this.bgm.src = file;
    }
    this.bgmTrack = track;
    this.bgm.muted = this.muted;
    this.bgm.play().catch(() => {
      // Bị chặn autoplay: unlockAudio() sẽ phát lại sau thao tác đầu tiên.
    });
  }

  public stopMusic(): void {
    if (this.bgm) {
      this.bgm.pause();
      this.bgmTrack = null;
    }
  }

  public playClick(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(660, now);
    osc.frequency.exponentialRampToValueAtTime(980, now + 0.06);
    gain.gain.setValueAtTime(0.12, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.07);
    osc.connect(gain).connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.07);
  }

  public playTurnStart(isPlayer: boolean): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const notes = isPlayer ? [523.25, 659.25, 783.99] : [392.0, 329.63];
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      const t = now + idx * 0.075;
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(0.11, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.14);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.15);
    });
  }

  public updateCharge(powerRatio: number): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    if (!this.chargeOsc || !this.chargeGain) {
      this.chargeOsc = ctx.createOscillator();
      this.chargeGain = ctx.createGain();
      this.chargeOsc.type = 'sawtooth';
      this.chargeGain.gain.setValueAtTime(0.05, ctx.currentTime);
      this.chargeOsc.connect(this.chargeGain).connect(ctx.destination);
      this.chargeOsc.start();
    }
    const freq = 180 + Math.min(1, Math.max(0, powerRatio)) * 540;
    this.chargeOsc.frequency.setTargetAtTime(freq, ctx.currentTime, 0.02);
  }

  public stopCharge(): void {
    if (this.chargeOsc) {
      try {
        this.chargeOsc.stop();
        this.chargeOsc.disconnect();
      } catch {
        // ignore
      }
      this.chargeOsc = null;
    }
    if (this.chargeGain) {
      try {
        this.chargeGain.disconnect();
      } catch {
        // ignore
      }
      this.chargeGain = null;
    }
  }

  public playShoot(heavy = false): void {
    this.stopCharge();
    // Tiếng gốc: đạn thường = shoot, đạn nặng = fire.
    if (heavy ? this.playFile('fire', 0.9) : this.playFile('shoot', 0.85)) return;
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = heavy ? 'sawtooth' : 'square';
    osc.frequency.setValueAtTime(heavy ? 240 : 380, now);
    osc.frequency.exponentialRampToValueAtTime(55, now + (heavy ? 0.26 : 0.16));
    gain.gain.setValueAtTime(heavy ? 0.22 : 0.15, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + (heavy ? 0.27 : 0.17));
    osc.connect(gain).connect(ctx.destination);
    osc.start(now);
    osc.stop(now + (heavy ? 0.28 : 0.18));
  }

  public playExplosion(radiusScale = 1): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const duration = Math.min(0.85, 0.28 + radiusScale * 0.18);

    // White noise burst through low-pass filter
    const sampleCount = Math.floor(ctx.sampleRate * duration);
    const buffer = ctx.createBuffer(1, sampleCount, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < sampleCount; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / sampleCount, 1.4);
    }

    const noise = ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(750, now);
    filter.frequency.exponentialRampToValueAtTime(90, now + duration);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(Math.min(0.38, 0.22 * radiusScale), now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    noise.connect(filter).connect(gain).connect(ctx.destination);
    noise.start(now);
    noise.stop(now + duration);
  }

  public playSplash(): void {
    if (this.playFile('water', 0.8)) return;
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const duration = 0.35;
    const count = Math.floor(ctx.sampleRate * duration);
    const buffer = ctx.createBuffer(1, count, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < count; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.sin((i / count) * Math.PI);
    }
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(900, now);
    filter.frequency.exponentialRampToValueAtTime(320, now + duration);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
    src.connect(filter).connect(gain).connect(ctx.destination);
    src.start(now);
    src.stop(now + duration);
  }

  public playItemUse(): void {
    if (this.playFile('item', 0.8)) return;
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    [440, 587.33, 880].forEach((f, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      const t = now + idx * 0.055;
      osc.frequency.setValueAtTime(f, t);
      gain.gain.setValueAtTime(0.12, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.13);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.14);
    });
  }

  public playPow(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    [330, 440, 554.37, 659.25, 880].forEach((f, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      const t = now + idx * 0.05;
      osc.frequency.setValueAtTime(f, t);
      gain.gain.setValueAtTime(0.14, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.23);
    });
  }

  public playEndBanner(won: boolean): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const melody = won
      ? [523.25, 659.25, 783.99, 1046.5]
      : [392.0, 369.99, 349.23, 293.66];
    melody.forEach((f, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = won ? 'triangle' : 'sawtooth';
      const t = now + idx * 0.13;
      osc.frequency.setValueAtTime(f, t);
      gain.gain.setValueAtTime(0.15, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.32);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.34);
    });
  }
}

export const sound = new SoundEngine();

