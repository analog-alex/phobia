export class AudioSystem {
  private context?: AudioContext;
  private master?: GainNode;
  private shotNoise?: AudioBuffer;
  private ambientStarted = false;

  async resume(): Promise<void> {
    if (!this.context) {
      this.context = new AudioContext();
      this.master = this.context.createGain();
      this.master.gain.value = 0.24;
      this.master.connect(this.context.destination);
      this.shotNoise = this.createNoiseBuffer(0.07);
    }
    await this.context.resume();
    this.startAmbient();
  }

  shoot(): void {
    this.noise(0.07, 0.4);
    this.tone(105, 0.08, "square", 0.28, 42);
  }

  empty(): void {
    this.tone(880, 0.025, "square", 0.08, 620);
  }

  reload(): void {
    this.tone(270, 0.04, "square", 0.08, 190);
    window.setTimeout(() => this.tone(410, 0.055, "square", 0.09, 260), 520);
  }

  hit(): void {
    this.tone(115, 0.055, "sawtooth", 0.06, 72);
  }

  enemyAttack(): void {
    this.tone(72, 0.22, "sawtooth", 0.12, 48);
  }

  acidThrow(): void {
    this.tone(190, 0.18, "sawtooth", 0.08, 72);
  }

  pickup(): void {
    this.tone(460, 0.06, "sine", 0.09, 680);
    window.setTimeout(() => this.tone(680, 0.08, "sine", 0.07, 900), 65);
  }

  success(): void {
    [260, 390, 520].forEach((frequency, index) => {
      window.setTimeout(() => this.tone(frequency, 0.35, "sine", 0.07, frequency * 1.1), index * 160);
    });
  }

  private startAmbient(): void {
    if (!this.context || !this.master || this.ambientStarted) return;
    this.ambientStarted = true;

    const hum = this.context.createOscillator();
    const humGain = this.context.createGain();
    hum.type = "sine";
    hum.frequency.value = 48;
    humGain.gain.value = 0.055;
    hum.connect(humGain).connect(this.master);
    hum.start();

    const overtone = this.context.createOscillator();
    const overtoneGain = this.context.createGain();
    overtone.type = "triangle";
    overtone.frequency.value = 96;
    overtoneGain.gain.value = 0.018;
    overtone.connect(overtoneGain).connect(this.master);
    overtone.start();
  }

  private tone(
    frequency: number,
    duration: number,
    type: OscillatorType,
    volume: number,
    endFrequency = frequency,
  ): void {
    if (!this.context || !this.master) return;
    const now = this.context.currentTime;
    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, now);
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(1, endFrequency), now + duration);
    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
    oscillator.connect(gain).connect(this.master);
    oscillator.start(now);
    oscillator.stop(now + duration);
  }

  private noise(duration: number, volume: number): void {
    if (!this.context || !this.master) return;
    const source = this.context.createBufferSource();
    const gain = this.context.createGain();
    gain.gain.setValueAtTime(volume, this.context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.context.currentTime + duration);
    source.buffer = this.shotNoise ?? this.createNoiseBuffer(duration);
    source.connect(gain).connect(this.master);
    source.start();
  }

  private createNoiseBuffer(duration: number): AudioBuffer {
    if (!this.context) throw new Error("Audio context is not initialized");
    const sampleCount = Math.floor(this.context.sampleRate * duration);
    const buffer = this.context.createBuffer(1, sampleCount, this.context.sampleRate);
    const channel = buffer.getChannelData(0);
    for (let index = 0; index < sampleCount; index += 1) channel[index] = Math.random() * 2 - 1;
    return buffer;
  }
}
