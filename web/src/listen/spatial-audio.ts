// Spatial sound for the pitch, built on the Web Audio API.
//
// The listener stands at the halfway line, facing the far touchline. Their favourite
// club always attacks to their RIGHT, so left/right tells them which goal is under
// threat. Through headphones the HRTF panner also places sounds in front (far touchline)
// or behind (near touchline). A soft tone follows the ball and rises in pitch as it
// nears either goal. Every event type has its own short sound ("earcon").
import { PITCH, type EventType, type TeamId } from "@/match/engine";

const SPREAD_X = 4; // metres of virtual space either side of the listener
const SPREAD_Z = 2;

export class SpatialPitch {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private ballPanner!: PannerNode;
  private ballOsc!: OscillatorNode;
  private ballGain!: GainNode;
  private favClub: TeamId = "home";
  private ballOn = true;

  /** Must be called from a user gesture (browsers block audio until then). */
  async start(favClub: TeamId) {
    this.favClub = favClub;
    if (this.ctx) {
      await this.ctx.resume();
      return;
    }
    const ctx = new AudioContext();
    this.ctx = ctx;
    this.master = ctx.createGain();
    this.master.gain.value = 0.9;
    this.master.connect(ctx.destination);

    this.ballPanner = this.panner();
    this.ballGain = ctx.createGain();
    this.ballGain.gain.value = this.ballOn ? 0.035 : 0;
    this.ballOsc = ctx.createOscillator();
    this.ballOsc.type = "triangle";
    this.ballOsc.frequency.value = 220;
    this.ballOsc.connect(this.ballGain).connect(this.ballPanner).connect(this.master);
    this.ballOsc.start();
    await ctx.resume();
  }

  stop() {
    void this.ctx?.close();
    this.ctx = null;
  }

  get running() {
    return this.ctx?.state === "running";
  }

  setFavClub(team: TeamId) {
    this.favClub = team;
  }

  setBallSound(on: boolean) {
    this.ballOn = on;
    if (this.ctx) this.ballGain.gain.setTargetAtTime(on ? 0.035 : 0, this.ctx.currentTime, 0.1);
  }

  /** Glide the ball tone to a new pitch position. */
  moveBall(x: number, y: number) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const { ax, az } = this.toAudio(x, y);
    this.ballPanner.positionX.linearRampToValueAtTime(ax, t + 0.5);
    this.ballPanner.positionZ.linearRampToValueAtTime(az, t + 0.5);
    // Higher as the ball nears either goal: danger you can hear.
    const nearGoal = Math.min(x, PITCH.length - x) / (PITCH.length / 2); // 0 at a goal line
    const freq = 200 + 260 * (1 - nearGoal) ** 2;
    this.ballOsc.frequency.linearRampToValueAtTime(freq, t + 0.5);
  }

  /** A short sound for an event, placed where it happened. */
  earcon(type: EventType, team: TeamId, x: number, y: number) {
    if (!this.ctx) return;
    const mine = team === this.favClub;
    const at = this.toAudio(x, y);
    switch (type) {
      case "pass":
        return this.tone([880], 0.05, 0.08, "sine", at);
      case "shot":
        return this.sweep(300, 3200, 0.35, at);
      case "goal":
        this.tone([523, 659, 784, 1047], 0.14, 0.25, "triangle", at);
        return this.crowd(1.6, at);
      case "save":
        return this.tone([784, 523], 0.1, 0.15, "square", at);
      case "tackle":
        return this.tone([110], 0.12, 0.35, "sine", at);
      case "pressure":
        return this.tone([620, 620], 0.04, 0.06, "square", at);
      case "possession":
        // Your team wins the ball: rising notes. The opponent: falling notes.
        return this.tone(mine ? [440, 660] : [660, 440], 0.1, 0.12, "sine", at);
    }
  }

  // ---- internals ----

  private toAudio(x: number, y: number) {
    // Rotate the pitch so the favourite club always attacks to the listener's right.
    const flip = this.favClub === "away";
    const fx = flip ? PITCH.length - x : x;
    const fy = flip ? PITCH.width - y : y;
    return {
      ax: (fx / PITCH.length) * 2 * SPREAD_X - SPREAD_X,
      az: (fy / PITCH.width) * 2 * SPREAD_Z - SPREAD_Z, // far touchline in front (-z)
    };
  }

  private panner(at?: { ax: number; az: number }) {
    const p = this.ctx!.createPanner();
    p.panningModel = "HRTF";
    p.distanceModel = "inverse";
    p.refDistance = 1;
    p.positionY.value = 0;
    p.positionX.value = at?.ax ?? 0;
    p.positionZ.value = at?.az ?? -1;
    return p;
  }

  private tone(
    freqs: number[],
    step: number,
    gain: number,
    type: OscillatorType,
    at: { ax: number; az: number },
  ) {
    const ctx = this.ctx!;
    const out = this.panner(at);
    out.connect(this.master);
    freqs.forEach((f, i) => {
      const t = ctx.currentTime + i * step;
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = type;
      osc.frequency.value = f;
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(gain, t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.001, t + step * 1.8);
      osc.connect(g).connect(out);
      osc.start(t);
      osc.stop(t + step * 2);
    });
  }

  private noise(seconds: number) {
    const ctx = this.ctx!;
    const buf = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * seconds), ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    return src;
  }

  private sweep(from: number, to: number, seconds: number, at: { ax: number; az: number }) {
    const ctx = this.ctx!;
    const t = ctx.currentTime;
    const src = this.noise(seconds);
    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.Q.value = 4;
    bp.frequency.setValueAtTime(from, t);
    bp.frequency.exponentialRampToValueAtTime(to, t + seconds);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.5, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + seconds);
    src.connect(bp).connect(g).connect(this.panner(at)).connect(this.master);
    src.start(t);
  }

  private crowd(seconds: number, at: { ax: number; az: number }) {
    const ctx = this.ctx!;
    const t = ctx.currentTime;
    const src = this.noise(seconds);
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 1200;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.25, t + 0.3);
    g.gain.exponentialRampToValueAtTime(0.001, t + seconds);
    src.connect(lp).connect(g).connect(this.panner(at)).connect(this.master);
    src.start(t);
  }
}
