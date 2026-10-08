-- Temas do eixo proximo enviados no seed (96 linhas). Reexecutar substitui só esta categoria.
-- Aplica: npx supabase db query --linked -f scripts/curated-lesson-themes-proximo.sql

delete from public.curated_lesson_themes
 where category = 'proximo';

insert into public.curated_lesson_themes (category, title, bible_passage, core_lesson, activity_suggestion) values
('proximo', 'O Bom Samaritano: Quem é o meu Próximo?', 'Lucas 10:37', 'O nosso próximo é qualquer pessoa que precisa do nosso amor, compaixão e ajuda prática no dia a dia.', 'O Curativo do Amor: Colocar um band-aid simbólico no braço para lembrar de ajudar quem sofre.'),
('proximo', 'A Menina que Ajudou Naamã', '2 Reis 5:3', 'Mesmo sendo pequena e distante de casa, a menina serva teve um coração bondoso e apontou o caminho da cura.', 'O Bilhete de Esperança: Escrever um recado de incentivo e esperança para entregar a alguém.'),
('proximo', 'Partilhando o Lanche com Alegria', 'João 6:11', 'Quando repartimos o que temos com quem não tem, experimentamos a alegria de ver Deus multiplicar o amor.', 'Partilha de Frutas: Dividir pedacinhos de frutas ou lanches em roda, exercitando a generosidade.'),
('proximo', 'O Cuidado com os Necessitados', 'Provérbios 19:17', 'Quem se apieda do pobre empresta ao Senhor, e ele lhe retribuirá o seu benefício.', 'O Cofrinho da Solidariedade: Desenhar moedinhas com corações para lembrar de ajudar os necessitados.'),
('proximo', 'Palavras que Constroem e Curam', 'Provérbios 16:24', 'As palavras agradáveis são como favo de mel, doçura para a alma e saúde para os ossos.', 'Chuva de Elogios: Escrever qualidades dos colegas em papéis coloridos e distribuí-los.'),
('proximo', 'Acolhendo o Novo Colega', 'Romanos 15:7', 'Portanto, acolhei-vos uns aos outros, como também Cristo nos acolheu para a glória de Deus.', 'Cadeira do Acolhimento: Convidar um colega para sentar no centro e receber boas-vindas calorosas.'),
('proximo', 'O Serviço com Humildade', 'Gálatas 5:13', 'Mas sede servos uns dos outros, pelo amor, servindo uns aos outros com alegria.', 'O Ajudante Secreto: Cada criança tira o nome de um colega para ajudar discretamente na aula.'),
('proximo', 'Mãos Prontas para Levantar o Caído', 'Eclesiastes 4:10', 'Porque se um cair, o outro levanta o seu companheiro; mas ai do que estiver só quando cair.', 'Mãos Dadas: Dar as mãos em duplas para ajudar o colega a atravessar um pequeno obstáculo lúdico.'),
('proximo', 'O Perdão que Restaura Relacionamentos', 'Colossenses 3:13', 'Perdoai-vos mutuamente, assim como o Senhor vos perdoou; fazei vós também assim.', 'O Abraço de Paz: Reconciliar duplas que brincam de fazer as pazes com sorrisos e abraços.'),
('proximo', 'A Hospitalidade com Alegria', 'Romanos 12:13', 'Praticai a hospitalidade com alegria, repartindo o espaço e o afeto com quem chega.', 'A Roda do Chá: Sentar em círculo tomando água ou suco juntos, celebrando a comunhão.'),
('proximo', 'Levando as Cargas uns dos Outros', 'Gálatas 6:2', 'Levai as cargas uns dos outros, e assim cumprirei a lei de Cristo.', 'Carregando a Mochila: Simular ajudar a carregar uma mochila pesada para entender o alívio da ajuda.'),
('proximo', 'A Alegria em Dar do que Receber', 'Atos 20:35', 'Mais bem-aventurada coisa é dar do que receber, pois a generosidade enche o coração de paz.', 'Doação de Brinquedos: Conversar sobre separar brinquedos em bom estado para doar a outras crianças.'),
('proximo', 'O Respeito aos Idosos e Pais', 'Levítico 19:32', 'Diante das cãs te levantarás, e honrarás a face do velho, e teme ao teu Deus.', 'Cartão aos Avós: Desenhar um cartão especial para entregar aos avós ou idosos da família.'),
('proximo', 'A Justiça com os Oprimidos', 'Isaías 1:17', 'Aprendei a fazer o bem; buscai a justiça, acudi ao oprimido, fazei justiça ao órfão.', 'A Ponte da Justiça: Construir uma ponte com blocos para ajudar bonequinhos a cruzarem em segurança.'),
('proximo', 'A Verdade Falada com Amor', 'Efésios 4:15', 'Antes, seguindo a verdade em amor, cresçamos em tudo naquele que é a cabeça, Cristo.', 'Conversa Suave: Praticar falar a verdade com carinho e tom de voz tranquilo em duplas.'),
('proximo', 'A Visita aos Enfermos', 'Mateus 25:36', 'Estive nu, e vestistes-me; estive enfermo, e visitastes-me; estive na prisão, e fostes ver-me.', 'Post-its de Oração: Escrever nomes de pessoas doentes para interceder por elas em grupo.'),
('proximo', 'O Amor que Não Guarda Mágoas', '1 Coríntios 13:5', 'O amor não se porta com indecência, não busca os seus interesses, não se irrita, não suspeita mal.', 'O Balão do Perdão: Amassar um papel escrito "Mágoa" e jogá-lo na lixeira, respirando paz.'),
('proximo', 'A Fuga da Fofoca e da Falsidade', 'Provérbios 11:13', 'O fofofeiro revela o segredo, mas o fiel de espírito encobre o negócio.', 'Telefone Cuidadoso: Passar uma mensagem de encorajamento real na rodinha da sala.'),
('proximo', 'A Generosidade com o Alimento', 'Provérbios 22:9', 'Quem tem o olhar generoso é abençoado, porque reparte o seu pão com o pobre.', 'Cesta de Alimentos: Simular a organização de uma cesta básica com itens de mentirinha.'),
('proximo', 'A Paciência com os Fracos', 'Romanos 15:1', 'Ora, nós que somos fortes devemos suportar as fraquezas dos fracos, e não agradar a nós mesmos.', 'Caminhada Guiada: Guiar com suavidade um colega de olhos fechados pela sala.'),
('proximo', 'O Testemunho de Boas Obras', 'Mateus 5:16', 'Assim resplandeça a vossa luz diante dos homens, para que vejam as vossas boas obras e glorifiquem a Deus.', 'Estrelas da Bondade: Recortar estrelas de papel e escrever boas ações nelas.'),
('proximo', 'A Coragem de Defender o Fraco', 'Provérbios 31:8', 'Abre a tua boca a favor do mudo, pela causa de todos os desamparados.', 'Teatro de Proteção: Encenar uma situação de proteção e amparo a quem precisa de ajuda.'),
('proximo', 'A Partilha do Conhecimento', 'Provérbios 15:7', 'Os lábios dos sábios disseminam o conhecimento, mas o coração dos tolos não faz assim.', 'Ensinando o Colega: Explicar um joguinho ou versículo para o colega ao lado.'),
('proximo', 'A Alegria na Alegria do Outro', 'Romanos 12:15', 'Alegrai-vos com os que se alegram; chorai com os que choram.', 'Aplauso Festivo: Bater palmas com entusiasmo para celebrar uma conquista do colega.'),
('proximo', 'O Cuidado com a Natureza e a Criação', 'Salmos 24:1', 'Do Senhor é a terra e a sua plenitude, o mundo e aqueles que nele habitam.', 'Plantando Sementes: Plantar feijãozinho no algodão para cuidar da vida criada por Deus.'),
('proximo', 'A Paz nas Ruas e na Comunidade', 'Romanos 12:18', 'Se for possível, quanto estiver em vós, tende paz com todos os homens.', 'A Corrente da Paz: Dar as mãos em roda e transmitir um aperto leve de mão.'),
('proximo', 'O Respeito às Diferenças no Corpo', '1 Coríntios 12:21', 'E o olho não pode dizer à mão: Não tenho necessidade de ti; nem tampouco a cabeça aos pés.', 'Quebra-Cabeça Coletivo: Juntar peças desenhadas por todos para formar um painel.'),
('proximo', 'A Prontidão para Ouvir', 'Tiago 1:19', 'Todo homem seja pronto para ouvir, tardio para falar e tardio para se irar.', 'Orelhas de Papel: Brincar de quem ouve a história com mais atenção e carinho.'),
('proximo', 'A Gratidão pelos Professores e Líderes', '1 Tessalonicenses 5:12', 'E rogamo-vos, irmãos, que reconheçais os que trabalham entre vós e vos presidem no Senhor.', 'Cartão Coletivo: Fazer um desenho de agradecimento para os líderes da igreja.'),
('proximo', 'A Justiça nas Brincadeiras', 'Deuteronômio 25:15', 'Peso inteiro e justo terás; efa inteiro e justo terás, para que se prolonguem os teus dias.', 'Regras Justas: Revisar um jogo para garantir que todos tenham vez e voz.'),
('proximo', 'O Abraço que Acolhe', 'Lucas 15:20', 'E, levando-se, foi para seu pai; e, quando vinha ainda longe, o viu seu pai, e se compadeceu.', 'Abraço Coletivo: Dar um abraço em grupo para celebrar a união e o amor.'),
('proximo', 'A Oferta de Tempo ao Necessitado', 'Gálatas 6:10', 'Por isso, enquanto temos oportunidade, façamos o bem a todos, principalmente aos da fé.', 'O Favor do Dia: Oferecer ajuda voluntária para organizar os materiais da sala.'),
('proximo', 'A Coragem de Levar o Evangelho', 'Marcos 16:15', 'E disse-lhes: Ide por todo o mundo, pregai o evangelho a toda criatura.', 'O Barquinho missionário: Dobrar barquinhos de papel para simbolizar a viagem levando a Palavra.'),
('proximo', 'A Sinceridade no Cuidado', '1 João 3:18', 'Meus filhinhos, não amemos de palavra, nem de língua, mas por obra e em verdade.', 'Mãos Carimbadas: Carimbar as mãos em cartolina para firmar o compromisso de ajudar.'),
('proximo', 'A Doação de Roupas e Abrigos', 'Tiago 2:15-16', 'Se um irmão ou uma irmã estiverem nus e tiverem falta de mantimento cotidiano... ide em paz, aquentai-vos.', 'Campanha do Agasalho (Lúdico): Organizar roupinhas de boneca para doar, falando sobre doação.'),
('proximo', 'A Paciência com os Erros dos Outros', 'Efésios 4:2', 'Com toda a humildade e mansidão, com longanimidade, suportando-vos uns aos outros em amor.', 'O Sorriso da Paciência: Fazer caretas engraçadas e depois sorrir, exercitando a paciência.'),
('proximo', 'O Louvor em Unidade', 'Salmos 133:1', 'Oh! Quão bom e quão suave é que os irmãos vivam em união!', 'Corinho em Unidade: Cantar um refrão alegre de mãos dadas com a turma.'),
('proximo', 'A Resposta Branda que Transforma', 'Provérbios 15:1', 'A resposta branda desvia o furor, mas a palavra dura suscita a ira.', 'Teatro de Fantoches: Encenar a resolução pacífica de um pequeno mal-entendido.'),
('proximo', 'A Visita aos Solitários', 'Tiago 1:27', 'A religião pura e imaculada para com Deus e Pai é esta: visitar os órfãos e as viúvas nas suas tribulações.', 'Cartão Surpresa: Desenhar cartões para entregar a pessoas que moram sozinhas.'),
('proximo', 'A Generosidade Sem Esperar Retorno', 'Lucas 6:35', 'Amai, pois, a vossos inimigos, e fazei bem, e emprestai, não esperando nada de volta.', 'A Boa Ação Secreta: Fazer algo bondoso sem contar para ninguém até o fim do dia.'),
('proximo', 'O Respeito à Propriedade do Colega', 'Êxodo 20:15', 'Não furtarás.', 'O Jogo do Cuidado: Devolver um objeto emprestado pelo colega com agradecimento.'),
('proximo', 'A Fuga da Calúnia', 'Salmos 15:3', 'Aquele que não calunia com a sua língua, nem faz mal ao seu próximo, nem aceita nenhum opróbrio contra o seu próximo.', 'O Filtro das Palavras: Usar um coador de mentirinha para filtrar fofocas e falar o bem.'),
('proximo', 'A Prontidão para Servir na Igreja', 'Êxodo 36:2', 'Todo homem cujo coração o moveu a vir à obra para a fazê-la...', 'Organização da Sala: Arrumar as cadeiras e livros com carinho e zelo voluntário.'),
('proximo', 'A Coragem de Ser Diferente para o Bem', 'Daniel 1:8', 'E Daniel propôs no seu coração não se contaminar com a porção do manjar do rei.', 'Postura Firme: Ficar em pé com firmeza, escolhendo fazer o bem mesmo que outros não façam.'),
('proximo', 'O Perdão Sem Limites', 'Mateus 18:22', 'Não te digo até sete vezes, mas até setenta vezes sete.', 'Multiplicando Abraços: Dar abraços de perdão em ritmo acelerado e divertido na roda.'),
('proximo', 'A Justiça na Distribuição de Recursos', 'Atos 4:35', 'E se punha a repartir a cada um, segundo a necessidade que alguém tinha.', 'Divisão Justa: Distribuir materiais igualmente entre os grupos da sala.'),
('proximo', 'A Alegria em Servir em Missões', 'Romanos 10:15', 'E como pregarão, se não forem enviados? Como está escrito: Quão formosos os pés dos que anunciam a paz!', 'Os Pés Missionários: Desenhar pegadas com passagens de paz para decorar a sala.'),
('proximo', 'O Cuidado com os Animais e a Terra', 'Provérbios 12:10', 'O justo atenta para a vida dos seus animais, mas as entranhas dos ímpios são cruéis.', 'História de Cuidado com Pets: Conversar sobre a proteção aos animais e ao meio ambiente.'),
('proximo', 'A Oração Intercessória pelos Povos', '1 Timóteo 2:1', 'Exorto-vos, antes de tudo, que se façam deprecações, orações, intercessões, ações de graças, por todos os homens.', 'Globo Terrestre de Papel: Passar uma bola representando o mundo e orar por países diferentes.'),
('proximo', 'A Hospitalidade com Estrangeiros', 'Levítico 19:34', 'O estrangeiro que habitar convosco será como o natural entre vós; amá-lo-ás como a ti mesmo.', 'Boas-Vindas Internacionais: Encenar saudações de boas-vindas calorosas a novos visitantes.'),
('proximo', 'A Paciência no Trabalho em Equipe', 'Eclesiastes 4:9', 'Melhor são dois do que um, porque têm paga melhor do seu trabalho.', 'Construção Coletiva: Montar um quebra-cabeça gigante em equipe sem pressa.'),
('proximo', 'A Sinceridade no Elogio', 'Provérbios 27:2', 'Louve-te o estranho e não a tua boca; o alheio, e não os teus lábios.', 'Elogio Cruzado: Cada criança recebe um elogio sincero e agradece com modéstia.'),
('proximo', 'A Generosidade nas Palavras de Ânimo', '1 Tessalonicenses 5:11', 'Pelo que exortai-vos uns aos outros, e edificar-vos uns aos outros, como também fazeis.', 'Post-its de Ânimo: Escrever palavras motivadoras e colar nas mesas.'),
('proximo', 'A Retidão nos Acordos com o Próximo', 'Salmos 15:4', 'Aquele que jura com dano seu, e não muda.', 'O Aperto de Mãos: Firmar um compromisso de ajuda mútua com o colega.'),
('proximo', 'A Mansidão no Tratar os Conflitos', 'Provérbios 16:32', 'Melhor é o longânimo do que o valente, e o que domina o seu espírito do que o que conquista uma cidade.', 'Respiração da Calma: Praticar inspirar e expirar antes de resolver um desentendimento.'),
('proximo', 'A Prontidão para Ajudar Desconhecidos', 'Lucas 10:33', 'Mas um samaritano, que ia de viagem, chegou perto dele e, vendo-o, teve compaixão.', 'Histórias de Bondade: Contar relatos reais de pessoas que ajudaram quem precisava na rua.'),
('proximo', 'O Respeito às Regras da Comunidade', 'Romanos 13:1', 'Toda alma esteja sujeita às autoridades superiores; porque não há autoridade que não venha de Deus.', 'O Jogo das Placas: Brincar de seguir regras de convivência na sala.'),
('proximo', 'A Partilha de Roupas e Brinquedos', 'Lucas 3:11', 'E, respondendo ele, disse-lhes: Quem tiver duas túnicas, reparta com o que não tem.', 'Separando Brinquedos: Simular a escolha de brinquedos para doação beneficente.'),
('proximo', 'A Alegria na Comunhão Fraterna', 'Salmos 133:1', 'Oh! Quão bom e quão suave é que os irmãos vivam em união!', 'Roda de Abraços: Dar as mãos e cantar uma música alegre de união.'),
('proximo', 'A Justiça no Tratar os Empregados e Colegas', 'Colossenses 4:1', 'Vós, senhores, fazei o que é justo e equitativo a vossos servos.', 'Trabalho Justo: Dividir tarefas de grupo de forma transparente e igualitária.'),
('proximo', 'O Cuidado com os Pobres e Necessitados', 'Provérbios 14:31', 'O que oprime o reprova ao seu Criador, mas o que se apieda do pobre honra a Deus.', 'Cofrinho da Solidariedade: Desenhar moedinhas para lembrar de ajudar projetos sociais.'),
('proximo', 'A Oração pelos Governantes e Líderes', '1 Timóteo 2:2', 'Pelos reis, e por todos os que estão em eminência, para que tenhamos uma vida quieta e sossegada.', 'Oração pela Cidade: Interceder em grupo pela cidade e pelas autoridades locais.'),
('proximo', 'A Hospitalidade com os Irmãos da Fé', '3 João 1:5', 'Amado, procedes fielmente em tudo o que fazes para com os irmãos, e para com os estrangeiros.', 'A Tenda da Acolhida: Montar uma cabaninha de lençóis simbolizando o lar que acolhe.'),
('proximo', 'A Fuga do Orgulho e da Soberba', 'Provérbios 16:18', 'A soberba precede a ruína, e a altivez do espírito precede a queda.', 'Torre e Humildade: Construir torres e conversar sobre mantermos o coração humilde e servidor.'),
('proximo', 'A Generosidade com os Missionários', 'Romanos 12:13', 'Comunicai com as necessidades dos santos; segui a hospitalidade.', 'Cartão para Missionários: Desenhar cartões de apoio para enviar a missionários distantes.'),
('proximo', 'A Prontidão no Socorro Imediato', 'Provérbios 3:27', 'Não withhold o bem a quem o pode fazer, quando está no poder da tua mão fazê-lo.', 'A Corrida da Ajuda: Brincadeira de correr para ajudar o colega a pegar um objeto caído.'),
('proximo', 'A Paciência na Esperança do Bem', 'Gálatas 6:9', 'E não nos cansemos de fazer o bem, porque a seu tempo ceifaremos, se não houvermos desfalecido.', 'Sementinha da Bondade: Regar o vasinho de feijão na sala para ver o fruto da perseverança.'),
('proximo', 'A Pureza nas Intenções de Ajudar', 'Mateus 6:1', 'Guardai-vos de fazer a vosso albergue diante dos homens, para serdes vistos por eles.', 'Ação Secreta: Fazer uma boa ação sem contar para ninguém até o final da aula.'),
('proximo', 'O Amor que Une Diferenças', 'Colossenses 3:14', 'E, sobre tudo isto, revesti-vos de amor, que é o vínculo da perfeição.', 'Corrente de Mãos: Dar as mãos formando um círculo colorido e forte na sala.'),
('proximo', 'A Justiça nas Relações Diárias', 'Miqueias 6:8', 'Ele te declarou, ó homem, o que é bom... que pratiques a justiça, e ames a beneficência.', 'A Balança Justa: Desenhar balanças de papel para equilibrar atitudes corretas e justas.'),
('proximo', 'O Perdão Pronto e Sem Demora', 'Efésios 4:26', 'Irai-vos, e não pequeis; não se ponha o sol sobre a vossa ira.', 'O Abraço Rápido: Fazer as pazes imediatamente após qualquer pequeno desentendimento.'),
('proximo', 'A Alegria em Compartilhar o Evangelho', 'Salmos 96:3', 'Anunciai entre as nações a sua glória; entre todos os povos as suas maravilhas.', 'O Megafone de Papel: Confeccionar megofones de papelão para pregar o amor de Deus com alegria.'),
('proximo', 'A Generosidade de Dar o Próprio Casaco', 'Lucas 3:11', 'Quem tiver duas túnicas, reparta com o que não tem, e quem tiver o que comer, faça o mesmo.', 'Partilha de Roupas de Boneca: Simular doação de agasalhos para aquecer quem tem frio.'),
('proximo', 'A Oração pelos Enfermos da Comunidade', 'Tiago 5:14', 'Está alguém entre vós doente? Chame os presbíteros da igreja, e orem sobre ele.', 'Cadeia de Oração: Orar uns pelos outros e pelos enfermos com muito carinho.'),
('proximo', 'O Respeito e Honra aos Pais', 'Efésios 6:2', 'Honra a teu pai e a tua mãe (que é o primeiro mandamento com promessa).', 'Cartão de Honra: Desenhar um cartão especial para entregar aos pais em casa.'),
('proximo', 'A Mansidão na Resposta ao Injusto', '1 Pedro 3:9', 'Não pagando mal com mal, ou injúria por injúria; antes, pelo contrário, bendizendo.', 'O Escudo do Bem: Responder a uma provocação com um sorriso e palavras de paz.'),
('proximo', 'A Prontidão para Acolher Crianças', 'Marcos 10:14', 'E, vendo isto, Jesus se indignou, e disse-lhes: Deixai vir os meninos a mim, e não os estorveis.', 'Cadeira de Boas-Vindas: Convidar as crianças menores para sentar no centro e receber carinho.'),
('proximo', 'A Justiça na Defesa dos Fracos', 'Provérbios 31:9', 'Abre a tua boca, julga retamente, e defende os direitos do aflito e do necessitado.', 'Defendendo o Colega: Encenar uma situação de proteção e amparo contra o bullying.'),
('proximo', 'A Paciência no Tratar os Desanimados', '1 Tessalonicenses 5:14', 'Rogamo-vos, também, irmãos, que admoesteis os desordenados, consoleis os de pouco ânimo, sustenteis os fracos.', 'Palavras de Ânimo: Entregar cartõezinhos com frases de apoio para os desanimados.'),
('proximo', 'A Generosidade em Dividir o Espaço', 'Romanos 12:10', 'Amai-vos cordialmente uns aos outros com amor fraternal, preferindo-vos em honra uns aos outros.', 'Acomodação na Roda: Abrir espaço na roda para que todos caibam confortavelmente.'),
('proximo', 'O Amor que Cobre Multidão de Pecados', '1 Pedro 4:8', 'Mas, sobretudo, tende ardente amor uns para com os outros; porque o amor cobrirá a multidão de pecados.', 'O Manto do Amor: Desenhar um manto colorido que cobre e protege o colega.'),
('proximo', 'A Prontidão no Auxílio Mútuo', 'Gálatas 6:2', 'Levai as cargas uns dos outros, e assim cumprirei a lei de Cristo.', 'Circuito de Ajuda: Auxiliar o colega a passar por um circuito lúdico de blocos.'),
('proximo', 'A Justiça com o Trabalhador e o Colega', 'Levítico 19:13', 'Não oprimirás o teu próximo, nem o roubarás; a diária do trabalhador não ficará contigo até à manhã.', 'Trabalho Justo: Cumprir acordos e regras de forma honesta nas brincadeiras.'),
('proximo', 'A Alegria em Servir sem Reclamação', 'Filipenses 2:14', 'Fazei todas as coisas sem murmurações nem contendas.', 'A Tarefa com Sorriso: Organizar a sala de aula cantando um corinho alegre.'),
('proximo', 'O Cuidado com os Órfãos e Viúvas', 'Salmos 68:5', 'Pai de órfãos e juiz de viúvas é Deus na sua santa morada.', 'Oração pelos Desamparados: Lembrar em oração das famílias que perderam entes queridos.'),
('proximo', 'A Fuga da Cobiça e do Egoísmo', 'Filipenses 2:4', 'Não atenção cada um apenas para o que é seu, mas cada qual também para o que é dos outros.', 'O Jogo da Troca Amigável: Trocar figurinhas ou desenhos pacificamente em grupo.'),
('proximo', 'A Generosidade com os Bens Materiais', 'Provérbios 11:24', 'Há quem dê generosamente, e lhe é acrescentado mais; e há quem retém mais do que é justo, mas é para a sua pobreza.', 'Partilha de Materiais: Emprestar lápis de cor e giz com alegria para quem precisa.'),
('proximo', 'A Paciência em Esperar a Vez do Outro', 'Salmos 37:7', 'Descansa no Senhor e espera nele; não te indignes por causa daquele que prospera.', 'A Fila Organizada: Exercitar a paciência na fila indiana para sair da sala.'),
('proximo', 'A Retidão nas Promessas de Ajuda', 'Eclesiastes 5:4', 'Quando a Deus fizeres algum voto, não tardes a pagá-lo; porque não se agrada de tolos.', 'O Compromisso de Ajudar: Prometer em voz alta ajudar um colega na tarefa da semana.'),
('proximo', 'A Mansidão no Tratar os Animimais e Pessoas', 'Provérbios 12:10', 'O justo atenta para a vida dos seus animais, mas as entranhas dos ímpios são cruéis.', 'Conversa de Cuidado: Falar sobre a importância de tratar bem todas as criaturas de Deus.'),
('proximo', 'A Prontidão para Ouvir e Acolher', 'Tiago 1:19', 'Todo homem seja pronto para ouvir, tardio para falar e tardio para se irar.', 'O Ouvido Amigo: Praticar escutar o desabafo ou história do colega com atenção plena.'),
('proximo', 'A Justiça na Solução de Conflitos', 'Provérbios 18:18', 'A sorte faz cessa as contendas, e decide entre os poderosos.', 'O Juiz de Paz: Encenar como resolver uma briga ouvindo os dois lados com justiça.'),
('proximo', 'A Alegria de Celebrar as Vitórias dos Outros', 'Romanos 12:15', 'Alegrai-vos com os que se alegram; chorai com os que choram.', 'Festa da Vitória: Fazer uma salva de palmas e parabéns para o colega que conseguiu vencer um desafio.'),
('proximo', 'O Amor Sincero e Sem Fingimento', 'Romanos 12:9', 'O amor seja não fingido. Aborrecei o mal e achegai-vos ao bem.', 'Abraço Verdadeiro: Trocar abraços sinceros e cheios de carinho com a turma.'),
('proximo', 'A Generosidade de Dividir o Lanche', 'Hebreus 13:16', 'E não te esqueças da beneficência e da comunhão, porque com tais sacrifícios Deus se agrada.', 'Partilha de Lanches: Dividir o lanche com o colega que esqueceu o seu.'),
('proximo', 'A Prontidão para Levar as Boas Novas', 'Romanos 10:15', 'Quão formosos os pés dos que anunciam a paz, dos que anunciam coisas boas!', 'Marcha Missionária: Marchar pela sala simulando levar a mensagem de paz e amor de Deus.');

do $$
declare
  n integer;
  incompletos integer;
begin
  select count(*) into n
    from public.curated_lesson_themes
   where category = 'proximo';

  select count(*) into incompletos
    from public.curated_lesson_themes
   where category = 'proximo'
     and (
       length(btrim(title)) < 2
       or length(btrim(bible_passage)) < 1
       or length(btrim(core_lesson)) < 1
       or length(btrim(activity_suggestion)) < 1
     );

  if incompletos <> 0 or n <> 96 then
    raise exception 'Seed de proximo inválido: % temas, % incompletos.', n, incompletos;
  end if;
end;
$$;
