/**
 * Gera docs/procedimento-pequeno-caixa.pdf
 * Uso: node scripts/generate-petty-cash-procedure.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { jsPDF } from 'jspdf';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outPdf = path.join(root, 'docs', 'procedimento-pequeno-caixa.pdf');

const NAVY = [0, 0, 139];
const INK = [15, 23, 42];
const MUTED = [71, 85, 105];
const RULE = [191, 219, 254];

const doc = new jsPDF({ unit: 'mm', format: 'a4' });
const pageW = 210;
const pageH = 297;
const margin = 16;
const width = pageW - margin * 2;
let y = 18;
let page = 1;

const footer = () => {
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...MUTED);
  doc.text('Conecta+  ·  Procedimento do Pequeno caixa', margin, pageH - 10);
  doc.text(String(page), pageW - margin, pageH - 10, { align: 'right' });
  doc.setDrawColor(...RULE);
  doc.setLineWidth(0.3);
  doc.line(margin, pageH - 14, pageW - margin, pageH - 14);
};

const newPage = () => {
  footer();
  doc.addPage();
  page += 1;
  y = 18;
  doc.setDrawColor(...NAVY);
  doc.setLineWidth(0.8);
  doc.line(margin, 12, pageW - margin, 12);
};

const ensure = (height) => {
  if (y + height > pageH - 18) {
    newPage();
  }
};

const writeLines = (lines, { size, style, color, indent = 0, gap = 4.2 }) => {
  doc.setFont('helvetica', style);
  doc.setFontSize(size);
  doc.setTextColor(...color);
  for (const line of lines) {
    ensure(gap + 1);
    doc.text(line, margin + indent, y);
    y += gap;
  }
};

const paragraph = (text, { size = 10.5, style = 'normal', color = INK, indent = 0, gap = 4.6 } = {}) => {
  doc.setFont('helvetica', style);
  doc.setFontSize(size);
  const lines = doc.splitTextToSize(text, width - indent);
  writeLines(lines, { size, style, color, indent, gap });
  y += 1.6;
};

const heading = (text, level) => {
  const size = level === 1 ? 14 : level === 2 ? 12 : 11;
  const before = level === 1 ? 6 : 3.5;
  ensure(before + 8);
  y += before;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(size);
  doc.setTextColor(...NAVY);
  const lines = doc.splitTextToSize(text, width);
  for (const line of lines) {
    doc.text(line, margin, y);
    y += size === 14 ? 6.2 : 5.4;
  }
  y += 1.2;
};

const bullet = (text) => {
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10.5);
  const lines = doc.splitTextToSize(text, width - 6);
  doc.setTextColor(...INK);
  ensure(lines.length * 4.6 + 1);
  doc.text('•', margin, y);
  lines.forEach((line, index) => {
    doc.text(line, margin + 5, y);
    y += 4.6;
    if (index < lines.length - 1) {
      ensure(5);
    }
  });
  y += 0.8;
};

const note = (text) => {
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  const lines = doc.splitTextToSize(text, width - 8);
  const height = lines.length * 4.4 + 6;
  ensure(height + 2);
  doc.setFillColor(239, 246, 255);
  doc.setDrawColor(...RULE);
  doc.roundedRect(margin, y - 3.2, width, height, 1.5, 1.5, 'FD');
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(...NAVY);
  lines.forEach((line) => {
    doc.text(line, margin + 4, y + 1.2);
    y += 4.4;
  });
  y += 5;
};

const step = (number, title, body) => {
  ensure(12);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(...NAVY);
  const titleLines = doc.splitTextToSize(`${number}. ${title}`, width);
  titleLines.forEach((line) => {
    doc.text(line, margin, y);
    y += 5;
  });
  paragraph(body);
};

doc.setFillColor(...NAVY);
doc.rect(0, 0, pageW, 28, 'F');
doc.setFont('helvetica', 'bold');
doc.setFontSize(16);
doc.setTextColor(255, 255, 255);
doc.text('Procedimento do Pequeno caixa', margin, 13);
doc.setFont('helvetica', 'normal');
doc.setFontSize(10);
doc.text('Quem gerencia os caixas e quem controla um caixa', margin, 21);
y = 38;
paragraph('Conecta+  ·  22 de outubro de 2026', { size: 10, color: MUTED, gap: 4.4 });
paragraph(
  'Este procedimento descreve o uso do Pequeno caixa no aplicativo. A primeira parte é de quem cria, mantém e confere os caixas. A segunda é de quem é responsável por um caixa e registra as despesas e a reposição. As regras de saldo, comprovante e prazo valem para os dois lados.'
);

heading('1. Para que serve', 1);
paragraph(
  'O pequeno caixa é um valor confiado a uma pessoa para gastos imediatos de uma ação da igreja, como cestas, lanches ou material. Cada caixa tem nome, um responsável, um valor-base e um dia de fechamento. O valor-base é o teto de reposição: é o máximo que aquele caixa volta a ter depois de prestadas as contas.'
);
paragraph(
  'O saldo que aparece na tela só muda quando a conferência aprova. Uma despesa enviada fica pendente e reserva o valor, mas ainda não baixa o saldo. Uma reposição enviada também fica pendente até a aprovação. Rejeitar não apaga o histórico: o lançamento permanece, com o motivo, para ser corrigido e enviado de novo.'
);

heading('2. Os dois papéis', 1);
paragraph('Quem gerencia os caixas', { style: 'bold', gap: 4.4 });
paragraph(
  'Entra pela engrenagem, no grupo Finanças e Inteligência, no card Pequenos Caixas. Cria o caixa, escolhe o responsável, define o valor-base e o dia de fechamento, acompanha avisos, abre o histórico, aprova ou rejeita e trata a solicitação de exclusão. Também pode inativar ou excluir o controle do caixa.'
);
paragraph('Quem controla um caixa', { style: 'bold', gap: 4.4 });
paragraph(
  'É o responsável nomeado naquele caixa. Entra em Perfil, no botão Pequeno caixa, entre Trilha de Discipulado e Reembolsos, ou pelo atalho Pequeno caixa na tela Financeiro. Registra despesa, anexa o comprovante, pede a reposição até o valor-base e solicita a exclusão de uma despesa quando for o caso. Não aprova o próprio lançamento: a aprovação é da conferência, na engrenagem.'
);
note(
  'O tesoureiro, com a permissão de controle, vê todos os caixas da igreja, ativos e inativos. Lançar despesa ou pedir reposição continua exclusivo do responsável daquele caixa, e somente enquanto o caixa está ativo. Nos outros caixas a tela fica em consulta.'
);

heading('3. Permissões', 1);
paragraph(
  'As duas permissões ficam no Controle de Acesso e são independentes. Conceder uma não concede a outra.'
);
bullet(
  'Pequenos caixas (manutenção). Quem pode ver entra no card da engrenagem. Quem pode alterar cria, edita, inativa, exclui o caixa e confere despesas e reposições. Super administrador e tesoureiro já recebem ver e alterar.'
);
bullet(
  'Controle do pequeno caixa. Abre a tela Pequeno caixa. Super administrador e tesoureiro já recebem essa permissão. Para as demais pessoas, o Controle de Acesso marca quem pode controlar.'
);
bullet(
  'Ser o responsável do caixa é uma condição à parte. Sem a permissão de controle, o botão não abre. Com a permissão, mas sem ser o responsável daquele caixa ativo, a pessoa consulta e não lança.'
);
paragraph(
  'A busca de responsável lista somente membros ativos: sem data de desligamento, sem perfil só de visitante e sem congregado isolado. O gestor de controle de acesso não vê o super administrador nessa lista.'
);

heading('4. Regras comuns', 1);
bullet('O saldo muda somente na aprovação. Despesa aprovada reduz o saldo. Reposição aprovada devolve o saldo ao valor-base.');
bullet('Despesa pendente reserva o saldo disponível. A soma das despesas ainda não conferidas, mais a nova, não pode passar do saldo.');
bullet('Enquanto existe uma reposição pendente, nenhum lançamento novo entra, e uma despesa pendente não é aprovada.');
bullet('A reposição só pode ser pedida depois que as despesas pendentes forem conferidas. O valor é exatamente o valor-base menos o saldo atual. Não se digita outro valor.');
bullet('Toda despesa e toda reposição exigem imagem do comprovante: JPEG, PNG ou WebP, até 5 MB. A reposição só é aceita e só é aprovada se essa imagem estiver gravada.');
bullet('A descrição da despesa precisa ter pelo menos 3 caracteres. O aplicativo grava o texto com o prefixo PC - . Quem lança não precisa digitar esse prefixo.');
bullet('A data do lançamento é até o dia de hoje, no formato DD/MM/AAAA.');
bullet(
  'O dia de fechamento vai de 1 a 31. O padrão do formulário é 25. Se o dia não existir naquele mês, vale o último dia. Se a data cair em sábado, domingo ou feriado, a prestação passa para o próximo dia útil.'
);
bullet(
  'Feriados considerados: 1º de janeiro, 21 de abril, 1º de maio, 7 de setembro, 12 de outubro, 2 de novembro, 15 de novembro, 25 de dezembro, segunda e terça de carnaval, sexta-feira santa e Corpus Christi.'
);
bullet('O nome do caixa é único na igreja e tem pelo menos 2 caracteres. O valor-base é maior que zero e no máximo 1.000.000. Na criação, o saldo inicial é igual ao valor-base.');
bullet('Ao alterar um caixa, o valor-base não pode ficar abaixo do saldo atual.');
bullet('Antes de anexar o comprovante, a igreja da sessão precisa estar selecionada.');

heading('5. Quem gerencia os caixas', 1);
paragraph(
  'Caminho: engrenagem, Finanças e Inteligência, Pequenos Caixas. O ícone de informação no título resume o uso da tela. Os avisos de prazo e de reenvio aparecem no topo, antes da lista.'
);

heading('5.1 Criar um caixa', 2);
step('1', 'Abra Novo caixa', 'O formulário só aparece para quem tem permissão de alterar.');
step('2', 'Informe o nome', 'Use um nome que identifique a ação, por exemplo Cestas básicas. Dois caixas da mesma igreja não podem ter o mesmo nome.');
step('3', 'Informe o valor-base', 'É o teto da reposição. O campo sugere 1000. O saldo nasce igual a esse valor.');
step('4', 'Informe o dia de fechamento', 'Um número de 1 a 31. O campo sugere 25. Esse é o dia em que a prestação daquele mês deve estar feita, já considerado o ajuste para dia útil.');
step('5', 'Escolha o responsável', 'Toque em Responsável e use Buscar responsável. A lista abre no topo da tela. Só entram membros ativos.');
step('6', 'Deixe Ativo', 'Caixa inativo não recebe lançamento. Use Inativo só quando a ação estiver parada.');
step('7', 'Toque em Salvar caixa', 'O aviso Pequeno caixa salvo confirma. O cartão entra na lista, ordenado pela situação e pelo nome.');

heading('5.2 Alterar, inativar ou excluir', 2);
paragraph(
  'Em cada cartão, Editar preenche o formulário com o nome, o responsável, a situação, o valor-base e o dia de fechamento. Ajuste o que mudou e salve. Cancelar edição descarta o formulário sem gravar. Para parar os lançamentos sem apagar o histórico, marque Inativo e salve. O responsável deixa de ver esse caixa na própria tela; o tesoureiro continua vendo, em consulta.'
);
paragraph(
  'Excluir caixa pede confirmação. A exclusão tira o controle, os lançamentos e os comprovantes. Não há como desfazer. Use quando o caixa deixou de existir. Para só interromper o uso, prefira inativar.'
);

heading('5.3 Ler o cartão', 2);
paragraph(
  'Sem abrir o histórico, o cartão mostra o responsável, o valor-base, o dia de fechamento, o saldo, se está ativo ou inativo, se a prestação está em atraso, quantas despesas estão pendentes e quantas exclusões foram solicitadas.'
);
paragraph(
  'Toque no cartão para abrir o demonstrativo. Toque de novo para fechar. O demonstrativo traz:'
);
bullet('Saldo inicial: o valor-base do caixa.');
bullet('Despesas comprovadas: a soma das despesas aprovadas depois da última reposição aprovada. É o ciclo atual.');
bullet('Saldo remanescente: o saldo atual.');
bullet('Recomposição: valor-base menos saldo atual. É o valor que a próxima reposição vai pedir.');
bullet('Prestação até: a data do fechamento já ajustada para dia útil.');
paragraph(
  'No histórico de cada lançamento aparecem o tipo (Despesa ou Reposição), o valor, a situação (Pendente, Aprovado ou Rejeitado), a data, a descrição e o link Ver comprovante. Se houve rejeição, o motivo fica junto do lançamento.'
);

heading('5.4 Avisos', 2);
bullet(
  'Fundo âmbar: a prestação vence hoje ou em até 5 dias, e o caixa ativo está abaixo do valor-base, tem pendência ou tem lançamento rejeitado sem correção.'
);
bullet(
  'Fundo vermelho: prestação em atraso. O caixa está ativo, o saldo está abaixo do valor-base e a despesa aprovada mais antiga do ciclo já passou da data de fechamento.'
);
bullet(
  'Fundo índigo: há lançamento rejeitado e ainda não existe, depois dele, outro do mesmo tipo pendente ou aprovado. O texto pede para corrigir e enviar de novo.'
);

heading('5.5 Conferir despesa e reposição', 2);
paragraph(
  'Abra o cartão. Em cada lançamento pendente há o campo Motivo, se for rejeitar, e os comandos Aprovar e Rejeitar. A conferência exige permissão de alterar.'
);
step(
  '1',
  'Abra o comprovante',
  'Toque em Ver comprovante e confira se a imagem, o valor, a data e a descrição combinam com o gasto ou com a reposição.'
);
step(
  '2',
  'Aprovar',
  'Confirme em Aprovar movimentação. Despesa aprovada reduz o saldo. Reposição aprovada só conclui se a imagem estiver salva e devolve o saldo exatamente ao valor-base. Se o saldo mudou desde o pedido, a tela recusa: rejeite essa reposição e peça que o responsável registre outra.'
);
step(
  '3',
  'Rejeitar',
  'Escreva o motivo com pelo menos 3 caracteres e confirme. O lançamento permanece no histórico com o motivo. O responsável vê o motivo na tela dele, corrige e envia de novo. Sem o motivo, a rejeição não segue.'
);
note(
  'Não aprove uma despesa nova enquanto houver reposição pendente: decida a reposição antes. Não aprove a reposição enquanto houver despesa pendente. A ordem é conferir as despesas e só então a reposição do ciclo.'
);

heading('5.6 Solicitação de exclusão', 2);
paragraph(
  'Quando o responsável pede a exclusão de uma despesa, o cartão mostra na hora um painel amarelo, Solicitação de exclusão, sem precisar abrir o histórico. O painel traz a descrição, o valor e a data, e os campos Valor, Descrição e Data.'
);
paragraph(
  'Quem pode concluir é quem tem permissão de alterar os pequenos caixas, ou o próprio responsável do caixa. O caminho é: conferir os dados, ajustar se precisar, tocar em Salvar edição e, em seguida, em Excluir lançamento. A confirmação avisa que a despesa sai do histórico e o comprovante é apagado.'
);
bullet('Se a despesa ainda estava pendente, ela sai e a reserva do saldo acaba.');
bullet('Se já estava aprovada, o valor volta ao saldo, sem ultrapassar o valor-base.');
bullet('Se já entrou numa reposição conferida, a despesa permanece no histórico. A exclusão é recusada.');
bullet('Se há uma reposição aguardando conferência, decida essa reposição antes de excluir ou de editar a despesa.');
paragraph(
  'Salvar edição, sem excluir, corrige valor, descrição e data da despesa solicitada. O novo valor precisa caber no saldo. Na despesa já aprovada, a diferença ajusta o saldo na hora.'
);

heading('5.7 Comprovante no lançamento financeiro', 2);
paragraph(
  'Na manutenção financeira, ao montar um lançamento, o botão Pequeno caixa lista comprovantes já gravados nos caixas. Busque pelo nome e anexe o arquivo ao lançamento. O comprovante do pequeno caixa continua no caixa; o lançamento financeiro passa a usar a mesma imagem.'
);

heading('6. Quem controla o caixa', 1);
paragraph(
  'Esta parte é do responsável. A tela se chama Pequeno caixa. Se não houver caixa ativo atribuído à pessoa, a mensagem é: Nenhum pequeno caixa ativo está atribuído a você. A manutenção escolhe o responsável na engrenagem.'
);

heading('6.1 Entrar', 2);
bullet('Perfil, botão Pequeno caixa. Ele fica entre Trilha de Discipulado e Reembolsos, e só aparece para quem tem a permissão de controle.');
bullet('Financeiro, atalho Pequeno caixa, no alto da tela, para quem tem a mesma permissão.');
paragraph(
  'Ao sair, o aplicativo volta para a tela de onde a pessoa veio. Tesoureiro que abre a tela vê todos os caixas. Responsável comum vê só os caixas ativos em que o nome dele está como responsável.'
);

heading('6.2 Escolher o caixa e ler a posição', 2);
paragraph(
  'Se houver mais de um caixa, os nomes aparecem em botões no topo. Toque no caixa que vai lançar. O cartão mostra o responsável, os avisos coloridos, o valor-base, o dia de fechamento, o saldo inicial, as despesas comprovadas, o saldo remanescente, a recomposição e a data da prestação. Prestação em atraso fica marcada ao lado da data.'
);
paragraph(
  'Quem está só consultando, como o tesoureiro em um caixa de outra pessoa, vê o texto: Consulta de todos os caixas. O lançamento de despesa e reposição continua com o responsável de cada caixa. O formulário de lançamento não aparece.'
);

heading('6.3 Registrar uma despesa', 2);
paragraph('O formulário Nova despesa só aparece para o responsável do caixa ativo.');
step('1', 'Informe o valor', 'O campo começa em R$ 0,00 e aceita reais e centavos. O valor precisa ser maior que zero e caber no saldo ainda não reservado por outras despesas pendentes.');
step('2', 'Descreva o gasto', 'Pelo menos 3 caracteres, de forma que a conferência entenda o que foi comprado. O aplicativo acrescenta PC - na frente ao gravar.');
step('3', 'Confira a data', 'O campo vem com a data de hoje, no formato DD/MM/AAAA. Pode ser uma data anterior. Data futura é recusada.');
step('4', 'Anexe o comprovante', 'Toque em Anexar comprovante para escolher a imagem, ou no ícone da câmera para fotografar. Sem imagem o registro não conclui. O botão passa a dizer Comprovante anexado.');
step('5', 'Toque em Registrar despesa', 'O aviso Despesa enviada para conferência confirma. O saldo ainda não baixa. A despesa entra no histórico como Pendente e reserva o valor até a conferência.');
paragraph(
  'Excluir despesa, ao lado de Registrar despesa, apaga só o rascunho que ainda não foi enviado: valor, descrição, data e imagem escolhida. O botão fica apagado enquanto o formulário está vazio e a data é a de hoje. Ele não apaga uma despesa que já está no histórico.'
);

heading('6.4 Pedir a reposição', 2);
paragraph(
  'A seção Reposição até o valor-base mostra o valor calculado da recomposição. Esse valor não é digitado: é o valor-base menos o saldo atual. Anexe o comprovante da reposição e toque em Pedir reposição. O aviso Reposição enviada para conferência confirma.'
);
paragraph('O botão Pedir reposição fica desligado nestes casos:');
bullet('O caixa já está no valor-base e a recomposição é zero.');
bullet('Ainda há despesa pendente. A tela pede para aguardar a conferência dessas despesas.');
bullet('Já existe uma reposição aguardando conferência. Enquanto ela não for decidida, nada de novo é lançado.');
paragraph(
  'A imagem da reposição é obrigatória. A conferência só aprova se essa imagem estiver salva. Na aprovação, o saldo volta ao valor-base. Se a conferência rejeitar, o motivo aparece no histórico.'
);

heading('6.5 Acompanhar o histórico', 2);
paragraph(
  'Cada linha traz Despesa ou Reposição, o valor, a situação, a data e a descrição. Toque em Ver comprovante para abrir a imagem. Lançamento rejeitado mostra Motivo, ou a orientação para corrigir os dados e enviar novamente.'
);
paragraph(
  'Corrigir uma rejeição é enviar um lançamento novo, certo, com comprovante. O rejeitado permanece no histórico. O aviso índigo some quando existir, depois dele, outro lançamento do mesmo tipo pendente ou aprovado.'
);

heading('6.6 Solicitar a exclusão de uma despesa', 2);
step(
  '1',
  'No histórico, toque em Solicitar exclusão',
  'O pedido vale para despesa, não para reposição. A confirmação avisa que a despesa e o comprovante permanecem até a exclusão ser concluída. O aviso Exclusão solicitada confirma. O botão não aparece de novo naquela despesa.'
);
step(
  '2',
  'Use o painel amarelo',
  'Ele abre na própria tela do responsável, com Valor, Descrição e Data. Confira. Se algo estiver errado, corrija e toque em Salvar edição. O aviso Lançamento atualizado confirma.'
);
step(
  '3',
  'Toque em Excluir lançamento',
  'A confirmação avisa que a despesa sai do histórico e o comprovante é apagado. O aviso Lançamento excluído confirma. Quem só consulta o caixa vê a frase de que a exclusão foi solicitada e que o responsável edita e então exclui.'
);
paragraph(
  'O mesmo painel aparece para quem gerencia, no cartão da engrenagem. Qualquer um dos dois lados, com a permissão correspondente, pode editar e concluir a exclusão. Não conclua se houver reposição pendente, e não espere excluir uma despesa que já entrou numa reposição já conferida.'
);

heading('7. Fechamento do mês', 1);
paragraph('A prestação de um ciclo segue esta ordem.');
step('1', 'O responsável registra cada gasto', 'Uma despesa por compra, com data, descrição e comprovante, ao longo do mês, sem esperar o dia do fechamento.');
step('2', 'Quem gerencia confere as despesas', 'Aprova o que está certo e rejeita, com motivo, o que precisa de correção. O responsável reenvia o que foi rejeitado.');
step('3', 'O responsável pede a reposição', 'Só depois que não houver despesa pendente. Anexa o comprovante do valor exato da recomposição.');
step('4', 'Quem gerencia aprova a reposição', 'O saldo volta ao valor-base. As despesas comprovadas do ciclo ficam as que forem aprovadas depois dessa reposição.');
step('5', 'Acompanhe a data', 'A prestação até indica o dia. Âmbar é aviso de até 5 dias. Vermelho é atraso: o caixa ativo gastou, a despesa mais antiga do ciclo já passou do fechamento e a reposição ainda não repôs o valor-base.');

heading('8. Quando a tela recusar', 1);
paragraph('Leia o aviso e ajuste o lançamento. As recusas mais comuns são estas.');
bullet('Informe o nome do caixa. O nome está vazio ou tem menos de 2 caracteres.');
bullet('Já existe um pequeno caixa com esse nome. Escolha outro nome nesta igreja.');
bullet('Escolha o responsável pelo caixa. A lista só tem membros ativos.');
bullet('O valor-base não pode ficar abaixo do saldo atual. Aumente a base ou espere o saldo baixar com despesas aprovadas.');
bullet('Você não tem permissão para criar ou alterar pequenos caixas, ou para conferir. Peça a permissão de manutenção no Controle de Acesso.');
bullet('Você não tem permissão para controlar um pequeno caixa. Peça a permissão de controle.');
bullet('Somente o responsável deste caixa pode registrar movimentações. A pessoa logada não é o responsável, ou está em modo de consulta.');
bullet('Este caixa está inativo. Quem gerencia precisa reativar antes de novos lançamentos.');
bullet('Anexe a imagem do comprovante para concluir o registro. Despesa e reposição exigem a imagem.');
bullet('O valor passa do saldo disponível deste caixa. Há saldo reservado por despesas pendentes, ou o gasto é maior que o saldo.');
bullet('Há uma reposição aguardando conferência. Espere a decisão antes de lançar, editar ou excluir.');
bullet('Confira as despesas pendentes antes de pedir a reposição. Aprove ou rejeite essas despesas primeiro.');
bullet('O caixa já está no valor-base. Não há valor a repor.');
bullet('A reposição só pode ser aprovada com a imagem do comprovante salva. Abra Ver comprovante. Se a imagem não abrir, rejeite e peça um novo envio.');
bullet('O saldo mudou desde o pedido. Rejeite esta reposição e registre outra, já com o valor novo.');
bullet('Informe o motivo da rejeição para o responsável corrigir e reenviar. O motivo precisa ter pelo menos 3 caracteres.');
bullet('Esta despesa já entrou numa reposição conferida e permanece no histórico. A exclusão não se aplica a esse ciclo fechado.');
bullet('Selecione a igreja novamente para anexar o comprovante. A sessão perdeu a igreja ativa.');

heading('9. O que cada lado não faz', 1);
bullet('Quem controla não aprova e não rejeita o próprio lançamento. Isso é da conferência, na engrenagem.');
bullet('Quem controla não apaga na hora uma despesa do histórico. Ele solicita a exclusão. A conclusão é no painel amarelo, pelo responsável ou por quem gerencia.');
bullet('Quem gerencia não lança a despesa no lugar do responsável, a menos que também seja o responsável daquele caixa ativo e tenha a permissão de controle.');
bullet('Excluir despesa no formulário não mexe no histórico. Solicitar exclusão não apaga o comprovante até Excluir lançamento.');
bullet('Inativar não apaga lançamentos. Excluir caixa apaga o controle, os lançamentos e os comprovantes.');

paragraph(
  'Documento gerado a partir das telas Pequenos Caixas, Pequeno caixa e do lançamento financeiro do Conecta+.',
  { size: 9, color: MUTED, gap: 4 }
);

footer();
fs.mkdirSync(path.dirname(outPdf), { recursive: true });
fs.writeFileSync(outPdf, Buffer.from(doc.output('arraybuffer')));
console.log(`${outPdf} (${page} páginas)`);
