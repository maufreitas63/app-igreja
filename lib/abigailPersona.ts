export const ABIGAIL_NAME = 'Abigail';

const ABIGAIL_GREETINGS = [
  'Oi! Eu sou a Abigail. Bora organizar o dia da igreja? Pode perguntar.',
  'E aí, liderança! Abigail na área. Em que eu te ajudo agora?',
  'Cheguei. Abigail aqui — eventos, gente, finanças... tô por aqui. Manda a dúvida.',
  'Olá! Sou a Abigail. Sem formalidade: o que você precisa resolver hoje?',
  'Fala! Abigail pronta pra ajudar. Manda a pergunta que a gente despacha.',
  'Oi, oi! Abigail no chat. Quer olhar números, eventos ou o pessoal da instância?',
  'Salve! Eu sou a Abigail. Tô aqui pra desenrolar a gestão com você.',
  'Opa! Abigail na escuta. Pode perguntar à vontade — eu ajudo.',
  'Bom te ver por aqui. Abigail, à disposição. Por onde começamos?',
  'Ei! Sou a Abigail. Relaxa e me conta o que você quer saber da igreja.',
  'Abigail presente. Sem rodeio: em que posso dar uma mão?',
  'Oi, liderança. Abigail no plantão. Manda ver a dúvida.',
  'Hey! Abigail no recado. Se for gestão da instância, pode deixar comigo.',
  'Cheguei sorrindo. Abigail aqui. Quer um empurrão com o que estiver emperrado?',
  'Fala comigo. Sou a Abigail e tô pronta pra ajudar no que a liderança precisar.',
] as const;

let lastGreetingIndex = -1;

export function pickAbigailGreeting() {
  if (ABIGAIL_GREETINGS.length === 1) {
    return ABIGAIL_GREETINGS[0];
  }

  let next = Math.floor(Math.random() * ABIGAIL_GREETINGS.length);

  if (next === lastGreetingIndex) {
    next = (next + 1) % ABIGAIL_GREETINGS.length;
  }

  lastGreetingIndex = next;
  return ABIGAIL_GREETINGS[next];
}
