/**
 * Detecta a lição 5.1 «Descobrindo meus Dons» — abre Perfil Ministerial no lugar de vídeo.
 */
export function isMinisterialGiftsLesson(
  module: { sort_order: number },
  lesson: { sort_order: number; title: string }
): boolean {
  const title = lesson.title.trim().toLowerCase();
  if (title.includes('descobrindo meus dons')) {
    return true;
  }
  return module.sort_order === 5 && lesson.sort_order === 1;
}
