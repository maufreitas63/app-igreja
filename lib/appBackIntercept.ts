/** Intercepta o voltar do PWA/hardware para fechar overlays antes de sair da tela. */

type AppBackInterceptor = () => boolean;

const interceptors: AppBackInterceptor[] = [];

export function pushAppBackInterceptor(handler: AppBackInterceptor): () => void {
  interceptors.push(handler);

  return () => {
    const index = interceptors.lastIndexOf(handler);

    if (index >= 0) {
      interceptors.splice(index, 1);
    }
  };
}

/** Executa o interceptor mais recente. `true` = o voltar foi consumido. */
export function runAppBackInterceptor(): boolean {
  for (let index = interceptors.length - 1; index >= 0; index -= 1) {
    if (interceptors[index]()) {
      return true;
    }
  }

  return false;
}
