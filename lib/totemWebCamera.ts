export type WebCameraProbe = {
  canUseCamera: boolean;
  isSecureContext: boolean;
  message?: string;
};

const getNavigator = () => {
  if (typeof navigator === 'undefined') {
    return null;
  }

  return navigator;
};

/** Pré-requisitos de câmera no navegador (HTTPS / localhost). */
export function getWebCameraProbe(): WebCameraProbe {
  if (typeof window === 'undefined') {
    return {
      canUseCamera: false,
      isSecureContext: false,
      message: 'Ambiente sem navegador.',
    };
  }

  const isSecureContext = window.isSecureContext === true;
  const nav = getNavigator();
  const hasGetUserMedia = Boolean(nav?.mediaDevices?.getUserMedia);

  if (!isSecureContext) {
    return {
      canUseCamera: false,
      isSecureContext: false,
      message:
        'No navegador a câmera só funciona em HTTPS ou em http://localhost. Abra o app por localhost, não pelo IP da rede (ex.: 192.168.x.x).',
    };
  }

  if (!hasGetUserMedia) {
    return {
      canUseCamera: false,
      isSecureContext: true,
      message: 'Este navegador não oferece acesso à câmera.',
    };
  }

  return {
    canUseCamera: true,
    isSecureContext: true,
  };
}

const stopStream = (stream: MediaStream) => {
  stream.getTracks().forEach((track) => {
    track.stop();
    stream.removeTrack(track);
  });
};

const readGetUserMediaError = (error: unknown) => {
  const name =
    error && typeof error === 'object' && 'name' in error && typeof error.name === 'string'
      ? error.name
      : '';
  const message =
    error && typeof error === 'object' && 'message' in error && typeof error.message === 'string'
      ? error.message
      : '';

  if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
    return {
      granted: false,
      blocked: true,
      message:
        'Câmera bloqueada. Clique no ícone de cadeado/câmera na barra de endereço e permita o acesso.',
    };
  }

  if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
    return {
      granted: false,
      blocked: false,
      message: 'Nenhuma câmera foi encontrada neste dispositivo.',
    };
  }

  if (name === 'NotReadableError' || name === 'TrackStartError') {
    return {
      granted: false,
      blocked: false,
      message: 'A câmera está em uso por outro programa. Feche o outro app e tente de novo.',
    };
  }

  return {
    granted: false,
    blocked: false,
    message: message || 'Não foi possível acessar a câmera no navegador.',
  };
};

/**
 * Pede câmera com gesto do usuário (obrigatório na web).
 * Libera o stream em seguida — o CameraView abrirá o seu próprio stream.
 */
export async function requestWebCameraAccess(preferredFacing: 'user' | 'environment' = 'environment') {
  const probe = getWebCameraProbe();

  if (!probe.canUseCamera) {
    return {
      granted: false as const,
      blocked: false,
      message: probe.message ?? 'Câmera indisponível neste contexto.',
    };
  }

  const nav = getNavigator();
  const constraints: MediaStreamConstraints[] =
    preferredFacing === 'user'
      ? [
          { video: { facingMode: { ideal: 'user' } }, audio: false },
          { video: true, audio: false },
        ]
      : [
          { video: { facingMode: { ideal: 'environment' } }, audio: false },
          { video: { facingMode: { ideal: 'user' } }, audio: false },
          { video: true, audio: false },
        ];

  let lastError: unknown = null;

  for (const constraint of constraints) {
    try {
      const stream = await nav!.mediaDevices!.getUserMedia(constraint);
      stopStream(stream);
      return { granted: true as const, blocked: false };
    } catch (error) {
      lastError = error;
    }
  }

  return readGetUserMediaError(lastError);
}

export async function requestWebCameraForTotem() {
  return requestWebCameraAccess('environment');
}

export async function requestWebCameraForSelfie() {
  return requestWebCameraAccess('user');
}
