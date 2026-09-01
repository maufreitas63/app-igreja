import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

/** Pastas de recortes originais — ordem de busca. */
export const SCREENSHOT_SEARCH_DIRS = [
  'Screeshot',
  'docs/manual-manutencao/screens',
  'docs/manual-painel/screens',
  'images',
];

/**
 * Chave da parada → nomes de arquivo possíveis (rota sanitizada + manuais + numeração).
 * O resolvedor também aceita o próprio nome da chave como arquivo .png.
 */
export const SCREENSHOT_ALIASES = {
  login: ['00-login.png'],
  register: ['register.png', '01-cadastro.png', '01c-cadastro-sem-lgpd.png'],
  lgpd: ['lgpd.png', '01b-lgpd.png', 'm14b-lgpd-modulo-inativo.png'],
  'forgot-password': ['forgot-password.png'],
  'selecionar-igreja': ['selecionar-igreja.png'],
  'cadastro-familia': ['cadastro-familia.png'],
  'sessao-encerrada': ['sessao-encerrada.png'],
  inicio: ['(tabs).png', '1.png', 'index.png'],
  avisos: ['avisos.png', '2-1.png'],
  menu: ['2-2.png'],
  agenda: ['03-agenda-familia.png', '3.png'],
  geofence: ['3.png'],
  totem: ['totem-checkin.png', '04-qr-checkin.png'],
  salas: ['configuracao-salas.png', '05-salas-kids-teens.png', 'm05-sala-checkin.png'],
  ofertas: ['ofertas.png', '06-dizimos-ofertas.png'],
  pastoral: ['pastoral.png', '07-coracao-aberto.png'],
  'pastoral-history': ['pastoral-history.png'],
  perfil: ['perfil.png', '15-dados-cadastrais.png'],
  'manage-profile': ['manage-profile.png', '15-dados-cadastrais.png'],
  'manage-members': ['manage-members.png', '16-gerenciar-familia.png'],
  membros: ['membros.png', '08-lista-membros.png', '08b-lista-membros-familia.png', '08c-lista-visitantes.png'],
  mapa: ['mapa-geolocalizacao.png', '08d-mapa-geral.png'],
  aniversariantes: ['aniversariantes.png', '09-aniversariantes.png'],
  financial: ['financial.png', '10-financeiro.png'],
  'expense-report': ['expense-report.png', '11-relatorio-despesas.png', '11b-rd-formulario.png', '11.png'],
  escalas: ['escalas.png', '12-escalas.png'],
  estacionamento: ['13-estacionamento.png'],
  'pequeno-grupo': ['pequeno-grupo.png'],
  'mural-oportunidades': ['mural-oportunidades.png'],
  'mural-generosidade': ['mural-generosidade.png'],
  suggestions: ['suggestions-improvements.png'],
  'redes-sociais': ['redes-sociais.png'],
  'sobre-conecta': ['sobre-conecta.png'],
  administrativo: ['administrativo.png'],
  'autorizacao-midia': ['autorizacao-midia.png'],
  'livros-doados': ['livros-doados.png'],
  'trilha-discipulado': ['trilha-discipulado.png'],
  engrenagem: ['m00-acesso-engrenagem.png'],
  'menu-modulos': ['m01-menu-modulos.png'],
  events: ['m02-programacao-eventos.png', 'm03-editor-evento.png'],
  gantt: ['m04-cronograma.png'],
  'scale-types': ['m06-tipos-escala.png'],
  'scale-volunteers': ['m07-servos-disponibilidade.png'],
  'scale-schedule': ['m08-programacao-escalas.png'],
  'pastoral-care': ['m09-cuidado-pastoral.png'],
  financials: ['m10-financeiro-manut.png', '10a-fin-resultado.png', '10b-fin-comparativo.png', '10c-fin-12meses.png', '10d-fin-orcamento.png', '10e-fin-saldo.png'],
  quorum: ['m11-lista-presenca.png'],
  'profile-cadastro': ['m12-cadastro-usuario.png', '14-gestao-cadastros.png'],
  'family-reception': ['maintenance-dashboard-panel-family_reception.png', 'm13-recepcao-familiar.png'],
  'visitor-followup': ['maintenance-dashboard-panel-visitor_followup.png'],
  'access-control': ['m14-controle-acesso.png'],
  'role-change': ['m15-mudanca-papeis.png'],
  'access-insights': ['m16-acessos-usuarios.png'],
  selfie: ['17-selfie-biometrica.png'],
  logo: ['conecta.png'],
};

const IMAGE_EXT = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif']);

export function listScreenshotFiles(root) {
  const found = [];

  for (const relDir of SCREENSHOT_SEARCH_DIRS) {
    const absDir = path.join(root, relDir);
    if (!fs.existsSync(absDir)) {
      continue;
    }

    for (const entry of fs.readdirSync(absDir, { withFileTypes: true })) {
      if (!entry.isFile()) {
        continue;
      }

      const ext = path.extname(entry.name).toLowerCase();
      if (!IMAGE_EXT.has(ext)) {
        continue;
      }

      const abs = path.join(absDir, entry.name);
      found.push({
        abs,
        rel: path.join(relDir, entry.name).replaceAll('\\', '/'),
        name: entry.name,
        stem: path.parse(entry.name).name.toLowerCase(),
        dir: relDir,
      });
    }
  }

  return found;
}

function matchesAlias(file, alias) {
  const needle = alias.toLowerCase().replaceAll('\\', '/');
  return file.name.toLowerCase() === needle || file.rel.toLowerCase().endsWith(`/${needle}`);
}

export function resolveStopScreenshots(root, keys = []) {
  const files = listScreenshotFiles(root);
  const used = new Set();
  const images = [];

  const tryAdd = (file) => {
    if (!file || used.has(file.abs)) {
      return;
    }
    used.add(file.abs);
    images.push({
      abs: file.abs,
      rel: file.rel,
      name: file.name,
      href: pathToFileURL(file.abs).href,
    });
  };

  for (const key of keys) {
    const aliases = SCREENSHOT_ALIASES[key] ?? [];
    const candidates = [key, `${key}.png`, ...aliases];

    for (const alias of candidates) {
      const match = files.find((file) => matchesAlias(file, alias));
      tryAdd(match);
    }

    const stemKey = String(key).toLowerCase();
    for (const file of files) {
      if (file.stem === stemKey || file.stem.includes(stemKey)) {
        tryAdd(file);
      }
    }
  }

  return { images, usedAbs: used };
}

export function unusedScreenshots(root, usedAbs) {
  return listScreenshotFiles(root).filter((file) => !usedAbs.has(file.abs));
}
