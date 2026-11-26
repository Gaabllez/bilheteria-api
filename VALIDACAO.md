# Relatório de validação e correções

Revisão realizada em **26/11/2026**, comparando o projeto com o enunciado e com [o modelo do professor](https://github.com/douglasmeneses/bilheteria-projeto-final/tree/b5fc6edd8b5e16a0615e2663b837261eb42875a6).

A base revisada foi `8e49302` (interface integrada pelo PR #1). As correções funcionais estão em `a70cb49`; a revisão do teste móvel e das Actions está em `5b2a15a`. O [PR #2](https://github.com/Gaabllez/bilheteria-api/pull/2) reúne a revisão e sua documentação.

## Resultado medido

Fonte principal: [GitHub Actions, execução 45749110996](https://github.com/Gaabllez/bilheteria-api/actions/runs/45749110996), commit `5b2a15a7d5200297cdeb2e9eb8c2c85ec781b2f7`, Node.js **22.23.5**. Os jobs `validar` e `interface` terminaram com sucesso.

| Camada | Evidência | Resultado |
|---|---|---|
| Instalação | `npm ci`, lockfile original | Aprovada |
| Tipos | `npm run typecheck` | Aprovado |
| Correção oficial | `npm test` e verificação do JSON original | 14 cenários aprovados, 16/16 pontos |
| Backend e infraestrutura de teste | `backend.test.ts` e `infra.test.mjs` | 32 testes/subtestes, zero falhas |
| Interface | `browser.test.mjs` no Chromium | 14 cenários, zero falhas |
| Integridade acadêmica dos arquivos | `conferir-originais.mjs` | 10 arquivos fornecidos preservados |
| Benchmark | 200 requisições concorrentes na API | Capacidade e estoque consistentes |
| Dependências | `npm audit --audit-level=high` e auditoria do `npm ci` | Zero vulnerabilidades reportadas nessa data |

Os 32 testes/subtestes adicionais são **29 do backend e 3 do gate**. A quantidade inclui os subcasos parametrizados de entrada inválida e falha de pagamento. Não se confunde com os 16 pontos oficiais.

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

Na primeira execução da suíte de interface, 13 cenários passaram e o teste móvel parou ao aguardar visibilidade de um indicador deliberadamente oculto no cabeçalho móvel. A espera foi corrigida para verificar sua presença e estado. A nova execução passou nos 14 cenários. As Actions antigas também foram substituídas por versões oficiais que usam runtime Node 24; a aplicação continua sendo testada em Node 22, como exige o professor.

## Cobertura do backend

Os testes oficiais continuam verificando herança e status dos erros, encapsulamento das poltronas, atomicidade, funções puras, regras de meia, comprovantes, conflito e concorrência. Incluem **200 pedidos disputando 50 poltronas** e **120 requisições HTTP disputando 30 poltronas**, sem vendas ou cobranças duplicadas.

As regressões adicionais cobrem dados malformados, tipos incorretos, listas esparsas, ausência de cobrança quando há erro, liberação atômica após falha, exceção síncrona da operadora, timeout, rejeição tardia, pagamentos concluídos fora de ordem, IDs distintos e isolamento entre o pedido, o comprovante e o estado interno. O teste de timeout controla o relógio para não depender de pausas imprecisas.

Os códigos HTTP **400, 404, 409 e 502** permanecem conforme o contrato original. Reservar as poltronas continua sendo uma operação síncrona anterior ao `await` do pagamento.

## Cobertura da interface

Os 14 cenários automatizados verificam:

1. Catálogo real, filtros e busca sem acentos.
2. Larguras de 360, 390 e 768 px, sem rolagem horizontal, e menu por toque/teclado.
3. Idades inválidas, foco e ausência de POST quando há erro.
4. Adição/remoção de participantes e bloqueio de poltronas duplicadas.
5. Meia por estudante, PcD e idade a partir de 60, sem acumular descontos, e taxa de 10%.
6. Reserva pela API real, bloqueio durante envio, prevenção de duplo envio, comprovante preservado e nova compra.
7. Tratamento do conflito 409.
8. Tratamento de pagamento recusado 502.
9. Falha na listagem, remoção do catálogo antigo e reconexão.
10. Catálogo vazio, esgotado ou com formato inválido.
11. POST sem resposta, timeout e início explícito de outro pedido.
12. Interrupção de conexão durante POST.
13. Resposta 201 sem comprovante válido.
14. Conteúdo com HTML tratado como texto e impressão com aviso de demonstração.

Cada cenário inicia uma instância isolada do servidor e domínio reais. A operadora injetada sempre aprova; erros específicos são simulados apenas nos testes que precisam deles. Imagens e fontes externas são substituídas para estabilizar a automação. A inspeção visual no navegador utilizou os recursos reais, que carregaram corretamente, e confirmou duas reservas na API demonstrativa. Uma delas continha três participantes, duas meias e uma inteira: subtotal de R$ 200, taxa de R$ 20 e comprovante de R$ 220.

As capturas automáticas estão no artefato `interface` da execução vinculada. Elas usam imagens substitutas e servem como evidência de layout e comportamento, não como fotografias finais do catálogo. A automação cobre Chromium; não foi realizada uma matriz de navegadores Safari e Firefox.

## Benchmark

Na execução documentada, o servidor foi iniciado com o estado vazio, usando a operadora original: latência de 80 ms, probabilidade de falha de 10% e limite de pagamento de 500 ms.

| Medida | Resultado |
|---|---:|
| Pedidos | 200 |
| Tempo medido | 246 ms |
| Taxa observada | 814 pedidos/s |
| HTTP 201 — reserva confirmada | 90 |
| HTTP 409 — poltrona ocupada | 100 |
| HTTP 502 — pagamento simulado recusado | 10 |
| Lugares restantes no evento 1 | 10 |

`conferir-benchmark.mjs` verifica que os 200 pedidos foram contabilizados, não há status inesperado, a capacidade não foi excedida e o estoque final corresponde às reservas aprovadas. Os outros eventos devem continuar intactos. As 10 recusas são parte da simulação do professor, e não dez defeitos da aplicação. Os números variam entre execuções; não representam uma garantia de capacidade em produção.

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
node --import tsx --test validacao/backend.test.ts validacao/infra.test.mjs
node validacao/conferir-originais.mjs
node --check public/app.js
```

No ambiente restrito da revisão local, a CLI do `tsx` não pôde criar seu canal IPC. O mesmo executor original rodou com `node --import tsx testes/executar.ts testes/projeto.ts src --legivel`. No GitHub Actions, o comando normal **`npm test` também passou** em Node 22.

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

O README ainda precisa do link do vídeo e da confirmação das contas GitHub e contribuições dos integrantes que estão marcados como pendentes. O histórico revisado identifica `Gaabllez` e `Mvsff`; não é adequado atribuir commits ou contribuições desconhecidos aos demais integrantes.

O grupo deve gravar o vídeo com a versão final, mostrar `git log -1`, seguir o roteiro do enunciado, demonstrar temporariamente o erro de concorrência e desfazê-lo, conferir os links sem login e realizar a entrega no Blackboard. Essas etapas continuam necessárias para a entrega acadêmica.

O sistema permanece uma demonstração: pagamentos são fictícios, reservas ficam em memória e reiniciar o processo limpa o estado. O contrato fornecido não oferece consulta de reserva por identificador após perda de resposta; por isso, a interface informa a incerteza e evita repetir automaticamente o pedido.
