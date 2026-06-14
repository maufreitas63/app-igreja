/**
 * Captura PNG reais do PWA (dist/) para MANUAL_DASHBOARD_MEMBRO.md — dados fictícios TstMax.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { captureAppScreens } from './manual-screen-kit/app-capture.mjs';
import { painelJobs } from './manual-screen-kit/painel-jobs.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const outDir = path.join(root, 'docs', 'manual-painel', 'screens');

const legends = {
  '00-login.png': [
    ['①', 'Campo **Seu celular** — exemplo `(11) 98765-4321`'],
    ['②', 'Botão **Continuar** após DDD + número válidos'],
    ['③', 'Campo **Código de acesso** (4 dígitos, oculto)'],
    ['④', '**Receber código no WhatsApp** na primeira vez'],
  ],
  '01-cadastro.png': [
    ['①', '**Nome completo** do membro'],
    ['②', '**Data de nascimento** `dd/mm/aaaa`'],
    ['③', 'Caixa rolável dos **Termos LGPD**'],
    ['④', 'Marcação **Li e aceito**'],
    ['⑤', '**Tirar Selfie Biométrica** antes de confirmar'],
  ],
  '01b-lgpd.png': [
    ['①', 'Caixa rolável dos **Termos LGPD** até o fim'],
    ['②', 'Marcação **Li e aceito** ou **Li e não concordo**'],
    ['③', 'Botão **Confirmar** / **Concluir**'],
  ],
  '02-indice-painel.png': [
    ['①', 'Atalhos do **Índice** abrem o card correspondente'],
    ['②', 'Área do **card ativo** no carrossel do Painel'],
    ['③', 'Contador **3 / 8** — posição no carrossel'],
    ['④', 'Rodapé **‹ Menu ›** para navegar e voltar ao Índice'],
  ],
  '03-agenda-familia.png': [
    ['①', 'Bloco **Evento selecionado** com selos Kids/Teens'],
    ['②', '**Vagas** — número entre parênteses = restantes'],
    ['③', '**Trocar evento** — lista de cultos publicados'],
    ['④', 'Checkbox de **Audiência** por familiar'],
  ],
  '04-qr-checkin.png': [
    ['①', 'Nome do **evento do dia**'],
    ['②', '**Etiqueta** da família (ex.: `FAM-2048`)'],
    ['③', '**QR Code** para apresentar no totem'],
  ],
  '05-salas-kids-teens.png': [
    ['①', 'Chip **IBN KIDS** com contador `confirmados/total`'],
    ['②', 'Chip **IBN TEENS** (alternar sala)'],
    ['③', '**✓** = entrada confirmada pela equipe da sala'],
  ],
  '06-dizimos-ofertas.png': [
    ['①', 'Dados do **recebedor** (nome e CNPJ fictícios)'],
    ['②', '**Chave PIX** exibida para cópia'],
    ['③', 'Botão **Copiar chave PIX**'],
  ],
  '07-coracao-aberto.png': [
    ['①', 'Seleção de **Motivo** e **Situação**'],
    ['②', 'Opção **Para mim** / **Familiar** / encaminhamento'],
    ['③', 'Campo de texto **Seu pedido**'],
    ['④', 'Atalho **Meus pedidos** (histórico)'],
  ],
  '08-lista-membros.png': [
    ['①', 'Campo **Procurar membro**'],
    ['②', 'Botão **Mapa Geral** (PWA/web)'],
    ['③', 'Linha da tabela com **WhatsApp** e **GPS**'],
  ],
  '09-aniversariantes.png': [
    ['①', 'Seletor **Mês**'],
    ['②', 'Lista **DD/MM** + nome'],
    ['③', 'Ícone **WhatsApp** para parabenizar'],
  ],
  '10-financeiro.png': [
    ['①', 'Dropdown **Selecionar mês**'],
    ['②', 'Atalho **Relatório de Despesas (RD)**'],
    ['③', 'Seções colapsáveis (**Saldo bancário**, etc.)'],
  ],
  '10a-fin-resultado.png': [
    ['①', 'Seção **Resultado do mês** expandida'],
    ['②', 'Tabela de **Receitas** do período'],
    ['③', 'Tabela de **Despesas** do período'],
  ],
  '10b-fin-comparativo.png': [
    ['①', 'Seção **Comparativo mensal** expandida'],
    ['②', 'Comparação entre dois meses consecutivos'],
  ],
  '10c-fin-12meses.png': [
    ['①', 'Seção **Últimos 12 meses** expandida'],
    ['②', 'Série **Realizado** acumulada'],
  ],
  '10d-fin-orcamento.png': [
    ['①', 'Seção **Planejado × Realizado** expandida'],
    ['②', 'Colunas **Planejado** e **Realizado**'],
  ],
  '10e-fin-saldo.png': [
    ['①', 'Seção **Saldo bancário** expandida'],
    ['②', 'Linha **Saldo total**'],
    ['③', 'Saldo por **conta** bancária'],
  ],
  '11-relatorio-despesas.png': [
    ['①', '**Chave PIX** do solicitante'],
    ['②', 'Botão **Novo RD**'],
    ['③', 'Lista **Meus relatórios**'],
    ['④', 'Status **Pendente** / **Conciliado**'],
  ],
  '11b-rd-formulario.png': [
    ['①', 'Campo **Chave PIX**'],
    ['②', '**Descrição** da despesa'],
    ['③', 'Anexo de **comprovante**'],
    ['④', '**Submeter e Finalizar**'],
  ],
  '12-escalas.png': [
    ['①', '**Selecionar Escala** (tipo de serviço)'],
    ['②', 'Tabela **Nome · Data · Zap**'],
    ['③', '**Identificar veículo** (escala estacionamento)'],
  ],
  '13-estacionamento.png': [
    ['①', 'Campo **Número da placa**'],
    ['②', 'Botão **Buscar**'],
    ['③', 'Dados do **proprietário** e veículo'],
  ],
  '14-gestao-cadastros.png': [
    ['①', 'Atalho **Dados Cadastrais**'],
    ['②', 'Atalho **Gerenciar Família**'],
    ['③', 'Checkbox **✓** de aceite do integrante'],
    ['④', '**Adicionar integrante** ao código familiar'],
  ],
  '15-dados-cadastrais.png': [
    ['①', 'Seção **Dados Pessoais** (expandida)'],
    ['②', 'Campo **Nome** e demais dados pessoais'],
    ['③', 'Seção **Contato**'],
    ['④', 'Seção **Endereço**'],
  ],
  '16-gerenciar-familia.png': [
    ['①', 'Código **Família Atual** no topo'],
    ['②', 'Botão **Adicionar integrante**'],
    ['③', 'Lista **Integrantes Cadastrados**'],
    ['④', 'Campo **Grau de parentesco**'],
  ],
  '17-selfie-biometrica.png': [
    ['①', 'Botão **Tirar Selfie** / **Atualizar Selfie**'],
    ['②', 'Área de pré-visualização da foto'],
    ['③', 'Atalho **LGPD** (se pendente)'],
    ['④', 'Resumo do membro (nome fictício TstMax)'],
  ],
};

fs.mkdirSync(outDir, { recursive: true });
for (const f of fs.readdirSync(outDir)) {
  if (f.endsWith('.png') || f.endsWith('.svg')) {
    fs.unlinkSync(path.join(outDir, f));
  }
}

await captureAppScreens(painelJobs, outDir);

fs.writeFileSync(
  path.join(root, 'docs', 'manual-painel', 'screen-legends.json'),
  JSON.stringify(legends, null, 2),
  'utf8'
);

console.log(`Capturas reais do app em ${outDir}`);
