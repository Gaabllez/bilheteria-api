# Relatório de validação e correções

## Revisão atual — 26/11/2026

A revisão do [PR #5](https://github.com/Gaabllez/bilheteria-api/pull/5) partiu do commit `490bc57017e0b98653181b68aba89e7bfeb29fc4`. Nessa versão, a [execução 45900814907](https://github.com/Gaabllez/bilheteria-api/actions/runs/45900814907) passou no backend e reprovou a interface: 13 dos 17 cenários passaram. Havia expectativas antigas de apenas três eventos reserváveis e uma comparação de caminhos de imagem com URLs completas, além dos problemas funcionais reproduzidos nesta revisão.

**Resultado desta revisão:** a [execução 45922063858](https://github.com/Gaabllez/bilheteria-api/actions/runs/45922063858), referente ao commit [`f23a223`](https://github.com/Gaabllez/bilheteria-api/commit/f23a223bb93ecd8c67f28db0b6188f828ae5aab2), aprovou os jobs `validar` e `interface`, em Ubuntu com Node.js **22.23.5**.

| Verificação | Resultado |
|---|---|
| Instalação com o lockfile original, TypeScript e sintaxe JavaScript | Aprovados |
| `npm test` original e conferência da pontuação | **14 cenários, 16/16 pontos** |
| Regressões de backend, catálogo, HTTP e gate | **49 testes/subtestes aprovados**, zero falhas |
| Interface no Chromium | **38 cenários aprovados**, zero falhas |
| Arquivos fornecidos pelo professor | **10 preservados**, conferidos por hash |
| Ensaio do erro de concorrência em cópia temporária | **16/16 → 11/16 com o erro → 16/16 após desfazer** |
| Benchmark | **200 pedidos**, estoque consistente |

Os 49 testes/subtestes adicionais correspondem a **31 de backend, 11 de catálogo, 4 de integração HTTP e 3 do gate**. Essa contagem inclui subtestes e não deve ser confundida com os 16 pontos oficiais.

## Erros reproduzidos e correções

| Problema | Reprodução e consequência | Correção |
|---|---|---|
| Comprovantes divergentes aceitos | Um adulto sem direito à meia podia receber um recibo de meia; ingresso de R$ 1 ou total de R$ 999 também eram aceitos para um pedido esperado de R$ 110 | A confirmação exige evento, participante, poltrona, tipo, valor individual, total com taxa e identificador válidos |
| Reenvio manual após resultado desconhecido | Depois de iniciar outro pedido, era possível digitar novamente a poltrona do POST sem resposta | A validação bloqueia também a digitação manual das poltronas incertas na sessão da página, por evento |
| Arredondamento divergente | Meia de R$ 2,01 era R$ 1,00 no backend e R$ 1,01 na interface; taxa de 10% sobre R$ 17,15 terminava em R$ 18,86 | API e interface usam a mesma regra pura de arredondamento, com tolerância à imprecisão binária; os resultados são R$ 1,01 e R$ 18,87 |
| Tratamento de imagens incompleto | A miniatura da seleção não tinha fallback e reabrir o modal acumulava listeners de erro | Um helper atende card, detalhes e seleção, substitui o handler anterior e evita repetir o fallback indefinidamente |
| Catálogo aceito pelo servidor e recusado pela interface | IDs originais ausentes, metadados/créditos incompletos ou apresentação inválida podiam passar na inicialização | O validador exige os IDs 1, 2 e 3 reserváveis e os campos, categorias, créditos, cores e enquadramento utilizados pela interface |
| Caminhos de imagem incompatíveis | O servidor aceitava caminho local com `%2e%2e`, consultas locais e URLs Commons fora do formato suportado | As duas camadas usam formatos compatíveis e verificam o caminho remoto depois da normalização |
| Entrada inválida reportada como erro interno | JSON acima de 100 KB e codificação não suportada retornavam 500; gzip inválido também precisava manter o status 400 do parser | A composição HTTP responde 413, 415 ou 400 antes de reservar/cobrar, mantendo resposta JSON e os arquivos originais |
| Testes desatualizados após a expansão | A suíte ainda esperava três reservas no site; um filtro de eventos não reserváveis retornava uma lista vazia e não exercitava os 11 IDs adicionais | Testes conferem os 14 eventos em `/catalogo/*`, os três em `/eventos` e a rejeição dos 11 IDs exclusivos na API original |
| Documentação contraditória | Relatório e guias ainda descreviam 11 registros sem reserva e vídeo pendente | README, relatório, roteiro e guia descrevem as duas APIs e mantêm o link do vídeo já publicado |

Os preços atuais do catálogo são inteiros; o problema monetário foi reproduzido com preços fracionários válidos, evitando uma divergência quando esse tipo de preço for usado.

## Contrato preservado

| Recurso | Comportamento |
|---|---|
| `GET /eventos` e `POST /reservas` | Três eventos, de IDs 1, 2 e 3, conforme o enunciado |
| `GET /catalogo/eventos` e `POST /catalogo/reservas` | Os 14 eventos do site: 12 artistas/turnês e dois espetáculos teatrais |
| Estoque | As duas bilheterias são independentes; reservas do site não consomem as poltronas do benchmark |
| Evento 1 | Preço fictício de R$ 100 e capacidade inicial de 100 poltronas |
| Pagamento do programa principal | Operadora simulada com latência de 80 ms, taxa de falha de 10% e timeout de 500 ms |
| API original | Status de negócio 400, 404, 409 e 502 preservados |
| Estado e cobrança | Reserva síncrona antes do `await`; pedidos em conflito não são cobrados; falha de pagamento libera o grupo inteiro |

[src/aplicacao.ts](src/aplicacao.ts) reúne o servidor original, as rotas do catálogo, o tratamento dos erros de leitura do JSON e os arquivos estáticos. Tanto `main.ts` quanto o servidor usado nos testes de interface usam essa composição. O domínio e as APIs são reais; nos testes de navegador, somente a operadora é injetada para aprovar de forma determinística, e as falhas específicas são controladas por cenário.

## Cobertura e evidências

Os testes oficiais incluem **200 pedidos simultâneos disputando 50 poltronas** e **120 requisições HTTP disputando 30 poltronas**. As regressões adicionais verificam validação antes da cobrança, atomicidade, rollback, falha síncrona, timeout, rejeição tardia, pagamentos fora de ordem, IDs distintos, imutabilidade das entradas, centavos e contratos HTTP.

A integração HTTP verifica as duas rotas de reserva com JSON excessivo, charset e codificação não suportados, JSON inválido e gzip inválido; confirma ausência de cobrança e de mudança do estoque. Um pedido gzip válido posterior continua sendo aceito. A composição também serve a página e o catálogo e permite reservas independentes nas duas APIs.

A suíte de navegador cobre:

- Busca sem acentos, filtros de artistas/teatro e estilos, detalhes e seleção dos 14 eventos.
- Uma reserva completa pela interface para **cada um dos 14 eventos**, verificando que o estoque da API original continua intacto.
- Larguras de **360, 390 e 768 px**, menu móvel por toque e Escape e ausência de transbordamento horizontal.
- Participantes, idade, poltronas repetidas, meia por estudo/PcD/idade e taxa de 10%.
- Reserva real, controles bloqueados durante envio, prevenção de envio duplo, comprovante preservado e nova compra.
- Erros 409, 502, 413 e 415; recuperação após falha na listagem ou no JSON do catálogo.
- Catálogo vazio, incompleto, duplicado, desconhecido, divergente ou esgotado.
- Timeout, conexão interrompida, erro 500, recibo ausente ou adulterado e bloqueio de poltronas incertas.
- Arredondamento fracionário, fallback das imagens, nomes tratados como texto e impressão com aviso de demonstração.

As imagens locais são carregadas de verdade. As imagens remotas do Wikimedia Commons são interrompidas de forma controlada nos testes, exercitando o fallback sem depender de terceiros; isso não verifica a disponibilidade atual dessas fotografias na Internet. O artefato **interface** da execução indicada contém capturas de desktop, celular e comprovante. A automação cobre Chromium; não foi executada uma matriz de Safari e Firefox.

## Benchmark desta revisão

Medição identificada pela mesma execução acima, com o servidor recém-iniciado e a configuração original da operadora:

| Pedidos | Tempo (ms) | Pedidos/s reportados | Vendidos — 201 | Ocupada — 409 | Pagamento — 502 |
|---:|---:|---:|---:|---:|---:|
| 200 | 167 | 1194 | 88 | 100 | 12 |

Restaram **12 poltronas** no evento 1. Os outros dois eventos da API original permaneceram intactos. As recusas de pagamento fazem parte da simulação aleatória; a distribuição e o tempo variam entre execuções e não constituem garantia de desempenho em produção.

O gate confere a soma dos 200 pedidos, os códigos esperados, a capacidade e a disponibilidade final. O artefato **benchmark** guarda o log do servidor e o resultado medido.

## Arquivos originais do professor

A referência é [douglasmeneses/bilheteria-projeto-final@`b5fc6ed`](https://github.com/douglasmeneses/bilheteria-projeto-final/tree/b5fc6edd8b5e16a0615e2663b837261eb42875a6).

Foram preservados `GUIA.md`, `package.json`, `package-lock.json`, `tsconfig.json`, `src/tipos.ts`, `src/servidor.ts`, `src/pagamento.ts`, `src/bench.ts`, `testes/executar.ts` e `testes/projeto.ts`. Os hashes estão em [validacao/originais-professor.json](validacao/originais-professor.json); o verificador normaliza LF/CRLF para aceitar checkout Windows sem mudanças de código.

O executor original pode terminar com código zero mesmo quando há falhas. Por isso, [validacao/conferir-testes.mjs](validacao/conferir-testes.mjs) exige os 14 cenários e os 16 pontos. O ensaio de concorrência usa uma cópia temporária: desloca a marcação das poltronas para depois do pagamento, confirma a falha de **200 cobranças por 50 poltronas** e verifica a restauração. Essa versão propositalmente incorreta não fica no código entregue.

## Como reproduzir

Use Node.js 22 ou superior:

```bash
npm ci
npm run typecheck
npm test
node validacao/conferir-testes.mjs
node --import tsx --test validacao/backend.test.ts validacao/infra.test.mjs validacao/catalogo.test.ts validacao/http.test.ts
node validacao/conferir-originais.mjs
node --check public/app.js
node --check validacao/browser.test.mjs
node validacao/demonstrar-concorrencia.mjs
```

Na revisão local, a CLI do `tsx` encontrou uma restrição de IPC (`EPERM`); o mesmo executor foi utilizado por `node --import tsx`. A confirmação do comando **`npm test` normal** pertence ao CI identificado acima.

O CI instala `playwright@1.62.1` em pasta temporária para preservar os manifestos do professor. Em um ambiente de desenvolvimento comum, instale sem alterar esses arquivos:

```bash
npm install --prefix .cache/bilheteria-browser --no-save --package-lock=false playwright@1.62.1
node .cache/bilheteria-browser/node_modules/playwright/cli.js install chromium
```

Bash:

```bash
PLAYWRIGHT_MODULE_PATH="$PWD/.cache/bilheteria-browser/node_modules/playwright/index.mjs" node --import tsx --test --test-concurrency=1 validacao/browser.test.mjs
```

PowerShell:

```powershell
$env:PLAYWRIGHT_MODULE_PATH = (Resolve-Path .cache/bilheteria-browser/node_modules/playwright/index.mjs).Path
node --import tsx --test --test-concurrency=1 validacao/browser.test.mjs
```

Execute `npm start` para abrir o site em `http://localhost:3000`. Não há build separado. Para o benchmark, reinicie o servidor e execute `npm run bench` em outro terminal, com as 100 poltronas originais livres.

## Histórico de validações anteriores

| Revisão | Evidência |
|---|---|
| PR #2, commit `5b2a15a` | [Execução 45749110996](https://github.com/Gaabllez/bilheteria-api/actions/runs/45749110996): 16/16 pontos, 32 testes/subtestes adicionais e 14 cenários de interface |
| PR #3, commit `a630347` | [Execução 45752558050](https://github.com/Gaabllez/bilheteria-api/actions/runs/45752558050): 16/16 pontos, 36 testes/subtestes adicionais e 16 cenários de interface |
| PR #4, commit `153b8d7` | [Execução 45755830771](https://github.com/Gaabllez/bilheteria-api/actions/runs/45755830771): 16/16 pontos, 38 testes/subtestes adicionais e 17 cenários de interface |

Essas contagens pertencem aos commits indicados. O catálogo e os cenários mudaram desde então; a tabela da revisão atual é a evidência aplicável ao código revisado.

## Limites e entrega

O sistema continua sendo uma demonstração acadêmica: pagamentos são fictícios e reiniciar o processo limpa as reservas em memória. O timeout não cancela uma cobrança externa real. O contrato fornecido não oferece consulta de reserva após perda de resposta; a interface sinaliza a incerteza e evita reenviar as mesmas poltronas na sessão atual da página. Isso não substitui persistência nem idempotência de um sistema de venda real.

O [vídeo publicado](https://youtu.be/PAbFfoOZ0Is?is=VjZeK27Q1f91e-Pz) está no README, e os quatro integrantes e suas contribuições foram preservados. Esta revisão de código não avalia o conteúdo da gravação nem comprova o envio ao Blackboard. O [guia de entrega](docs/ENTREGA.md) e o [roteiro](docs/ROTEIRO_VIDEO.md) reúnem os requisitos acadêmicos.
