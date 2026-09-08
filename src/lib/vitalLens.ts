export type VitalLensCapturePayload = {
  video: string;
  fps: number;
  duration_seconds: number;
};

const DEFAULT_CAPTURE_DURATION_MS = 20_000;
const DEFAULT_CAPTURE_FPS = 15;

function captureDurationMs() {
  const testWindow = window as Window & { __VYVA_FACE_SCAN_TEST_DURATION_MS?: number };
  return typeof testWindow.__VYVA_FACE_SCAN_TEST_DURATION_MS === "number"
    ? Math.max(1, testWindow.__VYVA_FACE_SCAN_TEST_DURATION_MS)
    : DEFAULT_CAPTURE_DURATION_MS;
}

function bytesToBase64(bytes: Uint8Array) {
  let binary = "";
  const chunkSize = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
  }
  return window.btoa(binary);
}

export async function captureVitalLensPayload(
  video: HTMLVideoElement,
  canvas: HTMLCanvasElement,
): Promise<VitalLensCapturePayload> {
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) throw new Error("Could not read camera frames.");

  canvas.width = 40;
  canvas.height = 40;
  const durationMs = captureDurationMs();
  const frameIntervalMs = 1000 / DEFAULT_CAPTURE_FPS;
  const chunks: Uint8Array[] = [];
  const startedAt = performance.now();

  return new Promise((resolve, reject) => {
    const capture = () => {
      try {
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        const image = context.getImageData(0, 0, canvas.width, canvas.height);
        const rgb = new Uint8Array(canvas.width * canvas.height * 3);
        for (let src = 0, dest = 0; src < image.data.length; src += 4) {
          rgb[dest++] = image.data[src];
          rgb[dest++] = image.data[src + 1];
          rgb[dest++] = image.data[src + 2];
        }
        chunks.push(rgb);

        if (performance.now() - startedAt >= durationMs) {
          const totalBytes = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
          const payload = new Uint8Array(totalBytes);
          let offset = 0;
          for (const chunk of chunks) {
            payload.set(chunk, offset);
            offset += chunk.length;
          }
          resolve({
            video: bytesToBase64(payload),
            fps: DEFAULT_CAPTURE_FPS,
            duration_seconds: Math.round((durationMs / 1000) * 10) / 10,
          });
          return;
        }
        window.setTimeout(capture, frameIntervalMs);
      } catch (error) {
        reject(error);
      }
    };
    capture();
  });
}
