/**
 * Marca d'água global do app.
 *
 * Opções avaliadas em logos/:
 * - 1.jpeg / 2.jpeg / 5.jpeg: logo prata/cinza — melhor leitura em fundo escuro (#0f172a).
 * - 4.jpeg: silhueta preta — some demais sobre fundos escuros.
 * - 3.jpeg: fundo preto sólido — cria “caixa” visível no overlay.
 *
 * Escolhido: 1.jpeg (contraste suave, identidade IBNORTE, sem ruído de fundo).
 */
export const APP_WATERMARK_IMAGE = require('../logos/1.jpeg');

/** Opacidade única global — discreta, sem prejudicar leitura. */
export const APP_WATERMARK_OPACITY = 0.07;
