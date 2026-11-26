# Relatório de validação e correções

Revisão realizada em **26/11/2026**, comparando o projeto com o enunciado e com [o modelo do professor](https://github.com/douglasmeneses/bilheteria-projeto-final/tree/b5fc6edd8b5e16a0615e2663b837261eb42875a6).

A revisão anterior partiu de `8e49302` (interface integrada pelo PR #1). As correções funcionais estão em `a70cb49`; a revisão do teste móvel e das Actions está em `5b2a15a`. O [PR #2](https://github.com/Gaabllez/bilheteria-api/pull/2) reúne essa etapa e sua documentação. A nova interface preserva a contribuição de **Marcus (Mvsff)**, incluindo a resposta da reserva após atualizar os eventos.

## Conformidade com o enunciado — três eventos na API

O Passo 6 exige três eventos. A revisão de conformidade mantém os seis artistas na apresentação, mas cria somente **Lady Gaga (ID 1), Bruno Mars (ID 2) e The Weeknd (ID 3)** na bilheteria. O evento 1 tem 100 poltronas. Coldplay, Shakira e Linkin Park ficam disponíveis para consulta editorial, sem preço, opção no formulário ou botão de reserva. O detalhe de cada turnê encaminha à agenda oficial.

- O catálogo exige exatamente três itens `reservable: true`, incluindo o evento 1; dados inconsistentes impedem a inicialização.
- `GET /eventos` devolve três eventos. Tentativas de reservar IDs editoriais retornam 404, sem cobrança nem alteração do estoque.
- O benchmark verifica explicitamente a quantidade de eventos, os 200 pedidos e o estoque restante.
- A interface continua com as seis fotografias, busca, filtros e detalhes; somente três artistas oferecem simulação. Uma resposta indevida da API oferecendo artista editorial bloqueia o formulário.
- O [roteiro de vídeo](docs/ROTEIRO_VIDEO.md) segue as oito partes do professor, com comandos Bash e PowerShell. O [guia de entrega](docs/ENTREGA.md) traz rubrica, contribuições comprovadas e texto para o Blackboard.

**Validação local desta revisão, em 26/11/2026:** typecheck e sintaxe aprovados; 14 cenários oficiais com **16/16 pontos** pelo executor original; **38 testes/subtestes adicionais aprovados**; os **10 arquivos fornecidos pelo professor preservados**. A CLI `npm test` esbarra na restrição local de IPC (`EPERM` do `tsx`); o mesmo executor foi rodado com `node --import tsx`, sem alterar arquivos do professor. O workflow executa também o comando original `npm test`, a interface e o benchmark.

O ensaio isolado do erro de concorrência confirmou **16/16 antes → 11/16 com o erro proposital → 16/16 após desfazer**. A falha central foi `cobrou 200 pessoas por 50 poltronas`: cobrar antes de reservar permite que pedidos concorrentes paguem pelo mesmo lugar. O auxiliar `node validacao/demonstrar-concorrencia.mjs` trabalha em cópia temporária, valida a causa da falha e a restauração, sem deixar o projeto incorreto. Ele serve para ensaiar; o vídeo ainda deve mostrar a alteração, `npm test`, a explicação e a reversão.

As seções abaixo registram as validações históricas dos PRs #2 e #3; suas contagens não devem ser confundidas com a revisão de conformidade.

## Histórico — catálogo e interface do PR #3

O [catálogo](public/catalogo.json) reúne Lady Gaga, Bruno Mars, The Weeknd, Coldplay, Shakira e Linkin Park, com turnês pesquisadas em fontes oficiais e filtros Pop, R&B, Rock e Latino. Nomes, fontes, preços fictícios e capacidades vêm desse mesmo JSON na API e no cliente; a disponibilidade permanece sob controle da API. As [fontes das turnês](FONTES.md) registram a consulta de **26/11/2026**. A interface apresenta o contexto pesquisado e links para as agendas oficiais, sem inventar calendário futuro.

São **oito WebPs locais, totalizando 850.490 bytes**, com autoria, licenças e contexto na [página de créditos](public/creditos.html), disponível em `/creditos.html`, e em [CREDITS.md](public/images/artists/CREDITS.md). A apresentação inclui destaque fotográfico, cards, busca por artista/turnê e detalhes com foto e agenda oficial. Preços, lugares, reservas e pagamentos continuam sendo uma simulação acadêmica.

**Resultado confirmado:** a [execução 45752558050](https://github.com/Gaabllez/bilheteria-api/actions/runs/45752558050), do [PR #3](https://github.com/Gaabllez/bilheteria-api/pull/3), aprovou os jobs `validar` e `interface` no commit **`a630347e2182233f7df58c85f5301495d6d090b9`**, com Node.js **22.23.5**.

| Verificação no PR #3 | Resultado |
|---|---|
| TypeScript e JavaScript | Aprovados no CI |
| Testes oficiais e gate | 14 cenários aprovados, **16/16 pontos** |
| Backend, gate e catálogo | **36 testes/subtestes aprovados**, zero falhas: 29 + 3 + 4 |
| Integridade dos arquivos do professor | **10 arquivos preservados** |
| Interface no Chromium | **16 cenários aprovados**, zero falhas |
| Benchmark de 200 pedidos | Gate aprovado; capacidade e estoque consistentes |

Os quatro testes de `catalogo.test.ts` verificam artistas/fontes/fotos locais, coerência entre JSON e API, estoques independentes e rejeição de configuração inválida. Também preservam o evento 1 com preço-base fictício de R$ 100 e 100 lugares, usado pelo benchmark. A contagem de 36 inclui subcasos parametrizados e não se confunde com os 16 pontos oficiais.

## Histórico comprovado — PR #2

A [execução 45749110996](https://github.com/Gaabllez/bilheteria-api/actions/runs/45749110996), commit `5b2a15a7d5200297cdeb2e9eb8c2c85ec781b2f7`, aprovou os jobs `validar` e `interface` em Node.js **22.23.5**. A versão anterior passou na instalação com lockfile original, typecheck, 14 testes oficiais (16/16 pontos), 32 testes/subtestes adicionais, 14 cenários de interface, integridade dos 10 arquivos e benchmark. A auditoria não reportou vulnerabilidades nessa execução. Esses resultados pertencem à versão anterior ao catálogo real.

## Erros encontrados e corrigidos

| Problema reproduzido | Efeito anterior | Correção |
|---|---|---|
| Nome em branco ou idade ausente na API | O pedido era cobrado e consumia poltrona | Validação dos participantes antes da marcação e cobrança, com HTTP 400 |
| `estudante: "false"` em JSON | A string era considerada verdadeira e concedia meia indevida | `estudante` e `pcd` precisam ser booleanos |
| Lista esparsa em `Evento.reservar` | Uma posição vazia podia consumir disponibilidade | Todas as posições são verificadas antes de alterar o estado |
| Idade em branco na interface | `Number("")` virava zero | Uso de `valueAsNumber`, checagem de inteiro/faixa e erro junto ao campo |
| Remover participante e adicionar outro | A sugestão automática podia repetir uma poltrona | Escolha do próximo número ainda não usado no formulário/sessão |
| Repetir uma tentativa de compra | O botão acumulava símbolos | Rótulo fixo após cada envio |
| Falha ao atualizar eventos | Catálogo antigo continuava utilizável | Limpeza dos dados e bloqueio do envio até reconectar |
| Requisição sem resposta | A interface podia ficar processando indefinidamente | Timeout de 10 segundos com `AbortController` |
| Conexão perdida durante POST | A tela tratava resultado desconhecido como falha certa | Aviso explícito, preservação dos dados e bloqueio do reenvio automático |
| Alterar o formulário durante POST | Resumo visível podia divergir do pedido enviado | Bloqueio dos controles enquanto a reserva está em andamento |
| Reserva concluída | Formulário mantinha nomes e poltronas já compradas | Novo formulário após confirmação, preservando o comprovante |
| Impressão do recibo | Aviso de simulação era ocultado | Aviso permanece visível; recibo fechado não é impresso |
| CI verde com pontuação insuficiente | O executor original sempre terminava com código zero | Gate externo exige todos os itens aprovados e 16/16 pontos |

A falha do executor foi reproduzida apontando-o para um diretório fonte inexistente: **0/16 pontos com código de saída 0**. O novo gate tem regressão específica para rejeitar esse caso, JSON ausente/truncado e erros do processo. O executor original não foi modificado.

No PR #2, a primeira execução da suíte de interface aprovou 13 cenários e o teste móvel parou ao aguardar visibilidade de um indicador oculto no cabeçalho móvel. A espera foi corrigida para verificar sua presença e estado; a repetição documentada aprovou os 14 cenários. As Actions antigas também foram substituídas por versões oficiais que usam runtime Node 24; a aplicação continua sendo testada em Node 22, como exige o professor.

## Cobertura do backend

Os testes oficiais continuam verificando herança e status dos erros, encapsulamento das poltronas, atomicidade, funções puras, regras de meia, comprovantes, conflito e concorrência. Incluem **200 pedidos disputando 50 poltronas** e **120 requisições HTTP disputando 30 poltronas**, sem vendas ou cobranças duplicadas.

As regressões adicionais cobrem dados malformados, tipos incorretos, listas esparsas, ausência de cobrança quando há erro, liberação atômica após falha, exceção síncrona da operadora, timeout, rejeição tardia, pagamentos concluídos fora de ordem, IDs distintos e isolamento entre o pedido, o comprovante e o estado interno. O teste de timeout controla o relógio para não depender de pausas imprecisas.

Os códigos HTTP **400, 404, 409 e 502** permanecem conforme o contrato original. Reservar as poltronas continua sendo uma operação síncrona anterior ao `await` do pagamento.

## Cobertura da interface

Os **16 cenários aprovados no CI do PR #3** verificam:

1. Seis artistas, busca por artista/turnê sem acentos e filtros musicais.
2. Detalhes das seis turnês, links oficiais e escolha correta do evento para simular.
3. Larguras de 360, 390 e 768 px, sem rolagem horizontal, e menu por toque/teclado.
4. Idades inválidas, foco e ausência de POST quando há erro.
5. Adição/remoção de participantes e bloqueio de poltronas duplicadas.
6. Meia por estudante, PcD e idade a partir de 60, sem acumular descontos, e taxa de 10%.
7. Reserva pela API real, bloqueio durante envio, prevenção de duplo envio, comprovante preservado e nova compra.
8. Tratamento do conflito 409.
9. Tratamento de pagamento recusado 502.
10. Falha na listagem, remoção do catálogo antigo e reconexão.
11. Recuperação pelo botão Atualizar após falha inicial de `catalogo.json`.
12. Catálogo vazio, esgotado ou com formato inválido.
13. POST sem resposta, timeout e início explícito de outro pedido.
14. Interrupção de conexão durante POST.
15. Resposta 201 sem comprovante válido.
16. Conteúdo com HTML tratado como texto e impressão com aviso de demonstração.

A revisão das evidências também passou a visitar cada imagem antes da captura completa, conferindo o carregamento dos oito WebPs e retornando a página ao topo. O modo de impressão ganhou um tema claro próprio; o teste exige fundo branco, texto preto, ausência da navegação e preservação do aviso de simulação. A primeira comprovação do tema claro está na [execução 45753389715](https://github.com/Gaabllez/bilheteria-api/actions/runs/45753389715), commit `32782b4`, com 16 cenários aprovados. As execuções posteriores do PR registram o refinamento final dos seletores de impressão.

Cada cenário inicia o servidor e o domínio reais com estoque isolado e a mesma fábrica de catálogo usada por `src/main.ts`. A operadora injetada sempre aprova; falhas específicas são simuladas nos respectivos cenários. A suíte usa as fotos locais reais e substitui apenas fontes externas. O teste de resposta HTTP abre a seção técnica pela interface após fechar o comprovante.

**Conferência manual no PR #3:** as seis fotografias dos cards carregaram corretamente. A reserva demonstrativa de Bruno Mars gerou o comprovante **#1**, confirmado com meia de **R$ 70**, taxa de **R$ 7** e total de **R$ 77**. As capturas automatizadas desta versão estão no artefato `interface` da execução do PR #3. A automação cobre Chromium, sem matriz de Safari e Firefox.

**Evidência histórica:** o artefato `interface` do PR #2 contém capturas da versão anterior com imagens substitutas. Na inspeção manual daquela versão, duas reservas foram confirmadas; uma delas tinha três participantes, duas meias e uma inteira, totalizando R$ 220 com a taxa.

## Benchmark histórico — PR #3

Na [execução 45752558050](https://github.com/Gaabllez/bilheteria-api/actions/runs/45752558050), o servidor foi iniciado com o estado vazio, usando a operadora original: latência de 80 ms, probabilidade de falha de 10% e limite de pagamento de 500 ms.

| Medida | Resultado |
|---|---:|
| Pedidos | 200 |
| Tempo medido | 169 ms |
| Taxa observada | 1181 pedidos/s |
| HTTP 201 — reserva confirmada | 85 |
| HTTP 409 — poltrona ocupada | 100 |
| HTTP 502 — pagamento simulado recusado | 15 |
| Lugares restantes no evento 1 | 15 |

`conferir-benchmark.mjs` aprovou a contabilização dos 200 pedidos, os status esperados, a capacidade e o estoque final correspondente às reservas confirmadas. Os outros **cinco eventos permaneceram intactos**. As 15 recusas fazem parte da operadora simulada do professor. Os números variam entre execuções; não representam uma garantia de capacidade em produção.

**Histórico do PR #2:** a execução 45749110996 registrou 200 pedidos em 246 ms (814 pedidos/s), 90 confirmações, 100 conflitos, 10 recusas e 10 lugares restantes. O tempo de execução não deve ser usado como comparação de desempenho entre versões.

## Arquivos preservados

Foram preservados `GUIA.md`, `package.json`, `package-lock.json`, `tsconfig.json`, `src/tipos.ts`, `src/servidor.ts`, `src/pagamento.ts`, `src/bench.ts`, `testes/executar.ts` e `testes/projeto.ts`.

Os hashes Git da referência estão em `validacao/originais-professor.json`. O verificador compara o conteúdo canônico com quebras LF, para aceitar também um checkout Windows convertido para CRLF sem mudança de código. As novas verificações ficam em `validacao/`, e o workflow do grupo as executa sem modificar as dependências do professor.

## Como reproduzir

Com Node.js 22 ou superior:

```bash
npm ci
npm run typecheck
npm test
node validacao/conferir-testes.mjs
node --import tsx --test validacao/backend.test.ts validacao/infra.test.mjs validacao/catalogo.test.ts
node validacao/conferir-originais.mjs
node --check public/app.js
node --check validacao/browser.test.mjs
```

`npm start` executa o TypeScript com `tsx` e serve `public/`; não existe etapa de build separada nem alteração necessária em `package.json`. Na revisão local anterior, a restrição ao IPC da CLI do `tsx` foi contornada com `node --import tsx testes/executar.ts testes/projeto.ts src --legivel`. O comando normal `npm test` passou no CI do PR #3 em Node 22.23.5.

Para os testes de interface, o CI instala `playwright@1.62.1` em uma pasta temporária. Em um ambiente de desenvolvimento comum, pode-se repetir sem editar o manifesto do professor:

```bash
npm install --prefix .cache/bilheteria-browser --no-save --package-lock=false playwright@1.62.1
node .cache/bilheteria-browser/node_modules/playwright/cli.js install chromium
```

No Bash:

```bash
PLAYWRIGHT_MODULE_PATH="$PWD/.cache/bilheteria-browser/node_modules/playwright/index.mjs" node --import tsx --test --test-concurrency=1 validacao/browser.test.mjs
```

No PowerShell:

```powershell
$env:PLAYWRIGHT_MODULE_PATH = (Resolve-Path .cache/bilheteria-browser/node_modules/playwright/index.mjs).Path
node --import tsx --test --test-concurrency=1 validacao/browser.test.mjs
```

O benchmark deve ser executado em um servidor recém-iniciado, em outro terminal, com `npm run bench`. Reinicie o servidor antes de repetir para restaurar a disponibilidade.

## Pendências fora do código

O README ainda precisa do link do vídeo e da confirmação das contas GitHub e contribuições de Inácio e Rafael, que estão marcadas como pendentes. O histórico revisado identifica `Gaabllez` e `Mvsff`; não é adequado atribuir commits ou contribuições desconhecidos aos demais integrantes.

O grupo deve gravar o vídeo com a versão final, mostrar `git log -1`, seguir o roteiro do enunciado, demonstrar temporariamente o erro de concorrência e desfazê-lo, conferir os links sem login e realizar a entrega no Blackboard. Essas etapas continuam necessárias para a entrega acadêmica.

O sistema permanece uma demonstração: pagamentos são fictícios, reservas ficam em memória e reiniciar o processo limpa o estado. O contrato fornecido não oferece consulta de reserva por identificador após perda de resposta; por isso, a interface informa a incerteza e evita repetir automaticamente o pedido.
