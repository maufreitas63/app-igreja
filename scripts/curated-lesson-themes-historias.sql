-- Temas do eixo historias enviados no seed (90 linhas). Reexecutar substitui só esta categoria.
-- Aplica: npx supabase db query --linked -f scripts/curated-lesson-themes-historias.sql

delete from public.curated_lesson_themes
 where category = 'historias';

insert into public.curated_lesson_themes (category, title, bible_passage, core_lesson, activity_suggestion) values
('historias', 'A Criação do Mundo: Tudo Feito com Perfeição', 'Gênesis 1:1', 'Deus criou o céu, a terra e todas as coisas com ordem, beleza e muito amor em seis dias.', 'Linha do Tempo da Criação: Desenhar em 6 etapas o que Deus fez em cada dia e expor na sala.'),
('historias', 'Adão e Eva no Jardim: A Escolha e as Consequências', 'Gênesis 3:6', 'Devemos obedecer às orientações de Deus, pois Suas regras protegem o nosso coração do mal.', 'O Caminho Certo: Um pequeno labirinto no papel onde a criança escolhe a obediência para vencer o jogo.'),
('historias', 'Noé e a Arca: A Obediência que Salva', 'Gênesis 6:22', 'Noé confiou em Deus e construiu a arca mesmo quando ninguém entendia, salvando sua família.', 'Construindo a Arca: Montar uma barquinha simples de papel dobrado (origami) para guardar na Bíblia.'),
('historias', 'A Torre de Babel: A Confusão do Orgulho', 'Gênesis 11:4', 'O orgulho nos afasta de Deus, mas a humildade nos une e agrada o coração do Pai.', 'Torre de Blocos e Desmonte: Construir uma torre alta e conversar sobre as motivações corretas do coração.'),
('historias', 'O Chamado de Abraão: Deixando o Conforto', 'Gênesis 12:1', 'Deus chamou Abraão para uma grande jornada de fé, e ele obedeceu saindo para a terra prometida.', 'A Mochila do Viajante: Brincar de listar o que levamos quando confiamos em Deus para uma nova aventura.'),
('historias', 'Isaque e a Rebeca: A Resposta à Oração', 'Gênesis 24:14', 'Deus ouve as nossas orações detalhadas e guia cada passo da nossa vida com fidelidade.', 'O Poço da Oração: Desenhar um poço antigo e colocar pedacinhos de papel com pedidos e respostas de oração.'),
('historias', 'Jacó e Esaú: O Perdão entre Irmãos', 'Gênesis 33:4', 'O perdão e o abraço sincero têm o poder de curar o passado e restaurar famílias divididas.', 'O Abraço de Reconciliação: Praticar um abraço caloroso em duplas, celebrando a paz entre irmãos.'),
('historias', 'José do Egito: Da Cisterna ao Palácio', 'Gênesis 50:20', 'O que o mal tentou usar para destruir, Deus transformou em bem para salvar muitas vidas.', 'O Sonho Colorido: Desenhar um casaco de muitas cores e conversar sobre como Deus cuida de nós nos momentos difíceis.'),
('historias', 'O Bebê Moisés no Nilo: Protegido por Deus', 'Êxodo 2:3', 'Mesmo nas maiores tempestades e perigos, Deus guarda Seus filhos com carinho nos mínimos detalhes.', 'O Cesto nas Águas: Dobrar uma folha de papel em formato de barquinho protetor navegando.'),
('historias', 'A Sarça Ardente: O Chamado de Moisés', 'Êxodo 3:4', 'Deus chama pessoas comuns para realizar grandes feitos quando estão dispostas a ouvi-Lo.', 'A Fogueira de Papel: Colocar papéis celofane vermelho e amarelo simulando uma sarça que brilha sem queimar.'),
('historias', 'As Pragas do Egito: O Poder do Deus Vivo', 'Êxodo 9:16', 'Não há nenhum poder na terra maior do que o Deus a quem servimos e adoramos.', 'O Jogo das Placas: Identificar em cartazes as maravilhas e o poder de Deus na história de Êxodo.'),
('historias', 'A Travessia do Mar Vermelho: O Caminho no Meio das Águas', 'Êxodo 14:21', 'Quando parece não haver saída, Deus abre um caminho novo onde os nossos olhos não veem solução.', 'Abrindo o Mar: Cortar um papel azul ao meio e puxá-lo para os lados, simulando a abertura das águas.'),
('historias', 'O Maná no Deserto: O Pão que Vem do Céu', 'Êxodo 16:4', 'Deus supre todas as nossas necessidades diárias no tempo certo e com generosidade.', 'O Pãozinho Compartilhado: Dividir um pedaço de pão ou biscoito em roda, lembrando o sustento diário.'),
('historias', 'Os Dez Mandamentos: Regras de Amor', 'Êxodo 20:3', 'As leis de Deus não são prisões, mas um manual de amor para proteger a nossa vida e a nossa alegria.', 'As Tábuas da Lei: Recortar cartolina em formato de tábuas de pedra e escrever versículos de amor.'),
('historias', 'Josué e Jericó: A Queda das Muralhas pela Fé', 'Josué 6:20', 'A obediência aos comandos de Deus, unida ao louvor, derruba qualquer muralha difícil.', 'Marcha de Louvor: marchar em círculo pela sala dando um grito de alegria ao sinal do professor.'),
('historias', 'Gideão e os Trezentos Guerreiros: Força na Fraqueza', 'Juízes 7:7', 'Deus não precisa de grandes exércitos para vencer, mas de corações dispostos e confiantes Nele.', 'Tochas de Papel: Confeccionar pequenas tochas de papel crepom brilhante simbolizando a luz da vitória.'),
('historias', 'Sansão e a Força da Aliança', 'Juízes 16:28', 'Nossa verdadeira força vem de mantermos nossa comunhão e aliança firme com o Senhor.', 'O Labirinto da Força: Ajudar o personagem a encontrar o caminho da fidelidade no papel.'),
('historias', 'Rute e Noemi: Lealdade e Amor em Família', 'Rute 1:16', 'O verdadeiro amor é leal, permanece nos momentos de tristeza e não abandona quem precisa.', 'A Pulseira da Amizade Leal: Trançar fios de lã coloridos para presentear um colega.'),
('historias', 'O Nascimento de Samuel: A Oração Atendida', '1 Samuel 1:27', 'Ana orou com fervor e Deus atendeu ao seu pedido, devolvendo a alegria ao seu coração.', 'O Mural de Respostas: Escrever orações atendidas em post-its coloridos e colar no mural.'),
('historias', 'O Menino Samuel Ouve a Voz de Deus', '1 Samuel 3:10', 'Deus continua chamando nossos nomes e deseja ter uma conversa íntima e diária conosco.', 'O Chamado no Escuro: Um aluno de costas ouve seu nome ser chamado com carinho e adivinha quem foi.'),
('historias', 'Davi e Golias: A Batalha do Pequeno Valente', '1 Samuel 17:45', 'Não importa quão grande seja o gigante diante de nós; o nosso Deus é muito maior e nos dá a vitória.', 'O Estilingue de Mentirinha: Simular com cuidado o lançamento de pedrinhas de papel em um alvo desenhado.'),
('historias', 'Davi e Jônatas: Uma Amizade Verdadeira', '1 Samuel 18:3', 'Amigos de verdade protegem, ajudam e torcem pelo sucesso um do outro no caminho de Deus.', 'O Abraço Fraterno: Trocar palavras de encorajamento e um abraço forte com o colega ao lado.'),
('historias', 'Salomão Pede Sabedoria a Deus', '1 Reis 3:9', 'Em vez de pedir riquezas ou fama, Salomão pediu um coração sábio para governar com justiça.', 'A Coroa da Sabedoria: Confeccionar coroas de papel com a palavra "Sabedoria" escrita na frente.'),
('historias', 'Elias e os Corvos: O Sustento no riacho', '1 Reis 17:6', 'Deus usa até mesmo os animais improváveis para cuidar dos Seus servos nos dias difíceis.', 'Desenho dos Corvos: Pintar passarinhos voando com alimento no bico, ilustrando o cuidado criativo de Deus.'),
('historias', 'A Viúva de Sarepta: A Farinha que Não Acabava', '1 Reis 17:16', 'Quando repartimos o pouco que temos com fé, Deus multiplica o milagre em nossa casa.', 'O Pote de Farinha Milagroso: Encher um potinho com grãos e conversar sobre partilha e fé.'),
('historias', 'Elias no Monte Carmelo: O Fogo do Céu', '1 Reis 18:38', 'O Senhor é o Deus verdadeiro! Quando clamamos com sinceridade, Ele responde com poder.', 'Fogo de Papel Crepom: Erguer tiras coloridas de papel simulando a descida do fogo do céu.'),
('historias', 'Elisha e azeite da viúva: Milagre nos Vasinhos', '2 Reis 4:4', 'Deus usa o que temos em casa para encher nossas vidas de provisão quando seguimos Sua direção.', 'Enchendo os Vasos: Simular despejar azeite imaginário em copinhos de plástico vazios.'),
('historias', 'Naamã e a Cura no Rio Jordão', '2 Reis 5:14', 'A obediência simples às instruções de Deus traz cura e transformação completa para a nossa vida.', 'Mergulho Simulado: Movimentar os braços como quem mergulha em águas limpas para renovar as forças.'),
('historias', 'O Menino Joás e a Reforma do Templo', '2 Reis 12:9', 'Crianças e jovens também podem participar ativamente cuidando da casa de Deus e fazendo o bem.', 'O Cofrinho da Reforma: Montar um cofrinho de papel para guardar ofertas ou lembretes de ofertas de amor.'),
('historias', 'Ester: Uma Rainha Corajosa', 'Ester 4:14', 'Deus colocou cada um de nós em nosso lugar exato "para um tempo como este", para fazer a diferença.', 'A Coroa da Coragem: Desenhar uma coroa e escrever nela uma atitude corajosa que teremos esta semana.'),
('historias', 'Jó: A Confiança Inabalável em Deus', 'Jó 1:21', 'Mesmo quando tudo ao nosso redor parece desabar, podemos confiar que o nosso Redentor vive.', 'O Abraço da Paciência: Fechar os olhos e lembrar que Deus está no controle de todas as coisas.'),
('historias', 'Os Amigos na Fornalha de Fogo', 'Daniel 3:17', 'Deus pode nos livrar do perigo, mas mesmo se não o fizer, não mudaremos nossa fidelidade a Ele.', 'O Escudo contra o Fogo: Confeccionar escudos de papelão representando a proteção inabalável de Deus.'),
('historias', 'Daniel na Cova dos Leões', 'Daniel 6:22', 'Deus envia os Seus anjos para fechar a boca dos leões e nos proteger nos momentos de medo.', 'A Máscara do Leão Amigo: Fazer caretas engraçadas de leões cujas bocas estão fechadas pelo anjo.'),
('historias', 'Jonas e o Grande Peixe', 'Jonas 1:17', 'Não adianta fugir do plano de amor de Deus; a Sua misericórdia sempre nos alcança para um recomeço.', 'O Barquinho no Oceano: Soprar barquinhos de papel em uma bacia com água, lembrando o recomeço de Jonas.'),
('historias', 'A História de Rute: O Resgate do Redentor', 'Rute 4:14', 'Deus transforma histórias de tristeza e vazio em histórias cheias de esperança, família e futuro.', 'A Corrente de Família: Dar as mãos em roda para celebrar a união e a provisão de Deus.'),
('historias', 'Neemias reconstrói os Muros', 'Neemias 6:15', 'Com esforço, oração e união, conseguimos reconstruir o que estava quebrado ao nosso redor.', 'Construindo o Muro: Empilhar blocos de montar coloridos para erguer um muro firme e seguro.'),
('historias', 'O Menino Samuel e a Lâmpada Acesa', '1 Samuel 3:3', 'Manter a lâmpada da fé acesa em nosso coração requer atenção diária à voz de Deus.', 'A Lanterna Acesa: Acender uma lanterna na sala escura para simbolizar a Palavra que ilumina.'),
('historias', 'O Salmo 23: O Senhor é o Meu Pastor', 'Salmos 23:1', 'Sabemos que temos um Pastor amoroso que nos guia a verdes pastos e cuida de nós em todo tempo.', 'A Ovelhinha de Algodão: Colar bolinhas de algodão em um desenho de ovelha para lembrar do Pastor.'),
('historias', 'A Sabedoria de Débora', 'Juízes 4:4', 'Deus levanta líderes sábios e corajosos para trazer paz e direção ao Seu povo em tempos difíceis.', 'A Cadeira da Decisão: Tomar decisões justas e bondosas em um jogo de escolhas para a turma.'),
('historias', 'A Oferta da Viúva Pobre', 'Lucas 21:3', 'Para Deus, o que importa não é a quantidade que damos, mas a generosidade e o amor do coração.', 'Moedas de Papel: Desenhar moedinhas com corações para entender o valor da oferta sincera.'),
('historias', 'O Nascimento de Jesus: A Grande Luz', 'Lucas 2:7', 'Jesus nasceu em uma estrebaria simples para trazer a luz e a salvação a todo o mundo.', 'A Estrela do Natal: Recortar estrelas brilhantes para lembrar o nascimento do Salvador.'),
('historias', 'Os Magos do Oriente: Adorando ao Rei', 'Mateus 2:11', 'Os sábios viajaram longas distâncias para levar presentes e adorar ao Rei Jesus com alegria.', 'A Caminha dos Reis: Simular passos de viagem guiados por uma estrela brilhante no teto.'),
('historias', 'Jesus no Templo aos Doze Anos', 'Lucas 2:46', 'Desde cedo, Jesus tinha paixão por aprender e estar nos assuntos da casa do Pai celestial.', 'O Livro Aberto: Manusear a Bíblia com carinho e curiosidade para aprender mais de Deus.'),
('historias', 'O Batismo de Jesus: A Voz do Céu', 'Mateus 3:17', 'O céu se abriu e Deus declarou com amor: "Este é o meu Filho amado em quem me comprazo".', 'Água Cristalina: Borrifar gotinhas de água limpa no ar (com cuidado) celebrando o batismo e a alegria.'),
('historias', 'A Tentação no Deserto: Vencendo com a Palavra', 'Mateus 4:4', 'Jesus venceu o mal usando a espada do Espírito, que é a Palavra de Deus escrita.', 'Caça aos Versículos: Encontrar pequenos cartões com passagens bíblicas escondidas na sala.'),
('historias', 'O Primeiro Milagre nas Bodas de Caná', 'João 2:11', 'Jesus transforma a nossa água em vinho de alegria, fazendo festas e abençoando as famílias.', 'O Copo de Suco Festivo: Brindar com um gole de suco em festa, celebrando a alegria que Jesus traz.'),
('historias', 'A Pesca Maravilhosa', 'Lucas 5:6', 'Quando seguimos a palavra de Jesus e lançamos as redes, experimentamos milagres surpreendentes.', 'Rede de Pescador: Passar um barbante em formato de rede entre as crianças para recolher peixinhos de papel.'),
('historias', 'Jesus e a Mulher Samaritana', 'João 4:14', 'Jesus oferece a água viva que sacia a sede da alma para todo aquele que crê Nele.', 'Copo d’Água Fresca: Beber água fresca conversando sobre o amor de Jesus que nunca acaba.'),
('historias', 'A Cura do Paralítico no Telhado', 'Marcos 2:4', 'Amigos de verdade fazem de tudo para levar quem precisa até os braços curadores de Jesus.', 'Carregando a Maca: Duas crianças dão as mãos para transportar um colega com cuidado pelo espaço.'),
('historias', 'A Tempestade Acalmada no Barco', 'Marcos 4:39', 'Mesmo quando o vento e as ondas sopram forte, Jesus tem todo o poder para trazer paz à nossa vida.', 'Barquinho na Bacia: Soprar barquinhos de papel em uma bacia d’água imitando o vento e a calmaria.'),
('historias', 'A Multiplicação dos Pães e Peixes', 'João 6:11', 'Quando colocamos o pouco que temos nas mãos de Jesus, Ele multiplica para abençoar a todos.', 'Cesta de Pães: Distribuir pedacinhos de pão para os colegas, celebrando a partilha e o milagre.'),
('historias', 'Jesus Anda sobre as Águas', 'Mateus 14:27', 'Não devemos olhar para o tamanho do medo ou das ondas, mas fixar os olhos em Jesus que nos sustenta.', 'Olhos Fixos: Olhar fixamente para um ponto brilhante na sala sem se distrair com barulhos.'),
('historias', 'O Bom Samaritano', 'Lucas 10:37', 'O nosso próximo é qualquer pessoa que precisa do nosso amor, cuidado e ajuda prática no dia a dia.', 'O Curativo do Amor: Colocar um band-aid de mentirinha no braço, lembrando de ajudar quem sofre.'),
('historias', 'Maria e Marta: A Escolha da Melhor Parte', 'Lucas 10:42', 'Parar para sentar aos pés de Jesus e ouvi-Lo é a coisa mais importante e preciosa que podemos fazer.', 'Sentados aos Pés: Sentar em silêncio no chão bem pertinho do professor para ouvir uma história.'),
('historias', 'A Ovelha Perdida', 'Lucas 15:4', 'O Bom Pastor deixa as noventa e nove ovelhas para ir atrás daquela que se perdeu, porque ela importa muito.', 'O Chocalho da Ovelhinha: Balançar um chocalho leve enquanto um colega procura a ovelhinha escondida.'),
('historias', 'O Filho Pródigo e o Pai Amoroso', 'Lucas 15:20', 'O Pai celestial nos recebe de braços abertos, com festa e perdão, sempre que voltamos para casa.', 'O Abraço de Boas-Vindas: Abraçar o colega com alegria, celebrando o perdão e o amor do Pai.'),
('historias', 'O Zaqueu na Árvore', 'Lucas 19:4', 'Jesus conhece o nosso nome, vai até a nossa casa e transforma o nosso coração para o bem.', 'Subindo na Cadeira (Com Cuidado): Subir em um banquinho firme para imitar Zaqueu procurando ver Jesus.'),
('historias', 'A Viúva e a Moedinha', 'Lucas 21:2', 'Deus vê a intenção secreta do nosso coração e se alegra com a nossa entrega sincera e amorosa.', 'Moedinhas de Brinquedo: Guardar moedas de papel em um cofrinho simbólico de ofertas.'),
('historias', 'A Cura do Cego de Nascença', 'João 9:25', 'Jesus abre os nossos olhos espirituais para enxergarmos as maravilhas do Seu amor e da Sua verdade.', 'Os Óculos de Investigação: Fazer binóculos de papel para procurar coisas boas na sala de aula.'),
('historias', 'A Ressurreição de Lázaro', 'João 11:43', 'Jesus tem poder sobre a morte e a tristeza; Ele nos chama para a vida com uma voz de amor.', 'Chamando pelo Nome: Dizer o nome do colega em tom alegre e festivo, celebrando a vida.'),
('historias', 'A Entrada Triunfal em Jerusalém', 'João 12:13', 'Hosana ao Filho de Davi! Cantamos louvores e agitamos ramos celebrando o nosso Rei Jesus.', 'Folhas de Palmeira: Agitar folhinhas de papel verde cantando um hino alegre ao Rei.'),
('historias', 'A Última Ceia: Partindo o Pão', 'Lucas 22:19', 'Jesus nos deixou a ceia como memória eterna do Seu sacrifício de amor por cada um de nós.', 'Partindo o Pão Simbólico: Dividir biscoitos em roda lembrando o corpo de Cristo.'),
('historias', 'Jesus Lava os Pés dos Discípulos', 'João 13:14', 'O maior no Reino de Deus é aquele que serve os outros com humildade, amor e simplicidade.', 'Lavando as Mãos: Simular lavar as mãos com carinho para servir o colega na sala.'),
('historias', 'A Crucificação: O Maior Amor do Mundo', 'João 19:30', 'Jesus entregou Sua vida na cruz por amor a nós, pagando a dívida dos nossos erros para nos salvar.', 'Coração de Cruz: Desenhar uma cruz enfeitada com flores, lembrando o sacrifício de amor.'),
('historias', 'A Ressurreição: Ele Vive!', 'Lucas 24:6', 'Ele não está aqui, pois ressuscitou! A sepultura está vazia e temos vida eterna em Jesus.', 'O Túmulo Vazio: Abrir uma caixinha de papel vazia, celebrando que Jesus vive para sempre.'),
('historias', 'O Caminho para Emaús', 'Lucas 24:32', 'O coração dos discípulos ardia no peito enquanto Jesus lhes explicava as Escrituras no caminho.', 'Caminhada com Jesus: Caminhar em círculos na sala conversando sobre passagens bíblicas favoritas.'),
('historias', 'A Ascensão de Jesus ao Céu', 'Atos 1:9', 'Jesus subiu aos céus, mas prometeu enviar o Consolador, o Espírito Santo, para habitar conosco.', 'Olhando para o Céu: Olhar para o alto com alegria, lembrando que Jesus voltará para nos buscar.'),
('historias', 'O Pentecoste: O Fogo do Espírito Santo', 'Atos 2:4', 'O Espírito Santo foi derramado com línguas de fogo e vento impetuoso, enchendo os discípulos de poder.', 'Linguinhas de Fogo: Colocar tiaras de papel com chamas coloridas para celebrar o Pentecoste.'),
('historias', 'A Cura do Coxo na Porta Formosa', 'Atos 3:6', 'Não tenho prata nem ouro, mas o que tenho eu te dou: em nome de Jesus Cristo, levanta-te e anda!', 'O Aperto de Mãos que Levanta: Dar as mãos para ajudar o colega a levantar com alegria.'),
('historias', 'Estêvão: O Primeiro Mártir Fiel', 'Atos 7:60', 'Mesmo em meio à perseguição, Estêvão perdoou seus inimigos com um rosto brilhante como de um anjo.', 'O Rosto Brilhante: Desenhar sorrisos luminosos em crachás para lembrar da paz em Cristo.'),
('historias', 'A Conversão de Saulo na Estrada', 'Atos 9:4', 'Jesus transformou a vida de Saulo, que perseguia a igreja, no apóstolo Paulo, um grande mensageiro da cruz.', 'A Luz no Caminho: Acender uma lanterna para mostrar a luz que mudou a vida de Saulo.'),
('historias', 'Pedro na Prisão e a Oração da Igreja', 'Atos 12:5', 'Enquanto Pedro estava preso, a igreja fazia oração incessante a Deus, e um anjo o libertou.', 'A Corrente de Oração: Dar as mãos em roda para orar uns pelos outros com fervor.'),
('historias', 'Paulo e Silas na Prisão Cantando', 'Atos 16:25', 'Mesmo com os pés no tronco e na prisão, Paulo e Silas cantavam hinos de louvor a Deus à meia-noite.', 'Louvor na Escuridão: Cantar um refrão alegre com as luzes da sala apagadas.'),
('historias', 'Lídia e sua Família Batizadas', 'Atos 16:14', 'O Senhor abriu o coração de Lídia para atentar às coisas que Paulo dizia, crendo no Evangelho.', 'Coração Aberto: Desenhar corações de papel vermelho onde se anota a alegria de crer em Jesus.'),
('historias', 'Priscila e Áqüila: Parceiros no Evangelho', 'Atos 18:26', 'Este casal abriu sua casa e ensinou com paciência a palavra de Deus a Apolo com muito amor.', 'A Tenda da Amizade: Montar uma cabaninha de lençóis simbolizando o lar que acolhe.'),
('historias', 'O Menino Eutico que Caiu da Janela', 'Atos 20:9', 'Deus tem cuidado de nós em todos os momentos, renovando nossas forças e nossa atenção.', 'O Ouvido Atento: Fazer um jogo de escuta silenciosa para treinar a atenção na Palavra.'),
('historias', 'Paulo no Navio e o Naufrágio', 'Atos 27:44', 'Mesmo na tempestade e no mar bravo, a promessa de Deus se cumpriu e todos se salvaram em terra.', 'Barquinhos Seguros: Soprar barquinhos de papel em uma bacia, lembrando o cuidado nos temporais.'),
('historias', 'A Carta de Paulo sobre o Amor', '1 Coríntios 13:4', 'O amor é paciente, é benigno; o amor não arde em ciúmes, não se vangloria, não se orvalha.', 'O Acróstico do Amor: Escrever a palavra AMOR e listar adjetivos bondosos para cada letra.'),
('historias', 'A Armadura de Deus para a Batalha', 'Efésios 6:11', 'Vestimos a armadura completa de Deus para ficarmos firmes contra todo mal com fé e verdade.', 'Postura de Campeões: Ficar em pé com firmeza e postura de coragem em Cristo.'),
('historias', 'A Alegria que Excede em Cristo', 'Filipenses 4:4', 'Alegrai-vos sempre no Senhor; outra vez digo, alegrai-vos com o coração cheio de paz.', 'Dança de Louvor: Dançar alegremente celebrando a alegria que vem do alto.'),
('historias', 'A Paz que Guarda o Coração', 'Filipenses 4:7', 'A paz de Deus guarda os nossos corações e os nossos pensamentos em Cristo Jesus.', 'Respiração de Paz: Fechar os olhos e respirar fundo sentindo a tranquilidade de Deus.'),
('historias', 'Tesouros nas Coisas do Alto', 'Colossenses 3:2', 'Pensai nas coisas que são de lá do alto, e não nas que são aqui da terra.', 'Olhando para o Céu: Desenhar nuvens fofinhas e estrelas brilhantes no papel.'),
('historias', 'A Volta de Jesus nas Nuvens', '1 Tessalonicenses 4:16', 'O Senhor mesmo descenderá do céu com alarme, e os que crem Nele subirão para estar com Ele.', 'A Festa nas Nuvens: Fazer festinha com balões brancos celebrando a promessa da volta de Jesus.'),
('historias', 'A Palavra Viva e Eficaz', 'Hebreus 4:12', 'A palavra de Deus é viva, eficaz e mais penetrante do que qualquer espada de dois gumes.', 'A Espada de Papelão: Recortar espadas de papel simbolizando o uso correto da Palavra.'),
('historias', 'Os Heróis da Fé', 'Hebreus 11:1', 'A fé é a certeza das coisas que se esperam e a convicção de fatos que não se veem.', 'Galeria de Heróis: Desenhar personagens bíblicos e expor na parede da sala.'),
('historias', 'A Tiago sobre o Domínio da Língua', 'Tiago 1:19', 'Todo homem seja pronto para ouvir, tardio para falar e tardio para se irar contra o mal.', 'O Filtro da Boca: Fazer um gesto de fechar a boca com a chave imaginária da bondade.'),
('historias', 'A Coroa da Vida Prometida', 'Tiago 1:12', 'Bem-aventurado o homem que suporta a tentação; porque, quando for provado, receberá a coroa da vida.', 'Coroas de Brilho: Confeccionar coroas de papel com estrelas coladas.'),
('historias', 'Pedro sobre o Cuidado de Deus', '1 Pedro 5:7', 'Lançando sobre ele toda a vossa ansiedade, porque ele tem cuidado de vós com carinho.', 'A Caixa de Entregas: Colocar bilhetes de preocupações numa caixinha e orar juntos.'),
('historias', 'João sobre o Amor que nos Conquista', '1 João 4:19', 'Nós o amamos porque ele nos amou primeiro, enviando Seu Filho para nos salvar.', 'Coração Gigante: Desenhar um coração enorme no chão e sentar todos dentro dele.'),
('historias', 'A Visão de João na Ilha de Patmos', 'Apocalipse 1:9', 'Jesus é o Alfa e o Ômega, o princípio e o fim, Aquele que era, que é e que há de vir.', 'O Livro Dourado: Enfeitar uma capa de livro com papel dourado simbolizando a Palavra eterna.');

do $$
declare
  n integer;
  incompletos integer;
begin
  select count(*) into n
    from public.curated_lesson_themes
   where category = 'historias';

  select count(*) into incompletos
    from public.curated_lesson_themes
   where category = 'historias'
     and (
       length(btrim(title)) < 2
       or length(btrim(bible_passage)) < 1
       or length(btrim(core_lesson)) < 1
       or length(btrim(activity_suggestion)) < 1
     );

  if incompletos <> 0 then
    raise exception 'Seed de historias inválido: % temas, % incompletos.', n, incompletos;
  end if;

  if n <> 90 then
    raise exception 'Seed de historias esperava 90 temas e gravou %.', n;
  end if;
end;
$$;
