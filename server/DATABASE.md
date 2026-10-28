# Base de dados e exportação

A aplicação utiliza PostgreSQL para guardar os estudos, os exemplos de código, as sessões e as respostas. A configuração é lida de `server/.env` quando os comandos do servidor são executados.

## Instalação inicial

Cria uma base de dados dedicada e configura `DATABASE_URL`. Para PostgreSQL local sem SSL, define `DATABASE_SSL=false`.

Na raiz do repositório:

```bash
npm run seed:validate --prefix server
npm run seed --prefix server
```

O seed cria o esquema, insere as definições do estudo `2026.9` e ativa essa versão. Inclui 3076 exemplos, 2754 comparações possíveis e cinco perguntas de perfil. Cada sessão completa percorre 14 comparações, preservando o contexto das escolhas anteriores.

O arranque normal da API aplica as migrações aditivas necessárias à gestão dos estudos. Não substitui o seed da instalação inicial.

## Atualizar uma instalação

Antes de atualizar uma base de dados com respostas, guarda uma cópia de segurança. O seed normal preserva os dados existentes e recusa alterações ao conteúdo de uma versão já instalada quando o hash não corresponde. Uma revisão do estudo deve ter um novo identificador e uma nova versão.

A gestão pela interface permite criar, editar e rever um rascunho antes da ativação. As sessões anteriores mantêm a associação à sua versão. Regenerar os exemplos de um rascunho substitui as respetivas edições manuais de código; não altera o estudo publicado.

Se existir um estudo ativo gerido na administração, o seed pode recusar substituí-lo. Para alterações correntes, usa a administração. O argumento `--expected-active=<id>` existe para substituições deliberadas e não deve fazer parte de um arranque ou deploy automático.

## Exportação local

Os comandos seguintes usam a ligação definida em `server/.env` e indicam no terminal a pasta de destino:

```bash
npm run export --prefix server
npm run export:xlsx --prefix server
npm run backup --prefix server
```

| Comando | Resultado |
| --- | --- |
| `export` | `sessions.csv`, `choices.csv`, `profile-answers.csv` e `final-results.csv`. |
| `export:xlsx` | Livro Excel com folhas de participações, perfil, escolhas e resultados. |
| `backup` | Cópia JSON consistente das tabelas de dados do estudo. |

As exportações e cópias ficam em `server/exports/` e `server/backups/`, excluídos do Git. A cópia JSON não substitui um backup completo do PostgreSQL: conserva também o esquema e utiliza `pg_dump` quando necessário.

As datas do Excel são expressas em UTC. Os identificadores e valores canónicos das respostas são preservados. Uma preferência não confirmada não deve ser substituída pelo estilo transportado para continuar o código. As exportações históricas podem incluir as sinalizações `legacy_unvalidated` e `legacy_reference_mismatch`.

## Exportação por HTTP

As rotas `/api/export/sessions.csv`, `/api/export/choices.csv`, `/api/export/profile-answers.csv`, `/api/export/final-results.csv` e `/api/export/results.xlsx` exigem um `EXPORT_TOKEN` com pelo menos 32 caracteres, configurado no servidor.

O pedido deve enviar o cabeçalho:

```http
Authorization: Bearer <EXPORT_TOKEN>
```

O token não deve ser colocado no URL nem em variáveis `VITE_`. Esta configuração é independente da conta de administração. O endpoint público `/api/public/results` disponibiliza apenas resultados agregados do estudo ativo.

## Teste de integração

```bash
npm run test:integration --prefix server
```

O teste liga à base de dados configurada, cria um esquema temporário isolado, verifica a API por HTTP e remove esse esquema no final. A conta PostgreSQL precisa de permissão para criar esquemas. Executa-o numa instalação de desenvolvimento.

## Reinicialização completa

`npm run seed:reset --prefix server` apaga as tabelas e as respostas do projeto. É uma operação destrutiva destinada exclusivamente a bases descartáveis e exige `CONFIRM_DATABASE_RESET=RESET_THIS_OR_THAT`. Não a utilizes para atualizar uma instalação nem como comando de build ou de arranque.
