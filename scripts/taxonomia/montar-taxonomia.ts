// Monta data/taxonomia.json a partir dos 3 editais verticalizados (docs/*.pdf):
// disciplina > tópico > subtópicos, com os concursos de cada tópico, as leis de referência
// e a meta de questões (soma ~20.000). Para mudar pesos ou metas, edite aqui e rode de novo:
//   npx tsx scripts/taxonomia/montar-taxonomia.ts
import { writeFileSync } from "node:fs";

// Banca, cargo e formato de cada concurso (informados pelo dono). O formato define quantas
// alternativas a questão tem; a banca orienta o estilo de cobrança.
const CONCURSOS = {
  P: { id: "pcce-2021", nome: "PCCE Inspetor e Escrivão 2021", orgao: "Polícia Civil do Estado do Ceará", cargo: "Inspetor e Escrivão de Polícia Civil", banca: "IDECAN", alternativas: 4 },
  G: { id: "gm-fortaleza", nome: "Guarda Municipal de Fortaleza", orgao: "Prefeitura Municipal de Fortaleza", cargo: "Guarda Municipal", banca: "IDECAN", edicao: "edital 2023", alternativas: 4 },
  C: { id: "cfo-pmce", nome: "CFO PMCE", orgao: "Polícia Militar do Ceará", cargo: "Cadete do Curso de Formação de Oficiais (CFO)", banca: "Vunesp", edicao: "2021/2022", alternativas: 5 },
} as const;
type Sigla = keyof typeof CONCURSOS;

// Leis citadas nos editais (já corrigidas: ver "observacao"). O texto integral vai em data/leis/<id>.txt.
const LEIS = {
  cf88: { nome: "Constituição Federal de 1988", fonte: "https://www.planalto.gov.br/ccivil_03/constituicao/constituicao.htm" },
  cp: { nome: "Código Penal (Decreto-Lei 2.848/1940)", fonte: "https://www.planalto.gov.br/ccivil_03/decreto-lei/del2848compilado.htm" },
  cpp: { nome: "Código de Processo Penal (Decreto-Lei 3.689/1941)", fonte: "https://www.planalto.gov.br/ccivil_03/decreto-lei/del3689compilado.htm" },
  cpm: { nome: "Código Penal Militar (Decreto-Lei 1.001/1969)", fonte: "https://www.planalto.gov.br/ccivil_03/decreto-lei/del1001.htm" },
  cppm: { nome: "Código de Processo Penal Militar (Decreto-Lei 1.002/1969)", fonte: "https://www.planalto.gov.br/ccivil_03/decreto-lei/del1002.htm" },
  "lei-8429-1992": { nome: "Lei de Improbidade Administrativa (Lei 8.429/1992, com a Lei 14.230/2021)", fonte: "https://www.planalto.gov.br/ccivil_03/leis/l8429.htm" },
  "lei-13709-2018": { nome: "LGPD (Lei 13.709/2018)", fonte: "https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/lei/l13709.htm" },
  "lei-14133-2021": { nome: "Licitações e Contratos (Lei 14.133/2021)", fonte: "https://www.planalto.gov.br/ccivil_03/_ato2019-2022/2021/lei/l14133.htm", observacao: "O edital de 2021 fala em licitações sem citar a lei; a Lei 8.666/1993 foi revogada em 30/12/2023." },
  "lei-9784-1999": { nome: "Processo Administrativo Federal (Lei 9.784/1999)", fonte: "https://www.planalto.gov.br/ccivil_03/leis/l9784.htm" },
  "lei-8072-1990": { nome: "Crimes Hediondos (Lei 8.072/1990)", fonte: "https://www.planalto.gov.br/ccivil_03/leis/l8072.htm" },
  "lei-9455-1997": { nome: "Lei de Tortura (Lei 9.455/1997)", fonte: "https://www.planalto.gov.br/ccivil_03/leis/l9455.htm" },
  "lei-11343-2006": { nome: "Lei de Drogas (Lei 11.343/2006)", fonte: "https://www.planalto.gov.br/ccivil_03/_ato2004-2006/2006/lei/l11343.htm", observacao: "O edital da GMF cita como 11.343/2016 (erro de digitação)." },
  "lei-13869-2019": { nome: "Abuso de Autoridade (Lei 13.869/2019)", fonte: "https://www.planalto.gov.br/ccivil_03/_ato2019-2022/2019/lei/l13869.htm" },
  "lei-9296-1996": { nome: "Interceptação Telefônica (Lei 9.296/1996)", fonte: "https://www.planalto.gov.br/ccivil_03/leis/l9296.htm" },
  "lei-7960-1989": { nome: "Prisão Temporária (Lei 7.960/1989)", fonte: "https://www.planalto.gov.br/ccivil_03/leis/l7960.htm" },
  "lei-12850-2013": { nome: "Organização Criminosa (Lei 12.850/2013)", fonte: "https://www.planalto.gov.br/ccivil_03/_ato2011-2014/2013/lei/l12850.htm" },
  "lei-7210-1984": { nome: "Lei de Execução Penal (Lei 7.210/1984)", fonte: "https://www.planalto.gov.br/ccivil_03/leis/l7210.htm" },
  "lei-12830-2013": { nome: "Investigação pelo Delegado de Polícia (Lei 12.830/2013)", fonte: "https://www.planalto.gov.br/ccivil_03/_ato2011-2014/2013/lei/l12830.htm" },
  "lei-12037-2009": { nome: "Identificação Criminal (Lei 12.037/2009)", fonte: "https://www.planalto.gov.br/ccivil_03/_ato2007-2010/2009/lei/l12037.htm" },
  "lei-10826-2003": { nome: "Estatuto do Desarmamento (Lei 10.826/2003)", fonte: "https://www.planalto.gov.br/ccivil_03/leis/2003/l10.826.htm" },
  "lei-7716-1989": { nome: "Crimes de Racismo (Lei 7.716/1989)", fonte: "https://www.planalto.gov.br/ccivil_03/leis/l7716.htm" },
  "lei-9099-1995": { nome: "Juizados Especiais (Lei 9.099/1995)", fonte: "https://www.planalto.gov.br/ccivil_03/leis/l9099.htm" },
  "lei-11340-2006": { nome: "Lei Maria da Penha (Lei 11.340/2006)", fonte: "https://www.planalto.gov.br/ccivil_03/_ato2004-2006/2006/lei/l11340.htm", observacao: "Os editais da GMF e do CFO citam como 11.340/16 (erro de digitação)." },
  "lei-8069-1990": { nome: "Estatuto da Criança e do Adolescente (Lei 8.069/1990)", fonte: "https://www.planalto.gov.br/ccivil_03/leis/l8069.htm" },
  "lei-10741-2003": { nome: "Estatuto da Pessoa Idosa (Lei 10.741/2003)", fonte: "https://www.planalto.gov.br/ccivil_03/leis/2003/l10.741.htm", observacao: "Renomeado de Estatuto do Idoso pela Lei 14.423/2022." },
  "lei-9503-1997": { nome: "Código de Trânsito Brasileiro (Lei 9.503/1997)", fonte: "https://www.planalto.gov.br/ccivil_03/leis/l9503compilado.htm" },
  "lei-1521-1951": { nome: "Crimes contra a Economia Popular (Lei 1.521/1951)", fonte: "https://www.planalto.gov.br/ccivil_03/leis/l1521.htm" },
  "lei-8137-1990": { nome: "Crimes contra a Ordem Tributária e Econômica (Lei 8.137/1990)", fonte: "https://www.planalto.gov.br/ccivil_03/leis/l8137.htm" },
  "lei-4737-1965": { nome: "Código Eleitoral (Lei 4.737/1965)", fonte: "https://www.planalto.gov.br/ccivil_03/leis/l4737compilado.htm" },
  "lei-8078-1990": { nome: "Código de Defesa do Consumidor (Lei 8.078/1990)", fonte: "https://www.planalto.gov.br/ccivil_03/leis/l8078compilado.htm" },
  "dl-3688-1941": { nome: "Lei das Contravenções Penais (Decreto-Lei 3.688/1941)", fonte: "https://www.planalto.gov.br/ccivil_03/decreto-lei/del3688.htm" },
  "lei-9605-1998": { nome: "Crimes Ambientais (Lei 9.605/1998)", fonte: "https://www.planalto.gov.br/ccivil_03/leis/l9605.htm" },
  "lei-9613-1998": { nome: "Lavagem de Dinheiro (Lei 9.613/1998)", fonte: "https://www.planalto.gov.br/ccivil_03/leis/l9613.htm" },
  "lei-9807-1999": { nome: "Proteção a Vítimas e Testemunhas (Lei 9.807/1999)", fonte: "https://www.planalto.gov.br/ccivil_03/leis/l9807.htm" },
  "lei-12288-2010": { nome: "Estatuto da Igualdade Racial (Lei 12.288/2010)", fonte: "https://www.planalto.gov.br/ccivil_03/_ato2007-2010/2010/lei/l12288.htm" },
  "lei-13146-2015": { nome: "Estatuto da Pessoa com Deficiência (Lei 13.146/2015)", fonte: "https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2015/lei/l13146.htm" },
  "lei-14597-2023": { nome: "Lei Geral do Esporte (Lei 14.597/2023)", fonte: "https://www.planalto.gov.br/ccivil_03/_ato2023-2026/2023/lei/l14597.htm", observacao: "Revogou o Estatuto do Torcedor (Lei 10.671/2003) citado no edital da PCCE. O edital do CFO cita 'Lei 12.984/2014', que é outra lei (discriminação de pessoas com HIV)." },
  "lei-13964-2019": { nome: "Pacote Anticrime (Lei 13.964/2019)", fonte: "https://www.planalto.gov.br/ccivil_03/_ato2019-2022/2019/lei/l13964.htm" },
  "lei-13260-2016": { nome: "Lei Antiterrorismo (Lei 13.260/2016)", fonte: "https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2016/lei/l13260.htm", observacao: "O edital da PCCE cita como 13.620/2016 (erro de digitação)." },
  "lei-13022-2014": { nome: "Estatuto Geral das Guardas Municipais (Lei 13.022/2014)", fonte: "https://www.planalto.gov.br/ccivil_03/_ato2011-2014/2014/lei/l13022.htm" },
  "lei-11530-2007": { nome: "PRONASCI (Lei 11.530/2007)", fonte: "https://www.planalto.gov.br/ccivil_03/_ato2007-2010/2007/lei/l11530.htm" },
  "ce-constituicao": { nome: "Constituição do Estado do Ceará", fonte: "https://www.al.ce.gov.br/legislativo/constituicao-do-estado-do-ceara", observacao: "Fonte estadual: baixar da Assembleia Legislativa do Ceará." },
  "ce-lei-9826-1974": { nome: "Estatuto dos Servidores Públicos Civis do Ceará (Lei 9.826/1974)", fonte: "https://belt.al.ce.gov.br", observacao: "Fonte estadual: baixar da Assembleia Legislativa do Ceará." },
  "ce-lei-12124-1993": { nome: "Estatuto da Polícia Civil de Carreira do Ceará (Lei 12.124/1993)", fonte: "https://belt.al.ce.gov.br", observacao: "Fonte estadual: baixar da Assembleia Legislativa do Ceará." },
  "ce-lc-98-2011": { nome: "Controladoria Geral de Disciplina do Ceará (LC 98/2011)", fonte: "https://belt.al.ce.gov.br", observacao: "Fonte estadual: baixar da Assembleia Legislativa do Ceará." },
  "fortaleza-lei-organica": { nome: "Lei Orgânica do Município de Fortaleza (arts. 1º a 9º e 98 a 123)", fonte: "https://www.cmfor.ce.gov.br", observacao: "Fonte municipal: baixar da Câmara Municipal de Fortaleza." },
  "fortaleza-lei-6794-1990": { nome: "Estatuto dos Servidores do Município de Fortaleza (Lei 6.794/1990)", fonte: "https://www.cmfor.ce.gov.br", observacao: "Fonte municipal: baixar da Câmara Municipal de Fortaleza." },
} as const;
type IdLei = keyof typeof LEIS;

type Topico = { nome: string; c: string; peso: number; sub?: string[]; leis?: IdLei[]; nota?: string };
type Trecho = { lei: IdLei; de: number; ate: number };

// Trechos das leis grandes (CF, CP, CPP) que cada tópico usa. Sem trecho, a lei vai inteira.
// Critério: o capítulo do tópico MAIS os artigos conexos que a banca costuma cruzar com ele
// (ex.: inquérito + juiz das garantias + art. 184; patrimônio + arrependimento posterior + hediondos).
// Quando a lei principal do tópico vai inteira (leis especiais), os trechos são só os conexos.
const T = (lei: IdLei, de: number, ate = de): Trecho => ({ lei, de, ate });
const TRECHOS: Record<string, Trecho[]> = {
  // Constituição
  "Teoria da Constituição": [T("cf88", 1, 4), T("cf88", 60)],
  "Princípios Fundamentais": [T("cf88", 1, 4)],
  "Direitos e Garantias Fundamentais": [T("cf88", 5, 17), T("cf88", 60), T("cf88", 136, 139)],
  "Direitos Sociais": [T("cf88", 6, 11)],
  Nacionalidade: [T("cf88", 12, 13), T("cf88", 5)],
  "Direitos Políticos e Partidos Políticos": [T("cf88", 14, 17)],
  "Remédios Constitucionais": [T("cf88", 5), T("cf88", 102, 105), T("cf88", 108, 109), T("cpp", 647, 667)],
  "Controle de Constitucionalidade": [T("cf88", 97, 103), T("cf88", 52), T("cf88", 125)],
  "Organização do Estado": [T("cf88", 18, 36)],
  "Administração Pública na Constituição": [T("cf88", 37, 41)],
  "Poder Legislativo e Processo Legislativo": [T("cf88", 44, 75)],
  "Poder Executivo": [T("cf88", 76, 91)],
  "Poder Judiciário": [T("cf88", 92, 126)],
  "Funções Essenciais à Justiça": [T("cf88", 127, 135)],
  "Segurança Pública na Constituição": [T("cf88", 136, 144), T("cf88", 42)],
  "Forças Armadas": [T("cf88", 142, 143)],
  "Política Urbana": [T("cf88", 182, 183)],
  "Ordem Social": [T("cf88", 193, 232)],
  "Ordem Econômica": [T("cf88", 170, 181)],
  "Direitos Humanos na Constituição e Política Nacional": [T("cf88", 1, 5), T("cf88", 109)],
  "Princípios da Administração Pública": [T("cf88", 37), T("lei-9784-1999", 2)],
  "Responsabilidade Civil do Estado": [T("cf88", 37)],
  // Código Penal
  "Aplicação da Lei Penal": [T("cp", 1, 12), T("cf88", 5)],
  "Teoria do Crime e Fato Típico": [T("cp", 13, 25)],
  "Consumação, Tentativa e Desistência": [T("cp", 14, 17)],
  "Ilicitude e Excludentes": [T("cp", 23, 25)],
  "Culpabilidade e Imputabilidade": [T("cp", 20, 28)],
  "Concurso de Pessoas": [T("cp", 29, 31), T("cp", 62)],
  "Concurso de Crimes": [T("cp", 69, 76), T("cp", 119)],
  "Penas e Medidas de Segurança": [T("cp", 32, 99)],
  "Ação Penal, Punibilidade e Prescrição": [T("cp", 100, 120)],
  "Crimes contra a Pessoa": [T("cp", 121, 154), T("lei-8072-1990", 1)],
  "Crimes contra o Patrimônio": [T("cp", 155, 183), T("cp", 16), T("lei-8072-1990", 1)],
  "Crimes contra a Dignidade Sexual": [T("cp", 213, 234), T("lei-8072-1990", 1)],
  "Crimes contra a Incolumidade Pública": [T("cp", 250, 285)],
  "Crimes contra a Paz Pública": [T("cp", 286, 288), T("lei-12850-2013", 1, 2)],
  "Crimes contra a Fé Pública": [T("cp", 289, 311)],
  "Crimes contra a Administração Pública": [T("cp", 312, 359), T("cp", 92)],
  // Código de Processo Penal (o art. 3º inclui os arts. 3º-A a 3º-F, juiz das garantias)
  "Princípios e Lei Processual Penal": [T("cpp", 1, 3), T("cf88", 5)],
  "Inquérito Policial": [T("cpp", 3), T("cpp", 4, 23), T("cpp", 28), T("cpp", 107), T("cpp", 155), T("cpp", 184)],
  "Ação Penal": [T("cpp", 24, 62), T("cp", 100, 106)],
  "Provas: Disposições Gerais e Provas Ilícitas": [T("cpp", 155, 157), T("cf88", 5)],
  "Corpo de Delito, Cadeia de Custódia e Perícias": [T("cpp", 158, 184), T("cpp", 6)],
  "Interrogatório, Confissão, Ofendido e Testemunhas": [T("cpp", 185, 239)],
  "Busca e Apreensão": [T("cpp", 240, 250), T("cf88", 5)],
  "Prisão em Flagrante": [T("cpp", 282, 310), T("cf88", 5)],
  "Prisão Preventiva e Medidas Cautelares": [T("cpp", 282, 320)],
  "Liberdade Provisória e Fiança": [T("cpp", 310, 350), T("cf88", 5)],
  "Habeas Corpus": [T("cpp", 647, 667), T("cf88", 5), T("cf88", 102, 105)],
  "Crimes de Responsabilidade dos Funcionários Públicos": [T("cpp", 513, 518)],
  "Revisão Criminal e Execução Penal": [T("cpp", 621, 631)],
  // Leis especiais (vão inteiras): só os conexos
  "Lei de Drogas": [T("cf88", 5), T("cf88", 243), T("lei-8072-1990", 2)],
  "Crimes Hediondos": [T("cf88", 5)],
  "Lei de Tortura": [T("cf88", 5)],
  "Crimes de Racismo": [T("cf88", 5)],
  "Estatuto do Desarmamento": [T("lei-8072-1990", 1)],
  "Lei Maria da Penha": [T("cp", 121), T("cp", 129), T("cp", 147)],
};
type Disciplina = { nome: string; meta: number; topicos: Topico[]; nota?: string };

// c = concursos onde o tópico aparece (P = PCCE, G = Guarda Municipal de Fortaleza, C = CFO PMCE).
// meta da disciplina: mais peso para Português, Constitucional, Penal e Processo Penal.
const DISCIPLINAS: Disciplina[] = [
  {
    nome: "Língua Portuguesa",
    meta: 3000,
    topicos: [
      { nome: "Interpretação de Texto", c: "PGC", peso: 5, sub: ["Compreensão e interpretação de textos de gêneros variados", "Estruturação do texto e dos parágrafos", "Inferência e ideia central"] },
      { nome: "Tipologia e Gêneros Textuais", c: "P", peso: 1.5, sub: ["Tipos textuais", "Gêneros textuais"] },
      { nome: "Coesão e Coerência", c: "PGC", peso: 3, sub: ["Referenciação: pronomes e expressões referenciais", "Substituição e repetição", "Conectores, nexos e operadores sequenciais"] },
      { nome: "Significação de Palavras e Expressões", c: "GC", peso: 1.5, sub: ["Significação contextual", "Sinônimos, antônimos e polissemia"] },
      { nome: "Reescrita de Frases e Equivalência de Estruturas", c: "PGC", peso: 3, sub: ["Substituição de palavras e trechos", "Retextualização e níveis de formalidade", "Equivalência e transformação de estruturas"] },
      { nome: "Ortografia", c: "PGC", peso: 1.5, sub: ["Emprego das letras", "Hífen"] },
      { nome: "Acentuação Gráfica", c: "PGC", peso: 1.5 },
      { nome: "Estrutura e Formação de Palavras", c: "GC", peso: 1 },
      { nome: "Classes de Palavras", c: "GC", peso: 2.5, sub: ["Funções das classes de palavras", "Flexão nominal", "Flexão verbal"] },
      { nome: "Tempos e Modos Verbais", c: "PGC", peso: 2, sub: ["Emprego dos tempos e modos", "Correlação verbal"] },
      { nome: "Pronomes: Emprego, Tratamento e Colocação", c: "PGC", peso: 2.5, sub: ["Emprego dos pronomes", "Formas de tratamento", "Colocação dos pronomes átonos"] },
      { nome: "Sintaxe: Coordenação e Subordinação", c: "PGC", peso: 3, sub: ["Termos da oração", "Orações coordenadas", "Orações subordinadas"] },
      { nome: "Pontuação", c: "PGC", peso: 2.5 },
      { nome: "Concordância Verbal", c: "PGC", peso: 1.5 },
      { nome: "Concordância Nominal", c: "PGC", peso: 1 },
      { nome: "Regência Verbal", c: "GC", peso: 1.2 },
      { nome: "Regência Nominal", c: "GC", peso: 0.8 },
      { nome: "Crase", c: "P", peso: 1.8 },
    ],
  },
  {
    nome: "Raciocínio Lógico",
    meta: 800,
    nota: "No CFO aparece como 'Matemática e Raciocínio Lógico', com o mesmo conteúdo.",
    topicos: [
      { nome: "Estruturas Lógicas e Relações Arbitrárias", c: "GC", peso: 3, sub: ["Dedução a partir de relações entre pessoas, lugares e objetos", "Avaliação das condições de uma estrutura"] },
      { nome: "Lógica de Argumentação e Raciocínio Verbal", c: "GC", peso: 2 },
      { nome: "Raciocínio Sequencial, Espacial e Temporal", c: "GC", peso: 2, sub: ["Sequências lógicas", "Orientação espacial e temporal", "Formação de conceitos e discriminação de elementos"] },
      { nome: "Conjuntos", c: "GC", peso: 2 },
      { nome: "Problemas Aritméticos, Geométricos e Matriciais", c: "GC", peso: 3 },
    ],
  },
  {
    nome: "Informática",
    meta: 1200,
    topicos: [
      { nome: "Hardware", c: "G", peso: 1.5, sub: ["Dispositivos de armazenamento", "Memórias", "Periféricos"] },
      { nome: "Sistemas Operacionais Windows e Linux", c: "PG", peso: 3, sub: ["Pastas, diretórios, arquivos e atalhos", "Área de trabalho e área de transferência", "Manipulação de arquivos e pastas"] },
      { nome: "Editor de Textos (Writer)", c: "PG", peso: 2, sub: ["Edição e formatação", "Tabelas, índices e numeração de páginas"] },
      { nome: "Planilhas Eletrônicas (Calc)", c: "PG", peso: 2.5, sub: ["Células, linhas e colunas", "Fórmulas e funções", "Gráficos e classificação de dados"] },
      { nome: "Editor de Apresentações (Impress)", c: "P", peso: 1 },
      { nome: "Correio Eletrônico", c: "PG", peso: 1 },
      { nome: "Internet e Navegadores", c: "PG", peso: 2, sub: ["URL, links e sites", "Intranet e extranet", "Protocolos e serviços", "Busca, nuvem e redes sociais"] },
      { nome: "Ferramentas de Reunião On-line", c: "G", peso: 0.7 },
      { nome: "Segurança da Informação", c: "PG", peso: 3, sub: ["Princípios de segurança", "Assinatura digital", "Backup", "Antivírus e firewall", "Malwares e ataques"] },
      { nome: "Extensões de Arquivos", c: "G", peso: 0.6 },
      { nome: "Criptomoedas", c: "P", peso: 0.6 },
    ],
  },
  {
    nome: "Direito Constitucional",
    meta: 2400,
    topicos: [
      { nome: "Teoria da Constituição", c: "P", peso: 1.5, sub: ["Conceito, conteúdo, objeto e classificação", "Poder constituinte", "Supremacia e hermenêutica"], leis: ["cf88"] },
      { nome: "Princípios Fundamentais", c: "PG", peso: 2, sub: ["Preâmbulo", "Arts. 1º a 4º"], leis: ["cf88"] },
      { nome: "Direitos e Garantias Fundamentais", c: "PGC", peso: 4.5, sub: ["Direitos e deveres individuais e coletivos (art. 5º)"], leis: ["cf88"] },
      { nome: "Direitos Sociais", c: "PGC", peso: 1.5, sub: ["Arts. 6º a 11"], leis: ["cf88"] },
      { nome: "Nacionalidade", c: "PG", peso: 1, leis: ["cf88"] },
      { nome: "Direitos Políticos e Partidos Políticos", c: "PGC", peso: 1.5, sub: ["Arts. 14 a 17"], leis: ["cf88"] },
      { nome: "Remédios Constitucionais", c: "P", peso: 2, sub: ["Habeas corpus", "Habeas data", "Mandado de segurança", "Mandado de injunção", "Ação popular"], leis: ["cf88"] },
      { nome: "Aplicabilidade das Normas Constitucionais", c: "P", peso: 1 },
      { nome: "Controle de Constitucionalidade", c: "P", peso: 1.5, sub: ["Controle difuso e concentrado", "ADI, ADC, ADPF e reclamação"], leis: ["cf88"] },
      { nome: "Organização do Estado", c: "PGC", peso: 2, sub: ["União, Estados, DF, Municípios e Territórios (arts. 18 a 36)"], leis: ["cf88"] },
      { nome: "Administração Pública na Constituição", c: "PG", peso: 2, sub: ["Disposições gerais (art. 37)", "Servidores públicos (arts. 39 a 41)"], leis: ["cf88"] },
      { nome: "Poder Legislativo e Processo Legislativo", c: "PC", peso: 1.5, leis: ["cf88"] },
      { nome: "Poder Executivo", c: "PC", peso: 1, sub: ["Atribuições do Presidente e dos Ministros"], leis: ["cf88"] },
      { nome: "Poder Judiciário", c: "PC", peso: 1.5, sub: ["STF", "STJ", "CNJ", "Súmulas vinculantes e repercussão geral"], leis: ["cf88"] },
      { nome: "Funções Essenciais à Justiça", c: "PC", peso: 1, leis: ["cf88"] },
      { nome: "Segurança Pública na Constituição", c: "PGC", peso: 3, sub: ["Art. 144", "Defesa do Estado e das instituições democráticas"], leis: ["cf88"] },
      { nome: "Forças Armadas", c: "C", peso: 0.7, leis: ["cf88"] },
      { nome: "Política Urbana", c: "G", peso: 0.5, sub: ["Arts. 182 e 183"], leis: ["cf88"] },
      { nome: "Ordem Social", c: "PG", peso: 1.2, sub: ["Família, criança, adolescente, jovem e idoso (arts. 226 a 230)", "Seguridade social", "Meio ambiente", "Índios"], leis: ["cf88"] },
      { nome: "Ordem Econômica", c: "P", peso: 0.5, sub: ["Princípios gerais da atividade econômica"], leis: ["cf88"] },
    ],
  },
  {
    nome: "Direitos Humanos",
    meta: 800,
    topicos: [
      { nome: "Teoria dos Direitos Humanos", c: "PGC", peso: 3, sub: ["Conceito e fundamentação", "Características", "Gerações ou dimensões", "Dignidade da pessoa humana"] },
      { nome: "Direitos Humanos na Constituição e Política Nacional", c: "C", peso: 1.5, sub: ["Direitos humanos na CF/88", "Programa Nacional de Direitos Humanos", "Responsabilidade do Estado"], leis: ["cf88"] },
      { nome: "Violência de Gênero e Doméstica", c: "C", peso: 1, leis: ["lei-11340-2006"] },
      { nome: "Igualdade Racial e Combate à Discriminação", c: "PC", peso: 1.5, sub: ["Estatuto da Igualdade Racial", "Homofobia equiparada ao crime de racismo (ADO 26)"], leis: ["lei-12288-2010", "lei-7716-1989"] },
      { nome: "Pessoa com Deficiência", c: "PC", peso: 1, leis: ["lei-13146-2015"] },
      { nome: "Tortura e Violência de Estado", c: "C", peso: 1, sub: ["Direito das vítimas de violência de Estado", "Tortura"], leis: ["lei-9455-1997"] },
    ],
  },
  {
    nome: "Direito Administrativo",
    meta: 1500,
    topicos: [
      { nome: "Estado, Governo e Administração Pública", c: "PG", peso: 1.5, sub: ["Conceitos, elementos e poderes", "Natureza, fins e princípios"] },
      { nome: "Princípios da Administração Pública", c: "PGC", peso: 2.5, sub: ["Legalidade, impessoalidade, moralidade, publicidade e eficiência", "Conceito e fontes do Direito Administrativo"], leis: ["cf88"] },
      { nome: "Modelos de Administração e Governança", c: "P", peso: 0.6, sub: ["Patrimonialista, burocrático e gerencial", "Eficiência, eficácia e efetividade", "Governança e accountability"] },
      { nome: "Organização Administrativa", c: "PC", peso: 2, sub: ["Administração direta e indireta", "Centralização, descentralização, concentração e desconcentração", "Agências executivas e reguladoras"] },
      { nome: "Atos Administrativos", c: "PG", peso: 4, sub: ["Conceito, requisitos e atributos", "Classificação e espécies", "Anulação, revogação, cassação e convalidação", "Vícios e teoria das nulidades", "Teoria dos motivos determinantes", "Mérito e discricionariedade", "Prescrição"] },
      { nome: "Poderes Administrativos", c: "P", peso: 2, sub: ["Hierárquico", "Disciplinar", "Regulamentar", "De polícia", "Uso e abuso do poder"] },
      { nome: "Licitações e Contratos Administrativos", c: "PC", peso: 1.5, leis: ["lei-14133-2021"] },
      { nome: "Serviços Públicos e Delegação", c: "C", peso: 0.6, sub: ["Concessão e permissão", "Convênios e consórcios"] },
      { nome: "Controle da Administração Pública", c: "P", peso: 1, sub: ["Controle administrativo, judicial e legislativo"] },
      { nome: "Responsabilidade Civil do Estado", c: "P", peso: 1.5, sub: ["Evolução doutrinária", "Atos comissivos e omissivos", "Excludentes e nexo de causalidade"], leis: ["cf88"] },
      { nome: "Improbidade Administrativa", c: "PC", peso: 2, leis: ["lei-8429-1992"], nota: "Usar a redação dada pela Lei 14.230/2021 (dolo obrigatório, novas regras de prescrição)." },
      { nome: "Processo Administrativo", c: "P", peso: 0.6, leis: ["lei-9784-1999"] },
      { nome: "Lei Geral de Proteção de Dados", c: "P", peso: 1, leis: ["lei-13709-2018"] },
    ],
  },
  {
    nome: "Administração Pública e Ética",
    meta: 400,
    nota: "Só no CFO PMCE.",
    topicos: [
      { nome: "Organizações Formais e Estrutura Organizacional", c: "C", peso: 1, sub: ["Tipos de estrutura", "Critérios de departamentalização"] },
      { nome: "Processo Organizacional", c: "C", peso: 1, sub: ["Planejamento, direção, comunicação, controle e avaliação"] },
      { nome: "Gestão de Processos e de Contratos", c: "C", peso: 0.7 },
      { nome: "Planejamento Estratégico", c: "C", peso: 0.7 },
      { nome: "Relações Humanas no Trabalho", c: "C", peso: 0.6 },
      { nome: "Ética e Cidadania no Serviço Público", c: "C", peso: 1 },
    ],
  },
  {
    nome: "Direito Penal",
    meta: 2800,
    topicos: [
      { nome: "Aplicação da Lei Penal", c: "PC", peso: 2.5, sub: ["Legalidade e anterioridade", "Lei penal no tempo e no espaço", "Tempo e lugar do crime", "Territorialidade e extraterritorialidade", "Contagem de prazo e frações não computáveis", "Interpretação, analogia e conflito aparente de normas"], leis: ["cp"] },
      { nome: "Teoria do Crime e Fato Típico", c: "PGC", peso: 3, sub: ["Conduta, resultado e nexo causal", "Tipicidade", "Dolo e culpa", "Crimes omissivos", "Imputação objetiva", "Arts. 13 a 25 do CP"], leis: ["cp"] },
      { nome: "Consumação, Tentativa e Desistência", c: "PGC", peso: 1.5, sub: ["Crime consumado e tentado", "Desistência voluntária e arrependimento eficaz", "Arrependimento posterior", "Crime impossível"], leis: ["cp"] },
      { nome: "Ilicitude e Excludentes", c: "PGC", peso: 2, sub: ["Legítima defesa", "Estado de necessidade", "Estrito cumprimento do dever legal e exercício regular de direito", "Excesso punível"], leis: ["cp"] },
      { nome: "Culpabilidade e Imputabilidade", c: "PGC", peso: 1.5, leis: ["cp"] },
      { nome: "Concurso de Pessoas", c: "PC", peso: 1.2, leis: ["cp"] },
      { nome: "Concurso de Crimes", c: "PC", peso: 1, leis: ["cp"] },
      { nome: "Penas e Medidas de Segurança", c: "C", peso: 1.5, sub: ["Espécies e aplicação da pena", "Sursis e livramento condicional", "Efeitos da condenação e reabilitação"], leis: ["cp"] },
      { nome: "Ação Penal, Punibilidade e Prescrição", c: "PC", peso: 1.5, leis: ["cp"] },
      { nome: "Crimes contra a Pessoa", c: "PGC", peso: 3, leis: ["cp"] },
      { nome: "Crimes contra o Patrimônio", c: "PGC", peso: 3, leis: ["cp"] },
      { nome: "Crimes contra a Dignidade Sexual", c: "PGC", peso: 1.8, sub: ["Arts. 213 a 218-C"], leis: ["cp"] },
      { nome: "Crimes contra a Incolumidade Pública", c: "P", peso: 0.6, leis: ["cp"] },
      { nome: "Crimes contra a Paz Pública", c: "PC", peso: 0.8, leis: ["cp"] },
      { nome: "Crimes contra a Fé Pública", c: "PGC", peso: 1.2, leis: ["cp"] },
      { nome: "Crimes contra a Administração Pública", c: "PGC", peso: 2.5, sub: ["Arts. 312 a 337-A"], leis: ["cp"] },
      { nome: "Uso da Força e Funções da Polícia", c: "P", peso: 0.5, sub: ["Política criminal e ordem pública"] },
      { nome: "Jurisprudência dos Tribunais Superiores em Matéria Penal", c: "P", peso: 0.6, nota: "Só súmulas e teses consolidadas e citadas pelo número; na dúvida, não gerar." },
    ],
  },
  {
    nome: "Direito Processual Penal",
    meta: 2000,
    topicos: [
      { nome: "Princípios e Lei Processual Penal", c: "PC", peso: 1.5, sub: ["Princípios, sistemas processuais", "Lei processual no tempo, no espaço e em relação às pessoas", "Disposições constitucionais aplicáveis"], leis: ["cpp", "cf88"] },
      { nome: "Inquérito Policial", c: "PGC", peso: 4, sub: ["Natureza, características e finalidade", "Instauração, notitia e delatio criminis", "Indiciamento", "Conclusão e prazos", "Arts. 4º a 23 do CPP", "Juiz das garantias (arts. 3º-A a 3º-F)", "Exame de corpo de delito (art. 184)"], leis: ["cpp", "lei-12830-2013"] },
      { nome: "Ação Penal", c: "C", peso: 1, leis: ["cpp"] },
      { nome: "Provas: Disposições Gerais e Provas Ilícitas", c: "PG", peso: 1.5, sub: ["Arts. 155 a 157 do CPP"], leis: ["cpp"] },
      { nome: "Corpo de Delito, Cadeia de Custódia e Perícias", c: "PG", peso: 1.8, sub: ["Arts. 158 a 184 do CPP"], leis: ["cpp"] },
      { nome: "Interrogatório, Confissão, Ofendido e Testemunhas", c: "P", peso: 1.8, sub: ["Reconhecimento de pessoas e coisas", "Acareação", "Documentos e indícios"], leis: ["cpp"] },
      { nome: "Busca e Apreensão", c: "PG", peso: 1.2, sub: ["Arts. 240 a 250 do CPP"], leis: ["cpp"] },
      { nome: "Prisão em Flagrante", c: "PGC", peso: 2.5, sub: ["Arts. 282 a 310 do CPP"], leis: ["cpp"] },
      { nome: "Prisão Preventiva e Medidas Cautelares", c: "PGC", peso: 1.8, leis: ["cpp"] },
      { nome: "Prisão Temporária", c: "PC", peso: 1, leis: ["lei-7960-1989"] },
      { nome: "Liberdade Provisória e Fiança", c: "GC", peso: 1, leis: ["cpp"] },
      { nome: "Habeas Corpus", c: "C", peso: 0.8, leis: ["cpp", "cf88"] },
      { nome: "Crimes de Responsabilidade dos Funcionários Públicos", c: "C", peso: 0.4, sub: ["Processo e julgamento"], leis: ["cpp"] },
      { nome: "Revisão Criminal e Execução Penal", c: "P", peso: 1, leis: ["cpp", "lei-7210-1984"] },
      { nome: "Interceptação Telefônica", c: "P", peso: 1, leis: ["lei-9296-1996"] },
      { nome: "Organização Criminosa", c: "P", peso: 1.2, sub: ["Colaboração premiada e acordo de leniência"], leis: ["lei-12850-2013"] },
      { nome: "Investigação pelo Delegado e pelo Ministério Público", c: "P", peso: 0.6, leis: ["lei-12830-2013"] },
      { nome: "Identificação Criminal", c: "P", peso: 0.5, leis: ["lei-12037-2009"] },
      { nome: "Jurisprudência dos Tribunais Superiores em Processo Penal", c: "P", peso: 0.5, nota: "Só súmulas e teses consolidadas e citadas pelo número; na dúvida, não gerar." },
    ],
  },
  {
    nome: "Legislação Penal Especial",
    meta: 2700,
    topicos: [
      { nome: "Lei de Drogas", c: "PGC", peso: 3, leis: ["lei-11343-2006"] },
      { nome: "Estatuto do Desarmamento", c: "PGC", peso: 2.5, leis: ["lei-10826-2003"] },
      { nome: "Lei Maria da Penha", c: "PGC", peso: 2.5, leis: ["lei-11340-2006"] },
      { nome: "Abuso de Autoridade", c: "PGC", peso: 2.5, leis: ["lei-13869-2019"] },
      { nome: "Crimes Hediondos", c: "PC", peso: 1.5, leis: ["lei-8072-1990"] },
      { nome: "Lei de Tortura", c: "PC", peso: 1.2, leis: ["lei-9455-1997"] },
      { nome: "Crimes Ambientais", c: "PGC", peso: 1.2, leis: ["lei-9605-1998"] },
      { nome: "Crimes de Racismo", c: "PG", peso: 1, leis: ["lei-7716-1989"] },
      { nome: "Estatuto da Criança e do Adolescente", c: "PG", peso: 1.5, leis: ["lei-8069-1990"] },
      { nome: "Código de Trânsito Brasileiro", c: "PG", peso: 1.5, sub: ["Crimes de trânsito", "Infrações e medidas administrativas"], leis: ["lei-9503-1997"] },
      { nome: "Estatuto da Pessoa Idosa", c: "P", peso: 0.7, leis: ["lei-10741-2003"] },
      { nome: "Juizados Especiais Criminais", c: "P", peso: 1, leis: ["lei-9099-1995"] },
      { nome: "Pacote Anticrime", c: "P", peso: 0.8, leis: ["lei-13964-2019"] },
      { nome: "Lavagem de Dinheiro", c: "P", peso: 0.6, leis: ["lei-9613-1998"] },
      { nome: "Contravenções Penais", c: "P", peso: 0.6, leis: ["dl-3688-1941"] },
      { nome: "Lei Antiterrorismo", c: "P", peso: 0.4, leis: ["lei-13260-2016"] },
      { nome: "Crimes contra a Economia Popular e a Ordem Tributária", c: "P", peso: 0.5, leis: ["lei-1521-1951", "lei-8137-1990"] },
      { nome: "Crimes contra as Relações de Consumo", c: "P", peso: 0.4, leis: ["lei-8078-1990", "lei-8137-1990"] },
      { nome: "Crimes Eleitorais", c: "P", peso: 0.4, leis: ["lei-4737-1965"] },
      { nome: "Proteção a Vítimas e Testemunhas", c: "P", peso: 0.4, leis: ["lei-9807-1999"] },
      { nome: "Crimes no Esporte (Lei Geral do Esporte)", c: "PC", peso: 0.3, leis: ["lei-14597-2023"], nota: "O Estatuto do Torcedor citado nos editais foi revogado pela Lei 14.597/2023." },
    ],
  },
  {
    nome: "Direito Penal Militar",
    meta: 700,
    nota: "Só no CFO PMCE (Direito Penal Militar e Processo Penal Militar).",
    topicos: [
      { nome: "Aplicação da Lei Penal Militar", c: "C", peso: 1.5, leis: ["cpm"] },
      { nome: "Crime Militar: Conceito e Classificação", c: "C", peso: 2, sub: ["Crimes militares em tempo de paz", "Propriamente e impropriamente militares"], leis: ["cpm"] },
      { nome: "Imputabilidade e Concurso de Agentes no CPM", c: "C", peso: 0.8, leis: ["cpm"] },
      { nome: "Penas e Medidas de Segurança no CPM", c: "C", peso: 1, sub: ["Aplicação da pena", "Suspensão condicional e livramento", "Penas acessórias e efeitos da condenação"], leis: ["cpm"] },
      { nome: "Ação Penal Militar e Extinção da Punibilidade", c: "C", peso: 0.8, leis: ["cpm", "cppm"] },
      { nome: "Crimes Militares contra a Pessoa e o Patrimônio", c: "C", peso: 1, leis: ["cpm"] },
      { nome: "Crimes contra a Administração Militar", c: "C", peso: 1, leis: ["cpm"] },
      { nome: "Crimes em Tempo de Guerra", c: "C", peso: 0.4, leis: ["cpm"] },
    ],
  },
  {
    nome: "Legislação Estadual e Municipal",
    meta: 1000,
    topicos: [
      { nome: "Constituição do Ceará: Segurança Pública e Defesa Civil", c: "P", peso: 1, leis: ["ce-constituicao"] },
      { nome: "Estatuto dos Servidores Civis do Ceará", c: "P", peso: 1.2, leis: ["ce-lei-9826-1974"] },
      { nome: "Estatuto da Polícia Civil do Ceará", c: "P", peso: 1.5, leis: ["ce-lei-12124-1993"] },
      { nome: "Controladoria Geral de Disciplina do Ceará", c: "P", peso: 0.8, leis: ["ce-lc-98-2011"] },
      { nome: "Estatuto Geral das Guardas Municipais", c: "G", peso: 1.5, leis: ["lei-13022-2014"] },
      { nome: "Lei Orgânica de Fortaleza", c: "G", peso: 1, sub: ["Arts. 1º a 9º", "Arts. 98 a 123"], leis: ["fortaleza-lei-organica"] },
      { nome: "Estatuto dos Servidores de Fortaleza", c: "G", peso: 1, leis: ["fortaleza-lei-6794-1990"] },
    ],
  },
  {
    nome: "Segurança Pública",
    meta: 300,
    nota: "Só no CFO PMCE.",
    topicos: [
      { nome: "Segurança Pública e Direitos Humanos", c: "C", peso: 1, sub: ["Desarmamento", "Combate a preconceitos de gênero, étnico, racial, geracional e de orientação sexual"] },
      { nome: "Instituições de Segurança Pública e Sistema Prisional", c: "C", peso: 1 },
      { nome: "Crime Organizado e Corrupção Policial", c: "C", peso: 0.8 },
      { nome: "Participação Social e Acesso à Justiça", c: "C", peso: 0.6, sub: ["Redes sociais e comunitárias", "Valorização dos espaços públicos", "Participação da sociedade civil"] },
      { nome: "PRONASCI", c: "C", peso: 0.6, leis: ["lei-11530-2007"] },
    ],
  },
  {
    nome: "História e Geografia do Ceará",
    meta: 400,
    topicos: [
      { nome: "Ceará Colonial", c: "C", peso: 1, sub: ["Ocupação do território e disputas com nativos", "Sesmarias e economia pecuária"] },
      { nome: "Ceará Imperial", c: "C", peso: 1, sub: ["Confederação do Equador", "Economia do algodão", "Escravidão e abolição no Ceará"] },
      { nome: "Ceará na República", c: "C", peso: 1.5, sub: ["República Velha: coronelismo, movimentos religiosos e banditismo", "1930 a 1964: Estado Novo, indústria da seca, DNOCS e SUDENE", "Governos militares e Nova República"] },
      { nome: "Fortaleza: Geografia", c: "G", peso: 1, sub: ["Localização e limites", "Hidrografia", "Clima e vegetação", "Ocupação geográfica"] },
      { nome: "Fortaleza: História, População e Cultura", c: "G", peso: 1.2, sub: ["História da cidade", "População", "Aspectos políticos, administrativos e econômicos", "Pontos turísticos e patrimônio cultural"] },
    ],
  },
];

// Fora da geração por IA: depende de fatos dos últimos meses e envelhece rápido.
const EXCLUIDAS = [
  {
    nome: "Atualidades",
    concursos: ["gm-fortaleza", "cfo-pmce"],
    motivo: "O edital cobra fatos dos últimos 6 meses antes da prova: a IA não tem esses fatos e a questão envelhece. Melhor feito à mão perto da prova.",
  },
];

// Tópico que cai em mais de um concurso pesa mais (aparece mais nas provas).
const multiplicador = (n: number) => 1 + 0.2 * (n - 1);
const slug = (t: string) =>
  t
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

// Metas em múltiplos de 10 (cada pedido à IA gera 10 questões), mínimo de 20 por tópico.
const disciplinas = DISCIPLINAS.map((d) => {
  const pesos = d.topicos.map((t) => t.peso * multiplicador(t.c.length));
  const soma = pesos.reduce((a, b) => a + b, 0);
  const topicos = d.topicos.map((t, i) => ({
    id: `${slug(d.nome)}--${slug(t.nome)}`,
    nome: t.nome,
    concursos: [...t.c].map((s) => CONCURSOS[s as Sigla].id),
    meta: Math.max(20, Math.round(((d.meta * pesos[i]!) / soma) / 10) * 10),
    subtopicos: t.sub ?? [],
    leis: t.leis ?? [],
    trechos: TRECHOS[t.nome] ?? [],
    ...(t.nota ? { nota: t.nota } : {}),
  }));
  return {
    nome: d.nome,
    meta: topicos.reduce((s, t) => s + t.meta, 0),
    concursos: [...new Set(topicos.flatMap((t) => t.concursos))],
    ...(d.nota ? { nota: d.nota } : {}),
    topicos,
  };
});

// Tópico comum a concursos de formatos diferentes: a meta é dividida na proporção dos concursos
// (ex.: PCCE + GMF + CFO = 2/3 IDECAN com 4 alternativas e 1/3 Vunesp com 5).
for (const d of disciplinas) {
  for (const t of d.topicos as (typeof d.topicos[number] & { formatos?: unknown })[]) {
    const porBanca = new Map<string, { banca: string; alternativas: number; concursos: string[] }>();
    for (const sigla of Object.keys(CONCURSOS) as Sigla[]) {
      const c = CONCURSOS[sigla];
      if (!t.concursos.includes(c.id)) continue;
      const chave = `${c.banca}-${c.alternativas}`;
      const f = porBanca.get(chave) ?? { banca: c.banca, alternativas: c.alternativas, concursos: [] };
      f.concursos.push(c.id);
      porBanca.set(chave, f);
    }
    const lista = [...porBanca.values()];
    let restante = t.meta;
    t.formatos = lista.map((f, i) => {
      const meta = i === lista.length - 1 ? restante : Math.round((t.meta * f.concursos.length) / t.concursos.length / 10) * 10;
      restante -= meta;
      return { ...f, meta };
    });
  }
}

const usadas = new Set(disciplinas.flatMap((d) => d.topicos.flatMap((t) => t.leis)));
const taxonomia = {
  versao: 1,
  fontes: [
    "docs/1622156158EDITAL_VERTICALIZADO_POLICIACIVIL_CE_2021.pdf",
    "docs/EDITAL-VERTICALIZADO-GMF.pdf",
    "docs/EDITAL_VERTICALIZADO_CFO_PMCE_LEXCURSOS.pdf",
  ],
  concursos: Object.values(CONCURSOS),
  meta_total: disciplinas.reduce((s, d) => s + d.meta, 0),
  disciplinas,
  excluidas: EXCLUIDAS,
  leis: Object.fromEntries(Object.entries(LEIS).filter(([id]) => usadas.has(id as IdLei))),
};

writeFileSync("data/taxonomia.json", JSON.stringify(taxonomia, null, 2) + "\n");
console.log(`data/taxonomia.json: ${disciplinas.length} disciplinas, ${disciplinas.reduce((s, d) => s + d.topicos.length, 0)} tópicos, meta ${taxonomia.meta_total} questões, ${Object.keys(taxonomia.leis).length} leis`);
for (const d of disciplinas) console.log(`  ${String(d.meta).padStart(5)}  ${d.nome} (${d.topicos.length} tópicos)`);
