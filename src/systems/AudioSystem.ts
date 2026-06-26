export class AudioSystem {
  private context?: AudioContext;
  private master?: GainNode;
  private shotNoise?: AudioBuffer;
  private ambientStarted = false;
  private readonly delayed = new Set<{
    remaining: number;
    run: () => void;
  }>();

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
    this.filteredNoise(0.028, 0.82, "highpass", 1200, 0.7);
    this.filteredNoise(0.095, 0.48, "lowpass", 620, 0.9);
    this.tone(76, 0.12, "sawtooth", 0.34, 34);
    this.tone(190, 0.035, "square", 0.16, 86);
  }

  empty(): void {
    this.tone(880, 0.025, "square", 0.08, 620);
  }

  reload(): void {
    this.tone(270, 0.04, "square", 0.08, 190);
    this.schedule(0.52, () => this.tone(410, 0.055, "square", 0.09, 260));
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
    this.schedule(0.065, () => this.tone(680, 0.08, "sine", 0.07, 900));
  }

  success(): void {
    [260, 390, 520].forEach((frequency, index) => {
      this.schedule(index * 0.16, () =>
        this.tone(frequency, 0.35, "sine", 0.07, frequency * 1.1)
      );
    });
  }

  update(delta: number): void {
    if (this.delayed.size === 0) return;
    for (const entry of [...this.delayed]) {
      entry.remaining -= delta;
      if (entry.remaining > 0) continue;
      this.delayed.delete(entry);
      entry.run();
    }
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
    endFrequency = frequency
  ): void {
    if (!this.context || !this.master) return;
    const now = this.context.currentTime;
    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, now);
    oscillator.frequency.exponentialRampToValueAtTime(
      Math.max(1, endFrequency),
      now + duration
    );
    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
    oscillator.connect(gain).connect(this.master);
    oscillator.start(now);
    oscillator.stop(now + duration);
  }

  private filteredNoise(
    duration: number,
    volume: number,
    type: BiquadFilterType,
    frequency: number,
    q: number
  ): void {
    if (!this.context || !this.master) return;
    const source = this.context.createBufferSource();
    const filter = this.context.createBiquadFilter();
    const gain = this.context.createGain();
    const now = this.context.currentTime;
    filter.type = type;
    filter.frequency.value = frequency;
    filter.Q.value = q;
    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
    source.buffer = this.shotNoise ?? this.createNoiseBuffer(duration);
    source.connect(filter).connect(gain).connect(this.master);
    source.start(now);
  }

  private createNoiseBuffer(duration: number): AudioBuffer {
    if (!this.context) throw new Error("Audio context is not initialized");
    const sampleCount = Math.floor(this.context.sampleRate * duration);
    const buffer = this.context.createBuffer(
      1,
      sampleCount,
      this.context.sampleRate
    );
    const channel = buffer.getChannelData(0);
    for (let index = 0; index < sampleCount; index += 1)
      channel[index] = Math.random() * 2 - 1;
    return buffer;
  }

  private schedule(delaySeconds: number, run: () => void): void {
    this.delayed.add({ remaining: delaySeconds, run });
  }
}
