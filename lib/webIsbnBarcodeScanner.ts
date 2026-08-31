import { ISBN_WEB_BARCODE_FORMATS } from '@/lib/isbnBarcode';

type DetectedBarcode = { rawValue?: string };
type BarcodeDetectorInstance = {
  detect: (source: CanvasImageSource) => Promise<DetectedBarcode[]>;
};
type BarcodeDetectorCtor = {
  new (options?: { formats?: string[] }): BarcodeDetectorInstance;
  getSupportedFormats?: () => Promise<string[]>;
};

function getBarcodeDetectorCtor(): BarcodeDetectorCtor | null {
  if (typeof window === 'undefined') {
    return null;
  }
  const ctor = (window as unknown as { BarcodeDetector?: BarcodeDetectorCtor }).BarcodeDetector;
  return typeof ctor === 'function' ? ctor : null;
}

export function canDetectBarcodesInBrowser(): boolean {
  return getBarcodeDetectorCtor() !== null;
}

async function pickSupportedFormats(ctor: BarcodeDetectorCtor): Promise<string[]> {
  const wanted = [...ISBN_WEB_BARCODE_FORMATS];
  let matched = wanted;

  if (typeof ctor.getSupportedFormats === 'function') {
    try {
      const supported = await ctor.getSupportedFormats();
      const allowed = new Set(
        supported.map((format) => format.toLowerCase().replace(/-/g, '_'))
      );
      const filtered = wanted.filter((format) => allowed.has(format));
      if (filtered.length) {
        matched = filtered;
      }
    } catch {
      matched = wanted;
    }
  }

  const hasBookFormat = matched.some(
    (format) => format === 'ean_13' || format === 'ean_8' || format === 'upc_a'
  );
  if (!hasBookFormat) {
    throw new Error(
      'Este navegador não lê código de barras de livro (EAN). Use Chrome ou Edge, ou digite o ISBN.'
    );
  }
  return matched;
}

function stopStream(stream: MediaStream | null) {
  stream?.getTracks().forEach((track) => {
    track.stop();
    stream.removeTrack(track);
  });
}

/**
 * Câmera traseira + BarcodeDetector no DOM (PWA).
 * Devolve uma função para encerrar o stream e o loop de leitura.
 */
export async function startWebIsbnScan(
  host: HTMLElement,
  onRaw: (raw: string) => void
): Promise<() => void> {
  const Detector = getBarcodeDetectorCtor();
  if (!Detector) {
    throw new Error(
      'Este navegador não lê código de barras. Use Chrome ou Edge, ou digite o ISBN.'
    );
  }

  const formats = await pickSupportedFormats(Detector);

  const video = document.createElement('video');
  video.setAttribute('playsinline', 'true');
  video.setAttribute('muted', 'true');
  video.autoplay = true;
  video.muted = true;
  video.playsInline = true;
  video.style.width = '100%';
  video.style.height = '100%';
  video.style.objectFit = 'cover';
  video.style.background = '#000';
  host.replaceChildren(video);

  let stream: MediaStream | null = null;
  const constraints: MediaStreamConstraints[] = [
    {
      audio: false,
      video: {
        facingMode: { ideal: 'environment' },
        width: { ideal: 1280 },
        height: { ideal: 720 },
      },
    },
    { audio: false, video: true },
  ];

  let lastError: unknown = null;
  for (const constraint of constraints) {
    try {
      stream = await navigator.mediaDevices.getUserMedia(constraint);
      break;
    } catch (error) {
      lastError = error;
    }
  }

  if (!stream) {
    video.remove();
    const name =
      lastError && typeof lastError === 'object' && 'name' in lastError
        ? String(lastError.name)
        : '';
    if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
      throw new Error(
        'Câmera bloqueada. Clique no cadeado na barra de endereço e permita o acesso.'
      );
    }
    throw new Error('Não foi possível abrir a câmera para bipar o ISBN.');
  }

  video.srcObject = stream;
  await video.play().catch(() => undefined);

  const detector = new Detector({ formats });
  let stopped = false;
  let busy = false;
  let timer: ReturnType<typeof setInterval> | null = null;

  const tick = async () => {
    if (stopped || busy || video.readyState < 2) {
      return;
    }
    busy = true;
    try {
      const codes = await detector.detect(video);
      const raw = codes.find((item) => item.rawValue?.trim())?.rawValue?.trim();
      if (raw) {
        onRaw(raw);
      }
    } catch {
      // quadro sem código — ignora
    } finally {
      busy = false;
    }
  };

  timer = setInterval(() => {
    void tick();
  }, 220);

  return () => {
    stopped = true;
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
    stopStream(stream);
    video.srcObject = null;
    video.remove();
    host.replaceChildren();
  };
}

export async function detectIsbnFromImageFile(file: File): Promise<string | null> {
  const Detector = getBarcodeDetectorCtor();
  if (!Detector) {
    return null;
  }

  const formats = await pickSupportedFormats(Detector);
  const detector = new Detector({ formats });
  const bitmap = await createImageBitmap(file);
  try {
    const codes = await detector.detect(bitmap);
    return codes.find((item) => item.rawValue?.trim())?.rawValue?.trim() ?? null;
  } finally {
    bitmap.close();
  }
}
