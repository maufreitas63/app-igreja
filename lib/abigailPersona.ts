export const ABIGAIL_NAME = 'Abigail';

type GreetingFn = (name: string) => string;

const ABIGAIL_GREETINGS: readonly GreetingFn[] = [
  (name) => `Oi, ${name}! Eu sou a Abigail. Bora organizar o dia da igreja? Pode perguntar.`,
  (name) => `E aí, ${name}! Abigail na área. Em que eu te ajudo agora?`,
  (name) => `Cheguei. Abigail aqui — eventos, gente, finanças... tô por aqui, ${name}. Manda a dúvida.`,
  (name) => `Olá, ${name}! Sou a Abigail. Sem formalidade: o que você precisa resolver hoje?`,
  (name) => `Fala, ${name}! Abigail pronta pra ajudar. Manda a pergunta que a gente despacha.`,
  (name) => `Oi, oi, ${name}! Abigail no chat. Quer olhar números, eventos ou o pessoal da instância?`,
  (name) => `Salve, ${name}! Eu sou a Abigail. Tô aqui pra desenrolar a gestão com você.`,
  (name) => `Opa, ${name}! Abigail na escuta. Pode perguntar à vontade — eu ajudo.`,
  (name) => `Bom te ver por aqui, ${name}. Abigail, à disposição. Por onde começamos?`,
  (name) => `Ei, ${name}! Sou a Abigail. Relaxa e me conta o que você quer saber da igreja.`,
  (name) => `Abigail presente, ${name}. Sem rodeio: em que posso dar uma mão?`,
  (name) => `Oi, ${name}. Abigail no plantão. Manda ver a dúvida.`,
  (name) => `Hey, ${name}! Abigail no recado. Se for gestão da instância, pode deixar comigo.`,
  (name) => `Cheguei sorrindo, ${name}. Abigail aqui. Quer um empurrão com o que estiver emperrado?`,
  (name) => `Fala comigo, ${name}. Sou a Abigail e tô pronta pra ajudar no que você precisar.`,
];

let lastGreetingIndex = -1;

export function pickAbigailGreeting(firstName?: string | null) {
  const name = firstName?.trim() || 'usuário';

  if (ABIGAIL_GREETINGS.length === 1) {
    return ABIGAIL_GREETINGS[0](name);
  }

  let next = Math.floor(Math.random() * ABIGAIL_GREETINGS.length);

  if (next === lastGreetingIndex) {
    next = (next + 1) % ABIGAIL_GREETINGS.length;
  }

  lastGreetingIndex = next;
  return ABIGAIL_GREETINGS[next](name);
}
