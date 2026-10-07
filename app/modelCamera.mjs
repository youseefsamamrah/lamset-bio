/**
 * Frame the default front view from atom coordinates, independent of text bounds.
 * Extra depth keeps even the nearest atoms inside the padded perspective frustum.
 * @param {ArrayLike<number>} minimum
 * @param {ArrayLike<number>} maximum
 * @param {{width:number, height:number}} viewport
 * @param {number} fov
 * @param {number} margin
 */
export function fitModelCamera(minimum, maximum, viewport, fov = Math.PI / 4, margin = 0.9) {
  if (viewport.width <= 0 || viewport.height <= 0 || !Number.isFinite(fov) || fov <= 0 || fov >= Math.PI) return null;
  const center = [0, 1, 2].map(axis => (minimum[axis] + maximum[axis]) / 2);
  const half = [0, 1, 2].map(axis => (maximum[axis] - minimum[axis]) / 2 + margin);
  if (!center.every(Number.isFinite) || !half.every(value => Number.isFinite(value) && value > 0)) return null;
  const aspect = viewport.width / viewport.height;
  const tangent = Math.tan(fov / 2);
  const distance = Math.max(half[1], half[0] / aspect) / (tangent * 0.82) + half[2];
  return {
    target: center,
    position: [center[0], center[1], center[2] + distance],
    radius: Math.hypot(...half),
    up: [0, 1, 0],
  };
}
