// Monta o prompt que o dono cola na IA (Claude, ChatGPT, Gemini...) junto com o PDF.
// A IA identifica a matéria e as áreas A PARTIR DO PDF (não de uma lista fechada) e devolve um
// JSON no formato que a importação (src/db/importacao.ts) entende. Mudou o formato? Atualize os
// dois e docs/PROMPT-GERAR-QUESTOES.md.

export type MateriaExistente = { nome: string; areas: string[] };

export type PedidoPrompt = {
  faceis: number;
  medias: number;
  dificeis: number;
  flashcards: number;
  estilo: "multipla" | "certo_errado" | "misturar";
  pontosJaCobertos?: string;
  /** O que já existe na plataforma: a IA reaproveita esses nomes quando o PDF tratar do mesmo tema. */
  existentes?: MateriaExistente[];
};

const ESTILOS: Record<PedidoPrompt["estilo"], string> = {
  multipla: "múltipla escolha com 5 alternativas (A a E)",
  certo_errado: "certo ou errado (estilo Cebraspe)",
  misturar: "misture: cerca de 2/3 de múltipla escolha com 5 alternativas (A a E) e 1/3 de certo ou errado",
};

function secaoExistentes(existentes: MateriaExistente[] | undefined) {
  const comAreas = (existentes ?? []).filter((m) => m.areas.length);
  if (!comAreas.length) return "";
  return `
# NOMES QUE JÁ EXISTEM NA PLATAFORMA
Isto NÃO limita o que você pode criar: a matéria e as áreas vêm do PDF. Mas, se o PDF tratar de um destes temas, use exatamente o mesmo nome, para não criar duplicatas:
${comAreas.map((m) => `- ${m.nome}: ${m.areas.join("; ")}`).join("\n")}
`;
}

export function montarPrompt(p: PedidoPrompt) {
  const total = p.faceis + p.medias + p.dificeis;
  return `Você é professor especialista em concursos públicos no Brasil e elaborador de questões. Anexei um PDF de conteúdo. Leia o PDF, identifique a matéria e os assuntos que ele aborda e crie questões e flashcards INÉDITOS sobre esse conteúdo, seguindo à risca as regras abaixo.

# PEDIDO
- Questões: ${total} no total (${p.faceis} fáceis, ${p.medias} médias, ${p.dificeis} difíceis)
- Flashcards: ${p.flashcards}
- Formato das questões: ${ESTILOS[p.estilo]}
- Pontos já cobertos em lotes anteriores (NÃO repita): ${p.pontosJaCobertos?.trim() || "nenhum"}

# FONTE
1. Use SOMENTE o conteúdo do PDF. Não acrescente regras, exceções, números, prazos, artigos de lei ou jurisprudência que não estejam nele.
2. Se o PDF não tiver conteúdo suficiente para a quantidade pedida, gere menos. Não invente para completar.

# PASSO 1: IDENTIFICAR MATÉRIA E ÁREAS (pelo conteúdo do PDF)
1. MATÉRIA ("disciplina"): o nome da disciplina como aparece em editais de concurso, por extenso. Exemplos: "Língua Portuguesa", "Matemática", "Raciocínio Lógico", "Informática", "Direito Constitucional", "Direito Administrativo", "Direito Penal", "Contabilidade Geral", "Legislação de Trânsito", "Atualidades".
2. ÁREAS ("area"): os tópicos do conteúdo programático que o PDF aborda, como aparecem em editais. Regras para o nome da área:
   - curto (de 1 a 5 palavras), no singular quando fizer sentido: "Substantivo", "Crase", "Concordância Verbal", "Atos Administrativos", "Juros Compostos";
   - nem amplo demais ("Gramática", "Direito", "Conteúdo geral"), nem estreito demais ("Crase antes de horas" é um PONTO dentro da área "Crase");
   - o mesmo tema sempre com o mesmo nome, letra por letra, em todas as questões e flashcards.
   Um PDF costuma ter de 1 a 8 áreas.
3. Se o PDF tratar de mais de uma matéria, coloque "disciplina" dentro de cada questão e flashcard.
${secaoExistentes(p.existentes)}
# PASSO 2: MAPEAR OS PONTOS (antes de escrever)
1. Dentro de cada área, liste os pontos específicos cobráveis do PDF (uma regra, um conceito, uma exceção, uma classificação).
2. Distribua as questões entre as áreas na proporção do quanto o PDF fala de cada uma.

# PASSO 3: ESCREVER AS QUESTÕES
Repetição (o mais importante):
1. Espalhe as questões por todos os pontos antes de repetir um. No mesmo nível, no máximo 2 questões por ponto.
2. Nunca reaproveite o mesmo exemplo, frase, palavra-chave ou número em duas questões.
3. Os flashcards fixam o conceito; as questões aplicam. Não copie um no outro.

Níveis (todos com UMA resposta indiscutível):
- "facil": um único ponto, cobrado de forma direta (definição, regra geral, exemplo clássico). Enunciado curto. As erradas são claramente erradas para quem estudou.
- "medio": aplica a regra a um caso concreto ou frase nova, ou exige distinguir conceitos parecidos. As erradas são plausíveis e exploram erros comuns de aluno.
- "dificil": combina pontos, cobra exceções, casos-limite e as pegadinhas típicas de banca. Alternativas parecidas entre si; exige leitura atenta.

Qualidade:
4. Exatamente uma alternativa correta; as outras inequivocamente erradas segundo o PDF.
5. Alternativas com tamanho, tom e nível de detalhe parecidos: a correta não pode ser a mais longa nem a mais curta, e as erradas erram por conteúdo (prazo, requisito, regra trocada pela exceção), não por exagero ("sempre", "jamais", "em qualquer hipótese" só nas erradas denunciam a resposta).
5a. Pena é exceção: no máximo 1 em cada 10 questões pode girar em torno de quantidade de pena ("reclusão de 2 a 4 anos", "aumentada de um terço"). Nas demais, cobre o crime: qual crime se configura, elementares, consumação e tentativa, hipóteses de qualificadora ou aumento (sem a fração), exceções, ação penal, diferença entre crimes parecidos. Quando a pergunta é "qual crime", as alternativas trazem só o crime, sem a pena.
6. Proibido: "todas as anteriores", "nenhuma das anteriores", "A e B estão corretas".
7. Distribua a letra correta por igual (4 alternativas: cerca de 25% cada; 5 alternativas: cerca de 20% cada), nunca 3 seguidas com a mesma letra. Não concentre a correta em "E" (a última).
7a. Direito Penal, crimes: cite no comentário o artigo do Código Penal do crime cobrado (ex.: "art. 157 do CP") e trate de um crime central por questão. Se o lote for de um crime só, use o nome do crime como área (ex.: "Feminicídio", "Roubo", "Peculato").
8. Enunciado autossuficiente: não escreva "segundo o PDF", "conforme o texto acima" nem "na página X".
9. "comentario" com 2 a 6 frases: por que a correta está certa e onde está o erro das erradas.
10. Certo ou errado: "alternativas" exatamente [{"letra":"C","texto":"Certo"},{"letra":"E","texto":"Errado"}], equilibrando itens certos e errados.
11. Português do Brasil, norma culta, linguagem de prova.

# PASSO 4: CONFERIR (sem escrever na resposta)
Para cada questão: o gabarito está certo segundo o PDF? Só uma alternativa é correta? O nível condiz com a definição? A mesma área está escrita igual em todas as questões? Há repetição de ponto ou exemplo? Corrija o que precisar.

# FORMATO DA RESPOSTA
Entregue UM arquivo .json para download (nome sugerido: questoes.json). Se você não puder criar arquivos, responda com um único bloco de código json contendo o mesmo conteúdo, e nada mais além de uma frase curta.

Estrutura exata (JSON válido, aspas duplas, sem comentários):
{
  "disciplina": "<matéria identificada no PDF>",
  "pontos_cobertos": [
    { "area": "<área>", "ponto": "<ponto específico>", "questoes": 2 }
  ],
  "questoes": [
    {
      "area": "<área>",
      "dificuldade": "facil",
      "enunciado": "...",
      "alternativas": [
        { "letra": "A", "texto": "..." },
        { "letra": "B", "texto": "..." },
        { "letra": "C", "texto": "..." },
        { "letra": "D", "texto": "..." },
        { "letra": "E", "texto": "..." }
      ],
      "gabarito": "C",
      "comentario": "..."
    }
  ],
  "flashcards": [
    { "area": "<área>", "frente": "...", "verso": "..." }
  ]
}

Regras do JSON:
- "dificuldade": exatamente "facil", "medio" ou "dificil" (sem acento).
- NÃO inclua "id", "banca" nem "ano": as questões são inéditas, não de prova real.
- Quebra de linha dentro de um texto: \\n.`;
}
