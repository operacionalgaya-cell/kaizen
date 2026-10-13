// Conteúdo oficial: Documento Executivo "Jeito Gaya de Encantar e Vender" (Out/2026)
export const PRINCIPIOS = [
  ['Cliente no centro', 'Compreender a pessoa antes de tentar vender.'],
  ['Contexto antes de pergunta', 'Ler a conversa completa e aproveitar o que o cliente já informou.'],
  ['Qualificação adaptativa', 'Fazer somente as perguntas necessárias para recomendar e avançar.'],
  ['Recomendação com propósito', 'Conectar a necessidade a uma ou poucas opções adequadas, em vez de despejar o catálogo.'],
  ['Próximo passo claro', 'Cada interação deve facilitar uma decisão, esclarecer uma dúvida ou combinar uma ação.'],
  ['Humanidade', 'Linguagem acolhedora e natural, sem automatismo excessivo.'],
  ['Aprendizado sem caça às bruxas', 'Analisar erros para corrigir comportamentos e processos, sem presumir que toda perda decorre da consultora.'],
];
export const ETAPAS = [
  { n: 1, t: 'Acolhimento e contextualização', o: 'Receber a pessoa com cordialidade, ler o histórico e reconhecer o que ela já informou.', c: 'A necessidade inicial e o contexto estão claros, sem fazer o cliente repetir dados.' },
  { n: 2, t: 'Qualificação consultiva adaptativa', o: 'Entender apenas o que ainda falta para orientar uma recomendação adequada.', c: 'Há informação suficiente para escolher a melhor opção ou encaminhar uma resposta objetiva.' },
  { n: 3, t: 'Recomendação personalizada', o: 'Apresentar a experiência mais adequada e explicar a conexão com a necessidade do cliente.', c: 'O cliente compreende a recomendação e pode reagir, tirar dúvida ou decidir.' },
  { n: 4, t: 'Conversão e agendamento', o: 'Resolver as últimas dúvidas, confirmar a escolha e conduzir para compra ou agendamento.', c: 'Venda ou reserva confirmada, ou próximo passo explícito e registrado.' },
  { n: 5, t: 'Confirmação e preparação da experiência', o: 'Confirmar os dados essenciais, alinhar expectativas e preparar o cliente para a experiência.', c: 'Informações de comparecimento, horário, unidade e preparação estão corretas.' },
  { n: 6, t: 'Recuperação de oportunidades e relacionamento', o: 'Retomar oportunidades elegíveis, respeitando contexto, interesse e momento do cliente.', c: 'Há uma ação de recuperação definida ou uma conclusão registrada.' },
];
export const PERFIS = [
  { p: 'A', t: 'Sabe o que quer', s: 'Pede uma massagem amanhã ou pergunta por um serviço específico.', c: 'Qualificar somente o que falta, verificar unidade e disponibilidade e conduzir para agendamento.' },
  { p: 'B', t: 'Sabe o que busca, mas não qual experiência escolher', s: 'Quer relaxar, mas está em dúvida entre massagem, Mini Break ou Day Spa.', c: 'Fazer uma ou duas perguntas relevantes e recomendar a opção mais adequada.' },
  { p: 'C', t: 'Ainda está explorando', s: 'Demonstra curiosidade ampla sobre SPA ou autocuidado.', c: 'Guiar a descoberta com perguntas simples, sem pressionar nem apresentar todo o catálogo de uma vez.' },
];
export const CAMADAS = [
  ['Contexto', 'O que já sabemos pela mensagem inicial, pelo chatbot e pelo histórico?'],
  ['Necessidade', 'O que a pessoa deseja resolver, sentir ou vivenciar?'],
  ['Adequação', 'Qual experiência combina com a necessidade e com as restrições relevantes, como duração, unidade, horário e investimento?'],
  ['Avanço', 'O que falta para a decisão ou para a compra acontecer?'],
];
export const CONDUTAS = [
  ['Quando o cliente já sabe o que quer', 'Ex.: “Quero marcar uma massagem para amanhã.” Reconhecer o pedido, confirmar apenas o que falta para consultar a disponibilidade e avançar para a reserva. Evitar perguntas genéricas que não ajudam a concluir.'],
  ['Quando sabe o que deseja sentir, mas não o serviço', 'Ex.: “Quero relaxar, mas não sei se faço massagem ou Day Spa.” Entender brevemente a expectativa e recomendar uma opção com justificativa simples, sem sobrecarregar a conversa.'],
  ['Quando o cliente pergunta somente o preço', 'Responder de forma transparente. Se fizer sentido, acrescentar uma pergunta opcional que ajude a orientar a escolha, sem criar barreiras artificiais para informar o valor.'],
  ['Quando não há resposta', 'Seguir a cadência de contato definida para o canal e o tipo de oportunidade, respeitando preferências e regras. Não classificar automaticamente silêncio como perda definitiva.'],
  ['Quando a pessoa não pode no horário oferecido', 'Reconhecer a limitação e explorar alternativas viáveis, quando existirem. Registrar a restrição e combinar o próximo passo. Nunca prometer disponibilidade não confirmada.'],
];
export const CICLO = [
  ['1. Identificar', 'Classificar o desfecho: perda confirmada, oportunidade parada ou recuperável.'],
  ['2. Registrar', 'Anexar/vincular o histórico integral e preencher os campos essenciais.'],
  ['3. Analisar', 'Comparar a conversa com os critérios do playbook: acertos, desvios, atritos e pontos que exigem contexto humano.'],
  ['4. Dar feedback', 'O que foi bem, o que melhorar e uma alternativa concreta.'],
  ['5. Aplicar', 'A consultora consulta o retorno e usa o aprendizado nas próximas conversas.'],
  ['6. Consolidar', 'Agrupar causas e tendências para priorizar treinamento e melhorias de processo.'],
];
export const FEEDBACK_FORMATO = [
  ['fb_bem', 'O que foi bem conduzido'],
  ['fb_melhoria', 'Oportunidade de melhoria (com trecho/evidência do histórico)'],
  ['fb_alternativa', 'Como a conversa poderia ter sido conduzida de outra forma'],
  ['fb_exemplo', 'Exemplo de mensagem ou pergunta alternativa'],
  ['fb_aprendizado', 'Aprendizado prático para o próximo atendimento'],
  ['fb_recuperacao', 'Indicação de recuperação (quando houver oportunidade legítima)'],
] as const;
export const FALHAS_CRITICAS = ['Inventar disponibilidade', 'Confirmar reserva inexistente', 'Transmitir informação comercial incorreta', 'Desrespeitar a decisão do cliente'];
export const INDICADORES = [
  ['Tempo até a primeira resposta humana', 'Tempo entre a entrada do contato e a primeira resposta humana (se o dado estiver disponível e confiável).'],
  ['Conversão entre etapas', 'Oportunidades que chegam à etapa B ÷ oportunidades que chegaram à etapa A × 100.'],
  ['Taxa de recuperação', 'Oportunidades recuperadas ÷ oportunidades elegíveis para recuperação na coorte definida.'],
  ['Motivos de perda', 'Distribuição das perdas por categorias padronizadas (preço, timing, disponibilidade, oferta, condução…).'],
  ['Adesão ao processo', 'Amostra de conversas que atende aos critérios ÷ total de conversas avaliadas. Não confundir adesão com resultado.'],
];
export const GOVERNANCA = [
  'A análise não deve inventar falas, intenções, preços, disponibilidade ou fatos ausentes do histórico.',
  'Distinguir evidência observável de hipótese e indicar quando é necessária revisão humana.',
  'Nem toda perda é falha de atendimento: disponibilidade, preço, timing, preferência e concorrência também influenciam.',
  'Sem punição automática; a nota nunca é usada isoladamente para decisões disciplinares ou de remuneração.',
  'Históricos e dados pessoais têm acesso restrito, finalidade definida e tratamento compatível com as políticas de privacidade.',
];
export const RITUAL = [
  ['Semanal', 'Acompanhar conversão, volume, tempo de resposta, perdas, atritos e recuperação; selecionar ações prioritárias.'],
  ['Quinzenal (piloto)', 'Revisar uma amostra de conversas para verificar se o feedback é correto, justo e acionável.'],
  ['Mensal', 'Revisar tendências, atualizar o treinamento e avaliar se o processo contribui para a evolução dos resultados.'],
];
export const PROVA_ESTRUTURA = [
  ['Múltipla escolha', '25 questões', '25 pontos (1 por questão)'],
  ['Verdadeiro ou falso', '10 questões', '10 pontos (1 por questão)'],
  ['Discursivas/práticas', '15 questões', '45 pontos (0 a 3 por questão)'],
  ['Total', '50 questões', '80 pontos, convertidos para 0–100 (nota = pontos ÷ 80 × 100)'],
];
