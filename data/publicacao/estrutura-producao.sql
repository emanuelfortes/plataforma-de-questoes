-- Estrutura aplicada na produção (Turso) em 2026-10-19, numa transação.
-- Só acrescenta: nenhuma tabela existente foi recriada e nenhum dado foi apagado.

CREATE TABLE `flashcards_revisao` (
	`id` integer PRIMARY KEY NOT NULL,
	`codigo` text NOT NULL,
	`status` text DEFAULT 'pendente_revisao' NOT NULL,
	`origem` text DEFAULT 'ia' NOT NULL,
	`status_auditoria` text NOT NULL,
	`disciplina` text NOT NULL,
	`assunto` text NOT NULL,
	`subtopico` text,
	`topico_taxonomia` text NOT NULL,
	`frente` text NOT NULL,
	`verso` text NOT NULL,
	`lei_referencia` text,
	`data_corte_legislativo` text NOT NULL,
	`auditoria` text NOT NULL,
	`lote` text NOT NULL,
	`criado_em` integer NOT NULL,
	`revisado_em` integer,
	`revisado_por` text,
	`motivo_revisao` text
);

CREATE UNIQUE INDEX `flashcards_revisao_codigo_unique` ON `flashcards_revisao` (`codigo`);

CREATE INDEX `flashcards_revisao_status` ON `flashcards_revisao` (`status`,`topico_taxonomia`);

CREATE TABLE `questoes_revisao` (
	`id` integer PRIMARY KEY NOT NULL,
	`codigo` text NOT NULL,
	`status` text DEFAULT 'pendente_revisao' NOT NULL,
	`origem` text DEFAULT 'ia' NOT NULL,
	`status_auditoria` text NOT NULL,
	`disciplina` text NOT NULL,
	`assunto` text NOT NULL,
	`subtopico` text,
	`topico_taxonomia` text NOT NULL,
	`concursos` text NOT NULL,
	`banca` text NOT NULL,
	`cargo` text NOT NULL,
	`dificuldade` integer NOT NULL,
	`enunciado` text NOT NULL,
	`alternativas` text NOT NULL,
	`gabarito` text NOT NULL,
	`comentario` text NOT NULL,
	`analise_alternativas` text NOT NULL,
	`fundamento_legal` text,
	`fundamento_jurisprudencial` text,
	`observacao_temporal` text,
	`pegadinha` text,
	`destaques` text,
	`tipo_cobranca` text,
	`exigencia_cognitiva` text,
	`palavras_chave` text,
	`lei_referencia` text,
	`data_corte_legislativo` text NOT NULL,
	`auditoria` text NOT NULL,
	`lote` text NOT NULL,
	`criado_em` integer NOT NULL,
	`revisado_em` integer
, `revisado_por` text, `motivo_revisao` text, `comentario_final` text);

CREATE UNIQUE INDEX `questoes_revisao_codigo_unique` ON `questoes_revisao` (`codigo`);

CREATE INDEX `questoes_revisao_status` ON `questoes_revisao` (`status`,`topico_taxonomia`);

CREATE TABLE `reportes` (
	`id` integer PRIMARY KEY NOT NULL,
	`tipo` text NOT NULL,
	`item_id` integer NOT NULL,
	`usuario_id` text NOT NULL,
	`motivo` text NOT NULL,
	`situacao` text DEFAULT 'aberto' NOT NULL,
	`criado_em` integer NOT NULL,
	`resolvido_em` integer
);

CREATE INDEX `reportes_situacao` ON `reportes` (`situacao`,`criado_em`);

CREATE INDEX `reportes_usuario` ON `reportes` (`usuario_id`,`criado_em`);

ALTER TABLE `questoes` ADD COLUMN `origem` TEXT;

ALTER TABLE `questoes` ADD COLUMN `topico_taxonomia` TEXT;

ALTER TABLE `questoes` ADD COLUMN `subtopico` TEXT;

ALTER TABLE `questoes` ADD COLUMN `lei_referencia` TEXT;

ALTER TABLE `questoes` ADD COLUMN `suspensa` INTEGER DEFAULT false NOT NULL;

CREATE INDEX `questoes_origem_topico` ON `questoes` (`origem`,`topico_taxonomia`);

ALTER TABLE `flashcards` ADD COLUMN `suspensa` INTEGER DEFAULT false NOT NULL;

ALTER TABLE `flashcards` ADD COLUMN `origem` TEXT;

ALTER TABLE `flashcards` ADD COLUMN `topico_taxonomia` TEXT;

ALTER TABLE `flashcards` ADD COLUMN `lei_referencia` TEXT;
