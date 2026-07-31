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
  'A Trilha tem 5 passos sequenciais. Use este guia para acompanhar o discípulo em cada etapa e orientar o avanço até o reconhecimento público.';

export const DISCIPLESHIP_PROCESS_GUIDE_STEPS: DiscipleshipGuideStep[] = [
  {
    step: 1,
    title: 'Boas-Vindas e Identidade da Igreja',
    purpose:
      'Acolher o visitante, apresentar a visão e os valores da comunidade, e ler as reflexões enviadas.',
    leaderFocus:
      'Confirme se a pessoa se sentiu bem-vinda e compreendeu a identidade da igreja. Leia a reflexão da lição 1.3 com atenção pastoral.',
  },
  {
    step: 2,
    title: 'O Fundamento da Fé (A Graça e a Palavra)',
    purpose:
      'Estabelecer os pilares da fé cristã: a autoridade da Bíblia e a salvação pela graça.',
    leaderFocus:
      'Verifique se o discípulo articula graça, arrependimento e confiança na Escritura. Use a reflexão 2.3 como termômetro.',
  },
  {
    step: 3,
    title: 'O Passo da Fé (O Batismo por Imersão)',
    purpose:
      'Ensinar o significado do batismo e acompanhar pedidos de batismo que chegam dos alunos.',
    leaderFocus:
      'Acompanhe dúvidas práticas e registre quem expressou desejo de batismo na reflexão 3.3.',
  },
  {
    step: 4,
    title: 'Comunhão e Pertença (A Igreja Local e os Pequenos Grupos)',
    purpose:
      'Conectar o novo membro à vida comunitária e aos grupos nos lares.',
    leaderFocus:
      'Use o dia preferido da reflexão 4.3 para encaminhar a um pequeno grupo compatível.',
  },
  {
    step: 5,
    title: 'Servindo com Propósito (Ministérios e Mordomia)',
    purpose:
      'Orientar a descoberta de dons, mordomia e alinhamento com os ministérios. Ao concluir 100%, prepare certificado ou reconhecimento público.',
    leaderFocus:
      'Na lição 5.1 o aluno preenche o Perfil Ministerial (dons). Dialogue sobre a área desejada na reflexão 5.3. Alunos em «Novos» no card de Reconhecimentos estão prontos para celebração.',
  },
];
