/**
 * Recomputes the identifier the backend derives for a spectrum.
 *
 * The server keys a run on `sha256(float64 bytes of spectrum.y)[:32]` and nothing else
 * (`celery_config.short_vector_hash`). Reproducing it here lets the app recognise a
 * spectrum it has already run before sending anything, which matters because the
 * server's own cache check does not fire in this deployment: every submission starts a
 * fresh job and overwrites the id-to-task mapping, making the previous result
 * unreachable through the API.
 * @param y - Intensities on the canonical grid, exactly as they would be submitted.
 * @returns The 32-character job id.
 */
export async function computeJobId(y: ArrayLike<number>): Promise<string> {
  const values = new Float64Array(y.length);
  for (let i = 0; i < y.length; i++) {
    values[i] = y[i] as number;
  }
  const digest = await crypto.subtle.digest('SHA-256', values.buffer);
  const bytes = new Uint8Array(digest);
  let hex = '';
  for (const byte of bytes) {
    hex += byte.toString(16).padStart(2, '0');
  }
  return hex.slice(0, 32);
}
