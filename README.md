# This or That

Aplicação web para recolher e analisar preferências sintáticas em programação através de comparações de código aos pares. Desenvolvida no âmbito de um projeto de mestrado na Universidade do Minho, disponibiliza uma experiência de participação em português e inglês e uma área reservada para gerir estudos e consultar resultados.

**[Participar no jogo](https://epl.di.uminho.pt/~pg55999/)** · **[Resultados gerais](https://epl.di.uminho.pt/~pg55999/resultados-gerais)** · **[Dados do Assessment](https://doi.org/10.5281/zenodo.23730602)**

## Como funciona

O participante compara duas representações de código e escolhe a que prefere. As escolhas são transportadas para as etapas seguintes, construindo progressivamente uma composição de estilos. Também é possível saltar uma comparação ou uma pergunta de perfil.

O estudo incluído, versão `2026.9`, apresenta 14 comparações e cinco perguntas opcionais de perfil. Abrange sete dimensões: declarações de variáveis, delimitadores de blocos, ciclos, condicionais, atribuição e atualização, operadores lógicos e declarações de funções.

No final, a aplicação mostra a composição resultante e um resumo por etapa. Os exemplos podem combinar convenções de linguagens diferentes e não representam necessariamente programas compiláveis. Saltar uma comparação não conta como preferência: a alternativa da esquerda é mantida apenas para permitir a continuação, e a categoria fica sem preferência final confirmada.

## Funcionalidades

- Comparação de código com destaque das diferenças e alinhamento de linhas.
- Retoma do progresso após atualizar a página no mesmo separador.
- Registo e validação das respostas no servidor.
- Resultados gerais públicos e painel de análise com filtros para investigadores.
- Edição de etapas, alternativas, exemplos e perguntas em conjuntos de dados versionados.
- Exportação de respostas em CSV e Excel.

## Executar localmente

### Requisitos

- Node.js `20.19+` ou `22.12+`, incluindo a série `24.x`.
- npm.
- PostgreSQL e uma base de dados dedicada à instalação local.

### 1. Instalar dependências

```bash
git clone https://github.com/19Rafa21/this-or-that.git
cd this-or-that
npm ci
npm ci --prefix server
```

### 2. Configurar os ambientes

Na raiz do projeto:

```bash
cp .env.example .env.development.local
cp server/.env.example server/.env
```

Edita `server/.env` para definir `DATABASE_URL` com as credenciais da tua base de dados. O exemplo usa PostgreSQL local sem SSL; para um serviço remoto que exija SSL, ajusta também `DATABASE_SSL`.

| Variável | Ficheiro | Finalidade |
| --- | --- | --- |
| `VITE_API_URL` | `.env.development.local` | Endereço da API; por omissão, `http://localhost:50820`. |
| `VITE_BASE_PATH` | `.env.development.local` | Caminho base do frontend; `/` numa instalação local. |
| `DATABASE_URL` | `server/.env` | Ligação à base de dados PostgreSQL. |
| `DATABASE_SSL` | `server/.env` | Usar `false` para PostgreSQL local sem SSL. |
| `PORT` | `server/.env` | Porta da API; por omissão, `50820`. |
| `ALLOWED_ORIGINS` | `server/.env` | Origens permitidas, separadas por vírgulas. |

Os ficheiros de configuração locais estão excluídos do Git. As variáveis com prefixo `VITE_` são incorporadas no frontend e devem conter apenas informação pública.

### 3. Preparar a base de dados

Depois de criar a base de dados e configurar a ligação:

```bash
npm run seed:validate --prefix server
npm run seed --prefix server
```

O seed cria o esquema e instala o estudo `2026.9`. Numa instalação existente, preserva as sessões e os conjuntos anteriores; pode recusar a ativação se o estudo ativo tiver sido gerido na administração. Consulta a [documentação da base de dados](server/DATABASE.md) antes de atualizar uma instalação com respostas.

### 4. Iniciar a aplicação

```bash
npm run dev:full
```

Abre **[http://127.0.0.1:5173](http://127.0.0.1:5173)**. Este comando inicia o frontend e a API; `Ctrl+C` termina ambos. A ligação à base de dados tem de permanecer disponível.

Para executar os serviços em terminais separados, usa `npm run dev` na raiz e `npm start --prefix server` noutro terminal. O estado da API pode ser consultado em `http://localhost:50820/api/health`.

## Administração e resultados

A página `/resultados-gerais` apresenta os resultados agregados do estudo ativo. A página `/resultados` dá acesso autenticado à análise detalhada e à gestão dos conjuntos de dados.

Para configurar a conta de administração:

```bash
npm run admin:password --prefix server
```

O comando pede uma palavra-passe de 12 a 128 caracteres e gera as variáveis `ADMIN_USERNAME` e `ADMIN_PASSWORD_HASH`. Guarda-as em `server/.env`, preservando as aspas indicadas para o hash, e reinicia a API. Não existe uma conta de demonstração predefinida.

A administração permite preparar e rever um rascunho antes de ativar uma nova versão do estudo. As respostas existentes permanecem associadas à versão em que foram recolhidas.

## Exportar dados

Executa os comandos a partir da raiz:

```bash
npm run export --prefix server
npm run export:xlsx --prefix server
npm run backup --prefix server
```

Os comandos produzem, respetivamente, ficheiros CSV, um livro Excel e uma cópia JSON das tabelas de dados do estudo. Os diretórios `server/exports/` e `server/backups/` estão excluídos do Git. Os detalhes dos formatos e da autenticação para exportar por HTTP estão em [server/DATABASE.md](server/DATABASE.md).

Os dados disponibilizados para o Assessment estão publicados separadamente no [Zenodo](https://doi.org/10.5281/zenodo.23730602), acompanhados de um dicionário de dados. A instalação do projeto não requer respostas de participantes.

## Verificar o projeto

```bash
npm run check
```

Executa a análise estática, os testes automatizados e o build de produção. Também é possível executar `npm run lint`, `npm test` e `npm run build` separadamente.

O teste de integração HTTP/PostgreSQL é executado com `npm run test:integration --prefix server`. Requer uma base de dados de desenvolvimento com permissão para criar esquemas; usa um esquema temporário isolado.

## Publicação

O frontend é compilado com `npm run build`; o resultado fica em `dist/`. Define `VITE_API_URL` e `VITE_BASE_PATH` num ficheiro `.env.production.local` ou no ambiente de compilação. A API usa as variáveis do servidor e arranca com `npm start --prefix server` a partir da raiz do repositório.

O alojamento do frontend deve encaminhar as rotas da aplicação para `index.html`. O ficheiro `public/.htaccess` incluído corresponde à instalação Apache em `/~pg55999/`; adapta-o ao caminho e ao servidor da tua instalação. Se a API for alojada separadamente, o serviço precisa também dos módulos partilhados em `src/game/`.

## Organização do código

```text
public/           Recursos públicos e configuração Apache
src/components/   Componentes da interface e editores do estudo
src/game/         Composição de código, comparações e regras do jogo
src/i18n/         Textos em português e inglês
src/pages/        Páginas de participação, resultados e administração
src/results/      Tratamento dos resultados no frontend
server/           API, autenticação, persistência e exportações
server/datasets/  Definições históricas usadas na compatibilidade e nos testes
```

Os testes estão junto dos módulos que verificam. O frontend utiliza React e Vite; a API utiliza Node.js e Express, com persistência em PostgreSQL.
