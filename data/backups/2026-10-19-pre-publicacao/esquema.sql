-- index assinaturas_usuario
CREATE INDEX `assinaturas_usuario` ON `assinaturas` (`usuario_id`,`atualizada_em`);

-- index assuntos_disciplina_nome
CREATE UNIQUE INDEX `assuntos_disciplina_nome` ON `assuntos` (`disciplina_id`,`nome`);

-- index disciplinas_nome_unique
CREATE UNIQUE INDEX `disciplinas_nome_unique` ON `disciplinas` (`nome`);

-- index flashcards_assunto_id
CREATE INDEX `flashcards_assunto_id` ON `flashcards` (`assunto_id`,`id`);

-- index flashcards_codigo_unique
CREATE UNIQUE INDEX `flashcards_codigo_unique` ON `flashcards` (`codigo`);

-- index flashcards_disciplina_id
CREATE INDEX `flashcards_disciplina_id` ON `flashcards` (`disciplina_id`,`id`);

-- index pagamentos_assinatura
CREATE INDEX `pagamentos_assinatura` ON `pagamentos` (`assinatura_id`);

-- index pagamentos_data
CREATE INDEX `pagamentos_data` ON `pagamentos` (`cobrado_em`);

-- index questoes_assunto_ordem
CREATE INDEX `questoes_assunto_ordem` ON `questoes` (`assunto_id`,`ordem`);

-- index questoes_codigo_unique
CREATE UNIQUE INDEX `questoes_codigo_unique` ON `questoes` (`codigo`);

-- index questoes_disciplina_ordem
CREATE INDEX `questoes_disciplina_ordem` ON `questoes` (`disciplina_id`,`ordem`);

-- index questoes_ordem
CREATE INDEX `questoes_ordem` ON `questoes` (`ordem`);

-- index rate_limit_key_unique
CREATE UNIQUE INDEX `rate_limit_key_unique` ON `rate_limit` (`key`);

-- index respostas_usuario_data
CREATE INDEX `respostas_usuario_data` ON `respostas` (`usuario_id`,`respondida_em`);

-- index revisoes_usuario_vence
CREATE INDEX `revisoes_usuario_vence` ON `revisoes_flashcard` (`usuario_id`,`vence`);

-- index session_token_unique
CREATE UNIQUE INDEX `session_token_unique` ON `session` (`token`);

-- index user_email_unique
CREATE UNIQUE INDEX `user_email_unique` ON `user` (`email`);

-- table account
CREATE TABLE `account` (
	`id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`provider_id` text NOT NULL,
	`user_id` text NOT NULL,
	`access_token` text,
	`refresh_token` text,
	`id_token` text,
	`access_token_expires_at` integer,
	`refresh_token_expires_at` integer,
	`scope` text,
	`password` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);

-- table assinaturas
CREATE TABLE `assinaturas` (
	`id` text PRIMARY KEY NOT NULL,
	`usuario_id` text NOT NULL,
	`status` text NOT NULL,
	`valor_centavos` integer NOT NULL,
	`acesso_ate` integer,
	`criada_em` integer NOT NULL,
	`atualizada_em` integer NOT NULL,
	FOREIGN KEY (`usuario_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);

-- table assuntos
CREATE TABLE `assuntos` (
	`id` integer PRIMARY KEY NOT NULL,
	`disciplina_id` integer NOT NULL,
	`nome` text NOT NULL,
	FOREIGN KEY (`disciplina_id`) REFERENCES `disciplinas`(`id`) ON UPDATE no action ON DELETE no action
);

-- table contagens
CREATE TABLE `contagens` (
	`chave` text PRIMARY KEY NOT NULL,
	`total` integer NOT NULL
);

-- table disciplinas
CREATE TABLE `disciplinas` (
	`id` integer PRIMARY KEY NOT NULL,
	`nome` text NOT NULL
);

-- table flashcards
CREATE TABLE `flashcards` (
	`id` integer PRIMARY KEY NOT NULL,
	`codigo` text NOT NULL,
	`disciplina_id` integer NOT NULL,
	`assunto_id` integer,
	`frente` text NOT NULL,
	`verso` text NOT NULL,
	FOREIGN KEY (`disciplina_id`) REFERENCES `disciplinas`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`assunto_id`) REFERENCES `assuntos`(`id`) ON UPDATE no action ON DELETE no action
);

-- table pagamentos
CREATE TABLE `pagamentos` (
	`id` text PRIMARY KEY NOT NULL,
	`assinatura_id` text NOT NULL,
	`usuario_id` text,
	`valor_centavos` integer NOT NULL,
	`status` text NOT NULL,
	`cobrado_em` integer NOT NULL,
	`atualizado_em` integer NOT NULL,
	FOREIGN KEY (`usuario_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null
);

-- table questoes
CREATE TABLE `questoes` (
	`id` integer PRIMARY KEY NOT NULL,
	`codigo` text NOT NULL,
	`disciplina_id` integer NOT NULL,
	`assunto_id` integer,
	`banca` text,
	`ano` integer,
	`enunciado` text NOT NULL,
	`alternativas` text NOT NULL,
	`gabarito` text NOT NULL,
	`comentario` text, `dificuldade` integer, `ordem` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`disciplina_id`) REFERENCES `disciplinas`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`assunto_id`) REFERENCES `assuntos`(`id`) ON UPDATE no action ON DELETE no action
);

-- table rate_limit
CREATE TABLE `rate_limit` (
	`id` text PRIMARY KEY NOT NULL,
	`key` text NOT NULL,
	`count` integer NOT NULL,
	`last_request` integer NOT NULL
);

-- table respostas
CREATE TABLE `respostas` (
	`id` integer PRIMARY KEY NOT NULL,
	`usuario_id` text NOT NULL,
	`questao_id` integer NOT NULL,
	`alternativa` text NOT NULL,
	`correta` integer NOT NULL,
	`respondida_em` integer NOT NULL,
	FOREIGN KEY (`usuario_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`questao_id`) REFERENCES `questoes`(`id`) ON UPDATE no action ON DELETE no action
);

-- table revisoes_flashcard
CREATE TABLE `revisoes_flashcard` (
	`usuario_id` text NOT NULL,
	`flashcard_id` integer NOT NULL,
	`vence` integer NOT NULL,
	`estabilidade` real NOT NULL,
	`dificuldade` real NOT NULL,
	`dias_decorridos` integer NOT NULL,
	`dias_agendados` integer NOT NULL,
	`passos_aprendizado` integer DEFAULT 0 NOT NULL,
	`repeticoes` integer NOT NULL,
	`lapsos` integer NOT NULL,
	`estado` integer NOT NULL,
	`ultima_revisao` integer,
	PRIMARY KEY(`usuario_id`, `flashcard_id`),
	FOREIGN KEY (`usuario_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`flashcard_id`) REFERENCES `flashcards`(`id`) ON UPDATE no action ON DELETE no action
);

-- table session
CREATE TABLE `session` (
	`id` text PRIMARY KEY NOT NULL,
	`expires_at` integer NOT NULL,
	`token` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`ip_address` text,
	`user_agent` text,
	`user_id` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);

-- table status_questao
CREATE TABLE `status_questao` (
	`usuario_id` text NOT NULL,
	`questao_id` integer NOT NULL,
	`ultima_correta` integer NOT NULL,
	`tentativas` integer DEFAULT 1 NOT NULL,
	`atualizada_em` integer NOT NULL,
	PRIMARY KEY(`usuario_id`, `questao_id`),
	FOREIGN KEY (`usuario_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`questao_id`) REFERENCES `questoes`(`id`) ON UPDATE no action ON DELETE no action
);

-- table user
CREATE TABLE `user` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`email_verified` integer DEFAULT false NOT NULL,
	`image` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);

-- table verification
CREATE TABLE `verification` (
	`id` text PRIMARY KEY NOT NULL,
	`identifier` text NOT NULL,
	`value` text NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer,
	`updated_at` integer
);
