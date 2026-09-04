import { Constants } from "@babylonjs/core/Engines/constants";
import { RawCubeTexture } from "@babylonjs/core/Materials/Textures/rawCubeTexture";
import { Texture } from "@babylonjs/core/Materials/Textures/texture";
import { CubeMapToSphericalPolynomialTools } from "@babylonjs/core/Misc/HighDynamicRange/cubemapToSphericalPolynomial";
import type { Scene } from "@babylonjs/core/scene";

/**
 * Procedural image-based lighting for the facility.
 *
 * The level materials are PBR with real metallic values, but without an
 * environment texture their specular term is black and every steel surface
 * reads as dead matte plastic. Rather than ship an HDR asset, this builds a
 * tiny cubemap on the CPU that encodes what a lab ceiling looks like from the
 * floor: a dark panel grid with two long fluorescent tubes overhead, mid-tone
 * walls at the horizon and a dark floor below. Reflections then pick up long
 * soft highlights along tube directions, and the matching spherical harmonics
 * give the diffuse term a cool top-down fill.
 */

const FACE_SIZE = 32;

interface FaceAxes {
  normal: readonly [number, number, number];
  fileX: readonly [number, number, number];
  fileY: readonly [number, number, number];
}

/**
 * Face orientation table shared with Babylon's spherical-harmonics
 * integration (`CubeMapToSphericalPolynomialTools`), in WebGL face order
 * (+X, -X, +Y, -Y, +Z, -Z). Matching it means the irradiance we hand back is
 * integrated over exactly the texels we upload.
 */
const FACES: readonly FaceAxes[] = [
  { normal: [1, 0, 0], fileX: [0, 0, -1], fileY: [0, -1, 0] },
  { normal: [-1, 0, 0], fileX: [0, 0, 1], fileY: [0, -1, 0] },
  { normal: [0, 1, 0], fileX: [1, 0, 0], fileY: [0, 0, 1] },
  { normal: [0, -1, 0], fileX: [1, 0, 0], fileY: [0, 0, -1] },
  { normal: [0, 0, 1], fileX: [1, 0, 0], fileY: [0, -1, 0] },
  { normal: [0, 0, -1], fileX: [-1, 0, 0], fileY: [0, -1, 0] },
];

const smooth = (edge0: number, edge1: number, value: number): number => {
  const t = Math.min(1, Math.max(0, (value - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
};

const mix = (a: number, b: number, t: number): number => a + (b - a) * t;

/** Display-space radiance for one world direction, written into `out`. */
function facilityRadiance(
  x: number,
  y: number,
  z: number,
  out: [number, number, number]
): void {
  // Ceiling panels: dark blue-grey, brightening slightly toward the zenith.
  const ceilR = mix(0.09, 0.16, y);
  const ceilG = mix(0.13, 0.22, y);
  const ceilB = mix(0.14, 0.24, y);
  // Walls at the horizon: the clean ceramic panel tone.
  const wallR = 0.3;
  const wallG = 0.38;
  const wallB = 0.39;
  // Floor: dark tile with a faint teal cast.
  const floorR = 0.075;
  const floorG = 0.105;
  const floorB = 0.11;

  let r: number;
  let g: number;
  let b: number;
  if (y >= 0) {
    // Blend from the wall band into ceiling panels above ~20 degrees.
    const up = smooth(0.12, 0.45, y);
    r = mix(wallR, ceilR, up);
    g = mix(wallG, ceilG, up);
    b = mix(wallB, ceilB, up);
    // Two fluorescent tubes running along Z, plus a fainter central diffuser.
    // Tube angular position is expressed as x/y so they stay straight lines
    // when viewed from below.
    const slope = Math.abs(x) / Math.max(0.08, y);
    const tube = Math.max(
      smooth(0.22, 0.02, Math.abs(slope - 0.62)),
      0.45 * smooth(0.16, 0.02, slope)
    );
    // Tubes only span the corridor, so fade them out toward the far ends.
    const along = 1 - smooth(0.7, 0.98, Math.abs(z));
    const glow = tube * along * smooth(0.18, 0.5, y);
    r = mix(r, 0.86, glow);
    g = mix(g, 1.0, glow);
    b = mix(b, 0.97, glow);
  } else {
    // Walls darken into a skirting band, then the floor.
    const down = smooth(-0.1, -0.5, y);
    r = mix(wallR * 0.85, floorR, down);
    g = mix(wallG * 0.85, floorG, down);
    b = mix(wallB * 0.85, floorB, down);
    // Faint tube reflections in the polished floor.
    const slope = Math.abs(x) / Math.max(0.08, -y);
    const reflect =
      0.16 * smooth(0.3, 0.05, Math.abs(slope - 0.62)) * smooth(-0.35, -0.8, y);
    r = mix(r, 0.5, reflect);
    g = mix(g, 0.62, reflect);
    b = mix(b, 0.6, reflect);
  }
  out[0] = r;
  out[1] = g;
  out[2] = b;
}

function buildFace(axes: FaceAxes): Uint8Array {
  const data = new Uint8Array(FACE_SIZE * FACE_SIZE * 4);
  const color: [number, number, number] = [0, 0, 0];
  const step = 2 / FACE_SIZE;
  let offset = 0;
  for (let row = 0; row < FACE_SIZE; row += 1) {
    const v = -1 + step * (row + 0.5);
    for (let column = 0; column < FACE_SIZE; column += 1) {
      const u = -1 + step * (column + 0.5);
      let x = axes.normal[0] + axes.fileX[0] * u + axes.fileY[0] * v;
      let y = axes.normal[1] + axes.fileX[1] * u + axes.fileY[1] * v;
      let z = axes.normal[2] + axes.fileX[2] * u + axes.fileY[2] * v;
      const length = Math.hypot(x, y, z);
      x /= length;
      y /= length;
      z /= length;
      facilityRadiance(x, y, z, color);
      data[offset] = Math.round(Math.min(1, color[0]) * 255);
      data[offset + 1] = Math.round(Math.min(1, color[1]) * 255);
      data[offset + 2] = Math.round(Math.min(1, color[2]) * 255);
      data[offset + 3] = 255;
      offset += 4;
    }
  }
  return data;
}

/**
 * Builds the facility environment cubemap and assigns it as the scene's
 * environment texture. Irradiance is integrated on the CPU from the same
 * texels so no GPU read-back is needed.
 */
export function createFacilityEnvironment(scene: Scene): RawCubeTexture {
  const faces = FACES.map(buildFace);
  const texture = new RawCubeTexture(
    scene,
    faces,
    FACE_SIZE,
    Constants.TEXTUREFORMAT_RGBA,
    Constants.TEXTURETYPE_UNSIGNED_BYTE,
    true,
    false,
    Texture.TRILINEAR_SAMPLINGMODE
  );
  texture.name = "facility environment";
  texture.gammaSpace = true;
  texture.sphericalPolynomial =
    CubeMapToSphericalPolynomialTools.ConvertCubeMapToSphericalPolynomial({
      right: faces[0],
      left: faces[1],
      up: faces[2],
      down: faces[3],
      front: faces[4],
      back: faces[5],
      size: FACE_SIZE,
      format: Constants.TEXTUREFORMAT_RGBA,
      type: Constants.TEXTURETYPE_UNSIGNED_BYTE,
      gammaSpace: true,
    });
  return texture;
}
