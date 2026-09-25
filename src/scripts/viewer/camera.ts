/**
 * Kamera yardımcıları: klavye ile yörünge adımı ve küresel (spherical) tween.
 * OrbitControls her `update()` çağrısında kamera konumundan küresel koordinatları
 * yeniden türettiği için kamerayı doğrudan taşımak güvenlidir.
 */
import { Spherical, Vector3, type PerspectiveCamera } from 'three';
import type { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { Tween } from './explode.ts';

export interface SphericalView {
  radius: number;
  phi: number;
  theta: number;
  target: Vector3;
}

const EPS = 1e-4;
const _offset = new Vector3();
const _sph = new Spherical();

export function readView(camera: PerspectiveCamera, controls: OrbitControls): SphericalView {
  _offset.copy(camera.position).sub(controls.target);
  _sph.setFromVector3(_offset);
  return { radius: _sph.radius, phi: _sph.phi, theta: _sph.theta, target: controls.target.clone() };
}

export function clampView(view: SphericalView, controls: OrbitControls): SphericalView {
  const phi = Math.min(controls.maxPolarAngle - EPS, Math.max(controls.minPolarAngle + EPS, view.phi));
  const radius = Math.min(controls.maxDistance, Math.max(controls.minDistance, view.radius));
  return { ...view, phi, radius };
}

export function applyView(view: SphericalView, camera: PerspectiveCamera, controls: OrbitControls): void {
  const v = clampView(view, controls);
  _sph.set(v.radius, v.phi, v.theta);
  _sph.makeSafe();
  controls.target.copy(v.target);
  camera.position.setFromSpherical(_sph).add(controls.target);
  camera.lookAt(controls.target);
}

/** Klavye adımı: azimut/polar açı farkı (rad) ve uzaklık çarpanı. */
export function orbitStep(camera: PerspectiveCamera, controls: OrbitControls, dTheta: number, dPhi: number, scale = 1): void {
  const v = readView(camera, controls);
  applyView({ ...v, theta: v.theta + dTheta, phi: v.phi + dPhi, radius: v.radius * scale }, camera, controls);
}

/** En kısa açısal yol için hedef theta'yı kaynağa göre sar. */
const nearestTheta = (from: number, to: number): number => {
  let d = (to - from) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return from + d;
};

export class CameraMover {
  private readonly tween = new Tween();

  private readonly camera: PerspectiveCamera;
  private readonly controls: OrbitControls;

  constructor(camera: PerspectiveCamera, controls: OrbitControls) {
    this.camera = camera;
    this.controls = controls;
  }

  get active(): boolean {
    return this.tween.active;
  }

  goTo(view: SphericalView, duration: number, onDone?: () => void): void {
    const from = readView(this.camera, this.controls);
    const to = clampView({ ...view, theta: nearestTheta(from.theta, view.theta) }, this.controls);
    const target = new Vector3();
    this.tween.start(
      duration,
      (p) => {
        target.copy(from.target).lerp(to.target, p);
        applyView(
          {
            radius: from.radius + (to.radius - from.radius) * p,
            phi: from.phi + (to.phi - from.phi) * p,
            theta: from.theta + (to.theta - from.theta) * p,
            target,
          },
          this.camera,
          this.controls,
        );
      },
      onDone,
    );
  }

  cancel(): void {
    this.tween.cancel();
  }

  update(time: number): boolean {
    return this.tween.update(time);
  }
}
