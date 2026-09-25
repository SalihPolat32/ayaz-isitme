/**
 * Parçalanma (explode) tween'i: 0..1, ~600 ms, easeInOutCubic.
 * Ana render döngüsünden (`setAnimationLoop` → rAF) `update(now)` ile sürülür;
 * ayrı bir rAF açmaz. Hareket azaltma tercihi varsa anında uygular.
 */

export const easeInOutCubic = (x: number): number => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);

export const EXPLODE_DURATION = 600;

const now = (): number => (typeof performance !== 'undefined' ? performance.now() : Date.now());

/** Genel amaçlı skaler tween (0..1 ilerleme). */
export class Tween {
  private startTime = 0;
  private duration = 0;
  private running = false;
  private onUpdate: ((p: number) => void) | null = null;
  private onDone: (() => void) | null = null;

  get active(): boolean {
    return this.running;
  }

  start(duration: number, onUpdate: (p: number) => void, onDone?: () => void): void {
    this.startTime = now();
    this.duration = Math.max(0, duration);
    this.onUpdate = onUpdate;
    this.onDone = onDone ?? null;
    this.running = true;
    if (this.duration === 0) this.update(this.startTime);
  }

  cancel(): void {
    this.running = false;
    this.onUpdate = null;
    this.onDone = null;
  }

  /** `true` dönerse bu karede değer değişti. */
  update(time: number): boolean {
    if (!this.running) return false;
    const p = this.duration === 0 ? 1 : Math.min(1, (time - this.startTime) / this.duration);
    this.onUpdate?.(easeInOutCubic(p));
    if (p >= 1) {
      const done = this.onDone;
      this.running = false;
      this.onUpdate = null;
      this.onDone = null;
      done?.();
    }
    return true;
  }
}

export class ExplodeController {
  private value = 0;
  private target = 0;
  private from = 0;
  private readonly tween = new Tween();

  private readonly apply: (t: number) => void;
  private readonly reducedMotion: boolean;
  private readonly duration: number;

  constructor(apply: (t: number) => void, reducedMotion: boolean, duration: number = EXPLODE_DURATION) {
    this.apply = apply;
    this.reducedMotion = reducedMotion;
    this.duration = duration;
  }

  get(): number {
    return this.value;
  }

  getTarget(): number {
    return this.target;
  }

  set(t: number, animate = true): void {
    const k = Math.min(1, Math.max(0, t));
    this.target = k;
    this.from = this.value;
    if (!animate || this.reducedMotion || Math.abs(k - this.value) < 1e-4) {
      this.tween.cancel();
      this.value = k;
      this.apply(k);
      return;
    }
    this.tween.start(this.duration, (p) => {
      this.value = this.from + (this.target - this.from) * p;
      this.apply(this.value);
    });
  }

  /** Render döngüsünden çağrılır; `true` = değer bu karede değişti. */
  update(time: number): boolean {
    return this.tween.update(time);
  }

  cancel(): void {
    this.tween.cancel();
  }
}
