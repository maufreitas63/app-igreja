/**
 * Guard de canal de autenticação — sem imports de outros módulos do app.
 * Evita dependência circular e falha de inicialização na tela de login.
 */

export const AUTH_NOTIFICATION_CHANNEL = 'email' as const;
export type AuthNotificationChannel = typeof AUTH_NOTIFICATION_CHANNEL;

export const AUTH_CHANNEL_BLOCKED_MESSAGE =
  'AUTH_CHANNEL_BLOCKED: autenticação só pode enviar PIN por e-mail. WhatsApp está desativado neste fluxo.';

export const AUTH_PIN_EMAIL_SQL_HINT =
  'Não foi possível enviar o código agora. Confira o e-mail e tente de novo em instantes.';

export const AUTH_PREFERRED_CHANNEL = 'email' as const;

export function assertAuthNotificationChannel(
  channel: string
): asserts channel is AuthNotificationChannel {
  if (channel !== AUTH_NOTIFICATION_CHANNEL) {
    console.error(AUTH_CHANNEL_BLOCKED_MESSAGE, { channel });
    throw new Error(AUTH_CHANNEL_BLOCKED_MESSAGE);
  }
}

export function rejectAuthWhatsAppDelivery(context: string): never {
  console.error(AUTH_CHANNEL_BLOCKED_MESSAGE, { context });
  throw new Error(AUTH_CHANNEL_BLOCKED_MESSAGE);
}
