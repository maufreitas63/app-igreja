/**
 * Marca d'água global do app.
 *
 * Opções em logos/:
 * - 4.jpeg: silhueta preta sobre branco — usada com blend multiply para não exibir o fundo.
 * - 1.jpeg / 2.jpeg / 5.jpeg: fundo branco com artefatos JPEG visíveis no overlay.
 * - 3.jpeg: fundo preto sólido — cria “caixa” no overlay.
 */
/** Mesma arte usada nos ícones do app (`npm run generate:icons`). */
export const APP_WATERMARK_IMAGE = require('../logos/4.jpeg');

/** Opacidade única global — visível sobre fundo escuro, sem prejudicar leitura. */
export const APP_WATERMARK_OPACITY = 0.09;
