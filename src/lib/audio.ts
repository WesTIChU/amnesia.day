// Ambient Sound Engine using Web Audio API
// Generates an extremely subtle, warm background library/room ambience
// and rare quiet sounds (distant room hum, soft paper rustle, wooden floor creak).

class AmbientSoundEngine {
  private ctx: AudioContext | null = null;
  private isPlaying = false;
  private noiseNode: AudioNode | null = null;
  private gainNode: GainNode | null = null;
  private humOsc: OscillatorNode | null = null;
  private timerId: number | null = null;

  public toggle(): boolean {
    if (this.isPlaying) {
      this.stop();
      return false;
    } else {
      return this.start();
    }
  }

  public getIsPlaying(): boolean {
    return this.isPlaying;
  }

  public start(): boolean {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
       if (!AudioCtx) return false;

      this.ctx = new AudioCtx();
      if (this.ctx.state === 'suspended') {
        this.ctx.resume().catch(() => this.stop());
      }

      // Keep the archive ambience soft, but audible on normal speakers.
      this.gainNode = this.ctx.createGain();
       this.gainNode.gain.value = 0.25;
      this.gainNode.connect(this.ctx.destination);

      // Deep room tone / building hum
      this.humOsc = this.ctx.createOscillator();
      const humGain = this.ctx.createGain();
      this.humOsc.type = 'sine';
      this.humOsc.frequency.value = 55; // Low 55Hz room hum
       humGain.gain.value = 0.015;
      this.humOsc.connect(humGain);
      humGain.connect(this.gainNode);
      this.humOsc.start();

      // Pink Noise Generator for distant room atmosphere
      const bufferSize = this.ctx.sampleRate * 2;
      const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const output = noiseBuffer.getChannelData(0);
      let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;

      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        b0 = 0.99886 * b0 + white * 0.0555179;
        b1 = 0.99332 * b1 + white * 0.0750759;
        b2 = 0.96900 * b2 + white * 0.1538520;
        b3 = 0.86650 * b3 + white * 0.3104856;
        b4 = 0.55000 * b4 + white * 0.5329522;
        b5 = -0.7616 * b5 - white * 0.0168980;
        output[i] = b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362;
         output[i] *= 0.03; // quiet room tone
        b6 = white * 0.115926;
      }

      const whiteNoise = this.ctx.createBufferSource();
      whiteNoise.buffer = noiseBuffer;
      whiteNoise.loop = true;

      // Filter noise to low frequencies (soft warm room rumble)
      const lowpass = this.ctx.createBiquadFilter();
      lowpass.type = 'lowpass';
      lowpass.frequency.value = 220;

      whiteNoise.connect(lowpass);
      lowpass.connect(this.gainNode);
      whiteNoise.start();

      this.noiseNode = whiteNoise;

      // Rare, natural reading room sounds every 45 to 100 seconds
       this.scheduleRareRoomSound();

       this.isPlaying = true;
       this.playSoftClockTick();
       return true;
    } catch (e) {
      console.warn('AudioContext not supported or blocked');
      this.stop();
      return false;
    }
  }

  private scheduleRareRoomSound() {
    // Schedule next sound in 45-100 seconds
    const nextInterval = Math.floor(Math.random() * (100000 - 45000) + 45000);

    this.timerId = window.setTimeout(() => {
      if (this.isPlaying && this.ctx && this.ctx.state === 'running') {
        const roll = Math.random();
        if (roll < 0.4) {
          this.playSoftPaperTurn();
        } else if (roll < 0.7) {
          this.playSoftClockTick();
        } else {
          this.playSoftFloorCreak();
        }
        this.scheduleRareRoomSound();
      }
    }, nextInterval);
  }

  // Soft clock tick sound
  private playSoftClockTick() {
    if (!this.ctx || !this.gainNode) return;
    try {
      const osc = this.ctx.createOscillator();
      const tickGain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(650, this.ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(80, this.ctx.currentTime + 0.012);

      tickGain.gain.setValueAtTime(0.008, this.ctx.currentTime);
      tickGain.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + 0.012);

      osc.connect(tickGain);
      tickGain.connect(this.gainNode);

      osc.start(this.ctx.currentTime);
      osc.stop(this.ctx.currentTime + 0.015);
    } catch {
      // Decorative audio only; a playback failure must never interrupt the page.
    }
  }

  // Soft page turning / paper rustle
  private playSoftPaperTurn() {
    if (!this.ctx || !this.gainNode) return;
    try {
      const duration = 0.35;
      const bufferSize = this.ctx.sampleRate * duration;
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);

      for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufferSize, 2);
      }

      const noise = this.ctx.createBufferSource();
      noise.buffer = buffer;

      const bandpass = this.ctx.createBiquadFilter();
      bandpass.type = 'bandpass';
      bandpass.frequency.setValueAtTime(1200, this.ctx.currentTime);
      bandpass.Q.value = 1.2;

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.006, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + duration);

      noise.connect(bandpass);
      bandpass.connect(gain);
      gain.connect(this.gainNode);

      noise.start();
    } catch {
      // Decorative audio only; a playback failure must never interrupt the page.
    }
  }

  // Soft floor creak
  private playSoftFloorCreak() {
    if (!this.ctx || !this.gainNode) return;
    try {
      const osc = this.ctx.createOscillator();
      const creakGain = this.ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(180, this.ctx.currentTime);
      osc.frequency.linearRampToValueAtTime(140, this.ctx.currentTime + 0.18);

      creakGain.gain.setValueAtTime(0.005, this.ctx.currentTime);
      creakGain.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + 0.18);

      osc.connect(creakGain);
      creakGain.connect(this.gainNode);

      osc.start(this.ctx.currentTime);
      osc.stop(this.ctx.currentTime + 0.2);
    } catch {
      // Decorative audio only; a playback failure must never interrupt the page.
    }
  }

  // Quiet sound of paper envelope opening ("shhh...") for awakened memory opening
  public playPaperEnvelopeOpen() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) this.ctx = new AudioCtx();
    }

    if (!this.ctx) return;
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }

    try {
      const duration = 0.65;
      const bufferSize = this.ctx.sampleRate * duration;
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);

      // Smooth noise envelope for "shhh..." rustle
      for (let i = 0; i < bufferSize; i++) {
        const progress = i / bufferSize;
        // Fade in quickly, hold, then taper off softly
        const envelope = Math.sin(progress * Math.PI);
        data[i] = (Math.random() * 2 - 1) * envelope;
      }

      const noise = this.ctx.createBufferSource();
      noise.buffer = buffer;

      // Soft bandpass filter for paper rustle
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(1400, this.ctx.currentTime);
      filter.frequency.exponentialRampToValueAtTime(900, this.ctx.currentTime + duration);
      filter.Q.value = 1.0;

      const masterGain = this.ctx.createGain();
      masterGain.gain.setValueAtTime(0.035, this.ctx.currentTime);
      masterGain.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + duration);

      noise.connect(filter);
      filter.connect(masterGain);
      masterGain.connect(this.ctx.destination);

      noise.start();
    } catch (e) {
      console.warn('Paper envelope sound playback error:', e);
    }
  }

  public stop() {
    if (this.timerId) {
      clearTimeout(this.timerId);
      this.timerId = null;
    }
    if (this.humOsc) {
      try {
        this.humOsc.stop();
      } catch {
        // The node may already be stopped; halting is best-effort.
      }
      this.humOsc = null;
    }
    if (this.noiseNode) {
      try {
        (this.noiseNode as any).stop();
      } catch {
        // The node may already be stopped; halting is best-effort.
      }
      this.noiseNode = null;
    }
    if (this.ctx) {
      this.ctx.close();
      this.ctx = null;
    }
    this.isPlaying = false;
  }
}

export const ambientSound = new AmbientSoundEngine();
