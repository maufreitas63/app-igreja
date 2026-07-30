/**
 * Conteúdo do Guia do Processo — orientação pedagógica para a liderança
 * sobre os 5 passos da Trilha de Discipulado.
 */

export type DiscipleshipGuideStep = {
  step: number;
  title: string;
  purpose: string;
  leaderFocus: string;
};

export const DISCIPLESHIP_PROCESS_GUIDE_INTRO =
  'Use este guia para acompanhar o que o discípulo vive em cada etapa e como a liderança deve acolher, ensinar e acompanhar.';

export const DISCIPLESHIP_PROCESS_GUIDE_STEPS: DiscipleshipGuideStep[] = [
  {
    step: 1,
    title: 'Boas-Vindas e Identidade da Igreja',
    purpose:
      'Acolher o visitante, apresentar a visão e os valores da comunidade, lendo as reflexões enviadas.',
    leaderFocus:
      'Confirme se a pessoa se sentiu bem-vinda e se compreendeu a identidade da igreja. Leia as reflexões com atenção pastoral.',
  },
  {
    step: 2,
    title: 'O Fundamento da Fé (A Graça e a Palavra)',
    purpose:
      'Estabelecer os pilares da fé cristã, a autoridade da Bíblia e a salvação pela graça.',
    leaderFocus:
      'Verifique se o discípulo articula graça, arrependimento e confiança na Escritura com clareza simples.',
  },
  {
    step: 3,
    title: 'O Passo da Fé (O Batismo por Imersão)',
    purpose:
      'Ensinar o significado do batismo e gerenciar os pedidos de batismo que chegam dos alunos.',
    leaderFocus:
      'Acompanhe dúvidas práticas e registre quem expressou desejo de batismo para encaminhamento pastoral.',
  },
  {
    step: 4,
    title: 'Comunhão e Pertença (A Igreja Local e os Pequenos Grupos)',
    purpose:
      'Conectar o novo membro à vida comunitária e aos grupos nos lares.',
    leaderFocus:
      'Ajude a pessoa a encontrar comunhão concreta: culto, relacionamentos e um pequeno grupo adequado.',
  },
  {
    step: 5,
    title: 'Servindo com Propósito (Ministérios e Mordomia)',
    purpose:
      'Orientar o aluno na descoberta de dons, mordomia e alinhamento com os voluntários.',
    leaderFocus:
      'Dialogue sobre dons, disponibilidade e próximos passos de serviço, sem pressa e com acompanhamento.',
  },
];
