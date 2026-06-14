/**
 * Captura PNG reais do PWA (dist/) para MANUAL_DASHBOARD_MANUTENCAO.md.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { captureAppScreens } from './manual-screen-kit/app-capture.mjs';
import { manutencaoJobs } from './manual-screen-kit/manutencao-jobs.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const outDir = path.join(root, 'docs', 'manual-manutencao', 'screens');

const legends = {
  'm00-acesso-engrenagem.png': [
    ['①', 'Ícone **engrenagem** ao lado de encerrar sessão'],
    ['②', 'Botão **Encerrar sessão** / sair do aplicativo'],
  ],
  'm01-menu-modulos.png': [
    ['①', 'Atalhos dos **Módulos de manutenção**'],
    ['②', 'Rodapé **‹ Menu ›** do carrossel âmbar'],
    ['③', 'Contador **1 / N** — posição no painel'],
  ],
  'm02-programacao-eventos.png': [
    ['①', 'Botão **Novo evento**'],
    ['②', 'Lista **Eventos cadastrados**'],
    ['③', 'Badge **Publicado** / **Rascunho**'],
  ],
  'm03-editor-evento.png': [
    ['①', '**Nome do evento** e data/hora'],
    ['②', '**Capacidade (vagas)** obrigatória'],
    ['③', 'Chips **Kids** · **Teens** · **Totem** · **Quórum**'],
    ['④', 'Botão **Salvar** no rodapé do formulário'],
  ],
  'm04-cronograma.png': [
    ['①', 'Barras do **Cronograma de Eventos**'],
    ['②', 'Toque na barra abre a **edição** do evento'],
  ],
  'm05-sala-checkin.png': [
    ['①', 'Chips **IBN KIDS** / **IBN TEENS**'],
    ['②', 'Botão **Confirmar entrada** por criança/adolescente'],
  ],
  'm06-tipos-escala.png': [
    ['①', 'Seção **Cadastrar tipo** de escala'],
    ['②', 'Lista de **Tipos cadastrados**'],
  ],
  'm07-servos-disponibilidade.png': [
    ['①', 'Seletor **Tipo de escala**'],
    ['②', 'Coluna **Disponível** por servo'],
  ],
  'm08-programacao-escalas.png': [
    ['①', '**Escala** e **Data** do serviço'],
    ['②', 'Botão **Salvar programação**'],
  ],
  'm09-cuidado-pastoral.png': [
    ['①', 'Seletor **Solicitante**'],
    ['②', 'Detalhe do **pedido** selecionado'],
    ['③', 'Campo **Estágio** de acompanhamento'],
  ],
  'm10-financeiro-manut.png': [
    ['①', 'Seção **Período** (mês)'],
    ['②', '**Importação CSV** do extrato'],
    ['③', '**Relatórios RD** pendentes'],
  ],
  'm11-lista-presenca.png': [
    ['①', 'Seletor de **evento com quórum**'],
    ['②', '**Gerar lista de presença**'],
    ['③', 'Tabela de **status** de check-in'],
  ],
  'm12-cadastro-usuario.png': [
    ['①', 'Campo **Buscar** perfil'],
    ['②', 'Dados cadastrais e **CEP/endereço**'],
  ],
  'm13-recepcao-familiar.png': [
    ['①', 'Itens da **fila** do `/cadastro-familia/`'],
    ['②', 'Status **Aguardando triagem** / análise'],
  ],
  'm14-controle-acesso.png': [
    ['①', 'Seletor de **Papel**'],
    ['②', 'Lista de **grants** (permissões)'],
    ['③', '**Salvar permissões**'],
  ],
  'm15-mudanca-papeis.png': [
    ['①', 'Seletor de **Membro**'],
    ['②', 'Segmentos **Visitante** / **Congregado** / **Membro**'],
    ['③', '**Aplicar mudança**'],
  ],
  'm16-acessos-usuarios.png': [
    ['①', 'Campo **Buscar perfil**'],
    ['②', 'Ícone **histórico** por sessão de login'],
    ['③', 'Balão com **telas visitadas** na sessão'],
  ],
};

fs.mkdirSync(outDir, { recursive: true });
for (const f of fs.readdirSync(outDir)) {
  if (f.endsWith('.png') || f.endsWith('.svg')) {
    fs.unlinkSync(path.join(outDir, f));
  }
}

await captureAppScreens(manutencaoJobs, outDir);

fs.writeFileSync(
  path.join(root, 'docs', 'manual-manutencao', 'screen-legends.json'),
  JSON.stringify(legends, null, 2),
  'utf8'
);

console.log(`Capturas reais de manutenção em ${outDir}`);
