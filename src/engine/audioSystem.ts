import { GroundSurface, getFootstepAudioProfile } from '../sim/groundSurface';
import { VendorVoiceLine, computeSpatialVoiceGain } from '../sim/newMarketAndShops';

export class WorldAudioEngine {
  private ctx: AudioContext | null = null;
  private muted = false;
  private ambientGain: GainNode | null = null;
  private marketMurmurGain: GainNode | null = null;
  private stepNoiseBuf: AudioBuffer | null = null;
  private initialized = false;
  private nextHornTime = 0;

  public isMuted(): boolean {
    return this.muted;
  }

  public setMuted(m: boolean) {
    this.muted = m;
    if (this.ambientGain && this.ctx) {
      this.ambientGain.gain.setTargetAtTime(m ? 0 : 0.04, this.ctx.currentTime, 0.08);
    }
    if (this.marketMurmurGain && this.ctx && m) {
      this.marketMurmurGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.08);
    }
  }

  public toggleMute(): boolean {
    this.setMuted(!this.muted);
    return this.muted;
  }

  public unlock() {
    if (this.initialized) {
      if (this.ctx && this.ctx.state === 'suspended') {
        void this.ctx.resume();
      }
      return;
    }
    this.initialized = true;
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;
      this.ctx = new AudioCtx();

      const stepBufLen = Math.floor(this.ctx.sampleRate * 0.4);
      this.stepNoiseBuf = this.ctx.createBuffer(1, stepBufLen, this.ctx.sampleRate);
      const stepData = this.stepNoiseBuf.getChannelData(0);
      for (let i = 0; i < stepBufLen; i++) {
        stepData[i] = Math.random() * 2 - 1;
      }

      const bufferSize = this.ctx.sampleRate * 2;
      const noiseBuf = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = noiseBuf.getChannelData(0);
      let b0 = 0;
      let b1 = 0;
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        b0 = 0.997 * b0 + white * 0.029;
        b1 = 0.985 * b1 + white * 0.032;
        data[i] = (b0 + b1) * 0.45;
      }

      const src = this.ctx.createBufferSource();
      src.buffer = noiseBuf;
      src.loop = true;

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 340;

      this.ambientGain = this.ctx.createGain();
      this.ambientGain.gain.value = this.muted ? 0 : 0.04;

      src.connect(filter);
      filter.connect(this.ambientGain);
      this.ambientGain.connect(this.ctx.destination);
      src.start();

      // New Market busy bazaar crowd murmur bed (warm vocal band-pass 400-1400 Hz)
      const mSrc = this.ctx.createBufferSource();
      mSrc.buffer = noiseBuf;
      mSrc.loop = true;
      const mFilter = this.ctx.createBiquadFilter();
      mFilter.type = 'bandpass';
      mFilter.frequency.value = 680;
      mFilter.Q.value = 0.7;
      this.marketMurmurGain = this.ctx.createGain();
      this.marketMurmurGain.gain.value = 0;
      mSrc.connect(mFilter);
      mFilter.connect(this.marketMurmurGain);
      this.marketMurmurGain.connect(this.ctx.destination);
      mSrc.start();
    } catch {
      // AudioContext blocked or unavailable
    }
  }

  public setMarketCrowdLevel(level01: number) {
    if (!this.marketMurmurGain || !this.ctx) return;
    const target = this.muted ? 0 : Math.max(0, Math.min(1, level01)) * 0.055;
    this.marketMurmurGain.gain.setTargetAtTime(target, this.ctx.currentTime, 0.25);
  }

  /**
   * Non-robotic human-like multi-formant Bengali vendor vocal cadence synthesis
   * with smooth pitch prosody & spatial distance attenuation.
   */
  public playVendorVoice(line: VendorVoiceLine, distanceM: number, maxRangeM = 24) {
    if (this.muted || !this.ctx) return;
    const spatialGain = computeSpatialVoiceGain(distanceM, maxRangeM);
    if (spatialGain <= 0.02) return;

    try {
      const ctx = this.ctx;
      const t0 = ctx.currentTime;
      const syllables = Math.max(4, Math.min(12, line.syllableCount));
      const sylDur = 0.145;
      const totalDur = syllables * sylDur + 0.08;

      // Glottal-like rich source + subtle vibrato
      const voiceOsc = ctx.createOscillator();
      voiceOsc.type = 'sawtooth';
      const baseF0 = line.basePitchHz * (0.94 + Math.random() * 0.12);

      // Vibrato LFO (natural human vocal tremor ~5.4 Hz)
      const lfo = ctx.createOscillator();
      const lfoGain = ctx.createGain();
      lfo.frequency.setValueAtTime(5.4, t0);
      lfoGain.gain.setValueAtTime(3.2, t0);
      lfo.connect(lfoGain);
      lfoGain.connect(voiceOsc.frequency);

      // Parallel F1 + F2 vowel formant bandpass filters for warm human voice timbre
      const f1 = ctx.createBiquadFilter();
      f1.type = 'bandpass';
      f1.Q.setValueAtTime(4.2, t0);

      const f2 = ctx.createBiquadFilter();
      f2.type = 'bandpass';
      f2.Q.setValueAtTime(5.5, t0);

      const masterGain = ctx.createGain();
      masterGain.gain.setValueAtTime(0.0001, t0);

      // Bengali street-vendor rising-falling calling cadence ("Mama, ashen ashen!")
      const vowelFormants: [number, number][] = [
        [720, 1180], // 'a' (মা / আ)
        [520, 1780], // 'e' (দে / এ)
        [340, 2150], // 'i' (কী / নি)
        [460, 920],  // 'o' (ভালো / বল)
      ];

      for (let s = 0; s < syllables; s++) {
        const st = t0 + s * sylDur;
        const pauseGap = s === Math.floor(syllables * 0.48) ? 0.045 : 0.015;
        const [vf1, vf2] = vowelFormants[(s + line.id.length) % vowelFormants.length];
        const inflect = s === syllables - 1 ? 1.18 : s % 3 === 0 ? 1.1 : 0.96;

        voiceOsc.frequency.setTargetAtTime(baseF0 * inflect, st, 0.025);
        f1.frequency.setTargetAtTime(vf1, st, 0.02);
        f2.frequency.setTargetAtTime(vf2, st, 0.02);

        masterGain.gain.setTargetAtTime(0.048 * spatialGain, st + pauseGap, 0.022);
        masterGain.gain.setTargetAtTime(0.012 * spatialGain, st + sylDur - 0.025, 0.018);
      }

      masterGain.gain.setTargetAtTime(0.0001, t0 + totalDur - 0.04, 0.02);

      const mix = ctx.createGain();
      mix.gain.setValueAtTime(0.75, t0);
      voiceOsc.connect(f1);
      voiceOsc.connect(f2);
      f1.connect(mix);
      f2.connect(mix);
      mix.connect(masterGain);
      masterGain.connect(ctx.destination);

      voiceOsc.start(t0);
      lfo.start(t0);
      voiceOsc.stop(t0 + totalDur + 0.05);
      lfo.stop(t0 + totalDur + 0.05);
    } catch {
      // Ignore
    }
  }

  public playStep(surface: GroundSurface, isRunning = false, rainIntensity = 0) {
    if (this.muted || !this.ctx) return;
    try {
      const ctx = this.ctx;
      const t = ctx.currentTime;
      const profile = getFootstepAudioProfile(surface);
      const paceScale = isRunning ? 1.25 : 1.0;
      const pitchJitter = 0.92 + Math.random() * 0.16;

      const osc = ctx.createOscillator();
      const thudGain = ctx.createGain();
      osc.type = surface === 'concrete' ? 'triangle' : 'sine';
      osc.frequency.setValueAtTime(profile.impactFreqHz * pitchJitter, t);
      osc.frequency.exponentialRampToValueAtTime(38, t + Math.min(0.065, profile.durationSec));
      thudGain.gain.setValueAtTime(profile.thudGain * paceScale, t);
      thudGain.gain.exponentialRampToValueAtTime(0.0008, t + Math.min(0.075, profile.durationSec));
      osc.connect(thudGain);
      thudGain.connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.08);

      if (this.stepNoiseBuf) {
        for (let g = 0; g < profile.grainCount; g++) {
          const offset = g === 0 ? 0 : g * 0.017 + Math.random() * 0.008;
          const gTime = t + offset;
          const src = ctx.createBufferSource();
          src.buffer = this.stepNoiseBuf;

          const filter = ctx.createBiquadFilter();
          filter.type = 'bandpass';
          filter.frequency.setValueAtTime(profile.filterFreqHz * (0.88 + Math.random() * 0.24), gTime);
          filter.Q.setValueAtTime(profile.filterQ, gTime);

          const nGain = ctx.createGain();
          const grainAmp = (g === 0 ? profile.noiseGain : profile.noiseGain * 0.65) * paceScale;
          const grainDur = surface === 'gravel' ? 0.032 : profile.durationSec;
          nGain.gain.setValueAtTime(0.001, gTime);
          nGain.gain.linearRampToValueAtTime(grainAmp, gTime + (surface === 'grass' ? 0.018 : 0.004));
          nGain.gain.exponentialRampToValueAtTime(0.0008, gTime + grainDur);

          src.connect(filter);
          filter.connect(nGain);
          nGain.connect(ctx.destination);
          src.start(gTime, Math.random() * 0.15, grainDur + 0.02);
        }

        if (surface === 'concrete' && rainIntensity > 0.35) {
          const splashSrc = ctx.createBufferSource();
          splashSrc.buffer = this.stepNoiseBuf;
          const hp = ctx.createBiquadFilter();
          hp.type = 'highpass';
          hp.frequency.setValueAtTime(3200, t);
          const sGain = ctx.createGain();
          sGain.gain.setValueAtTime(0.018 * rainIntensity * paceScale, t);
          sGain.gain.exponentialRampToValueAtTime(0.0008, t + 0.075);
          splashSrc.connect(hp);
          hp.connect(sGain);
          sGain.connect(ctx.destination);
          splashSrc.start(t, Math.random() * 0.15, 0.085);
        }
      }
    } catch {
      // Ignore
    }
  }

  public playLanding(surface: GroundSurface) {
    if (this.muted || !this.ctx) return;
    this.playStep(surface, true, 0);
  }

  public playInteractChime(kind: 'door' | 'elevator' | 'purchase' | 'prayer' | 'horn' | 'greet') {
    if (this.muted || !this.ctx) return;
    try {
      const t = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      if (kind === 'horn') {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(340, t);
        osc.frequency.setValueAtTime(415, t + 0.09);
        gain.gain.setValueAtTime(0.045, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.24);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(t);
        osc.stop(t + 0.25);
        return;
      }
      if (kind === 'greet') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(523.25, t);
        osc.frequency.setValueAtTime(659.25, t + 0.08);
        gain.gain.setValueAtTime(0.035, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
      } else if (kind === 'elevator') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(660, t);
        osc.frequency.setValueAtTime(880, t + 0.12);
        gain.gain.setValueAtTime(0.06, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
      } else if (kind === 'prayer') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(392, t);
        osc.frequency.setValueAtTime(440, t + 0.18);
        osc.frequency.setValueAtTime(523.25, t + 0.36);
        gain.gain.setValueAtTime(0.05, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.65);
      } else {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(kind === 'purchase' ? 520 : 280, t);
        osc.frequency.exponentialRampToValueAtTime(kind === 'purchase' ? 780 : 180, t + 0.14);
        gain.gain.setValueAtTime(0.05, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.16);
      }
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(t);
      osc.stop(t + 0.7);
    } catch {
      // Ignore
    }
  }

  public tickAmbientTraffic(elapsed: number, nearRoad: boolean) {
    if (this.muted || !this.ctx || !nearRoad) return;
    if (elapsed > this.nextHornTime) {
      this.nextHornTime = elapsed + 7 + Math.random() * 11;
      try {
        const t = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(380 + Math.random() * 60, t);
        gain.gain.setValueAtTime(0.012, t);
        gain.gain.exponentialRampToValueAtTime(0.0005, t + 0.15);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(t);
        osc.stop(t + 0.16);
      } catch {
        // Ignore
      }
    }
  }

  public dispose() {
    if (this.ctx) {
      void this.ctx.close();
      this.ctx = null;
    }
  }
}
