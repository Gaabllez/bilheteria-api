# Bilheteria concorrente

**Link do vídeo:** [Assistir à apresentação](https://youtu.be/PAbFfoOZ0Is?is=VjZeK27Q1f91e-Pz).

Projeto final de **Paradigmas de Linguagens de Programação**, baseado no [modelo do professor Douglas](https://github.com/douglasmeneses/bilheteria-projeto-final). A aplicação reúne uma API de reservas concorrentes e uma interface de bilheteria com artistas, turnês e espetáculos teatrais. **Preços, capacidades, reservas e pagamentos são demonstrativos; não há venda de ingressos reais.**

## Integrantes

| Nome | RGM | GitHub | Contribuição registrada |
|---|---|---|---|
| Gabriel Galvão Fredrich | 33632308 | [Gaabllez](https://github.com/Gaabllez) | API, integração, validação automatizada, catálogo e aprimoramentos da interface |
| Inácio Assis dos Santos Netto | 32830980 | [nettoinacio](https://github.com/nettoinacio) | Ampliação do catálogo e da navegação com categorias de artistas e teatro; inclusão de registros editoriais de espetáculos teatrais; atualização da interface, documentação e testes. |
| Marcus Vinícius Souza Fernandes Filho | 33204128 | [Mvsff](https://github.com/Mvsff) | Painel web responsivo e preservação da resposta da reserva após a atualização dos eventos |
| Rafael Olívio Ribeiro Campos | 34289461 | [rafaeloliviooo](https://github.com/rafaeloliviooo) | Planejamento e revisão da expansão do catálogo de 6 para 12 artistas/turnês; inclusão de Adele, Dua Lipa, Billie Eilish, Taylor Swift, Beyoncé e Ed Sheeran; definição da arte vetorial editorial; atualização do catálogo, interface, documentação e testes; correção dos IDs e das regressões identificadas no CI |

As contribuições dos quatro integrantes estão registradas na tabela.

## Executar

Use **Node.js 22 ou superior**. Na pasta do projeto:

```bash
npm ci
npm run typecheck
npm test
npm start
```

Abra [http://localhost:3000](http://localhost:3000). `npm start` executa `src/main.ts` com `tsx` e serve a interface de `public/`; não há etapa de build. A porta padrão é **3000**, com possibilidade de configuração pela variável `PORT`.

A API original (`/eventos` e `/reservas`) mantém **exatamente três eventos**, conforme o Passo 6 do enunciado. A interface usa `/catalogo/eventos` e `/catalogo/reservas`, uma bilheteria simulada separada com todos os **14 registros do catálogo** reserváveis. O evento de ID 1 começa com **100 poltronas**. A operadora simulada usa **80 ms de latência** e **10% de falha**, e a bilheteria limita a espera do pagamento a **500 ms**. Os arquivos fornecidos prontos pelo professor permanecem preservados e são conferidos por hash.

### Consultar eventos e fazer uma reserva

Com o servidor ativo, execute em outro terminal Bash ou Git Bash:

```bash
curl -i http://localhost:3000/eventos
curl -i -X POST http://localhost:3000/reservas -H 'Content-Type: application/json' -d '{"eventoId":1,"ingressos":[{"nome":"Ana","idade":20,"estudante":true,"pcd":false,"poltrona":7}]}'
```

`GET /eventos` lista os três eventos do enunciado. Para consultar os 14 shows da interface, use `GET /catalogo/eventos`; as reservas da interface são enviadas a `POST /catalogo/reservas`. Quando aprovada, a reserva retorna **201** com o comprovante; nesse exemplo, a meia-entrada de R$ 50 mais a taxa de 10% totaliza **R$ 55**. A operadora pode recusar o pagamento com **502**; após uma reserva aprovada, repetir a mesma poltrona retorna **409**. Há [comandos equivalentes para PowerShell](docs/ROTEIRO_VIDEO.md#2-projeto-rodando).

### Executar o benchmark

**Reinicie o servidor antes de cada medição:** no terminal de `npm start`, pressione `Ctrl+C` e execute `npm start` novamente. Isso devolve o estado inicial, com as 100 poltronas do evento 1 livres. Em outro terminal:

```bash
npm run bench
```

## Perguntas do enunciado

### 1. Concorrência. Como vocês garantem que duas pessoas não ficam com a mesma poltrona? Onde estava o await perigoso?

Em `Bilheteria.reservar()`, todas as poltronas do pedido são validadas e marcadas por `evento.reservar(poltronas)` **antes do primeiro `await`**. Esse trecho síncrono termina antes de outro pedido executar no mesmo processo; quando a cobrança está aguardando, os próximos pedidos já encontram as poltronas ocupadas e são recusados antes de cobrar. O `await` perigoso seria o do pagamento se a marcação estivesse depois dele: vários pedidos poderiam ser cobrados pela mesma poltrona antes de descobrir o conflito. Falhas ou timeout liberam as poltronas. O `Promise.race` limita a espera, e o `finally` limpa o temporizador ao terminar; essa limitação de espera não cancela uma cobrança externa real.

### 2. OO. O que o Evento esconde e por quê? Por que o reservar é tudo ou nada? Por que os erros são uma hierarquia de classes?

`Evento` esconde a lista de poltronas vendidas no campo privado `#vendidas` e expõe a disponibilidade por um getter sem setter, impedindo que código externo altere o estoque diretamente. `reservar()` verifica a lista inteira antes de marcar qualquer poltrona: se uma delas for inválida ou estiver ocupada, nenhuma parte do pedido é vendida, preservando o comportamento de tudo ou nada. Os erros herdam de `ErroDeNegocio`, que reúne mensagem e status HTTP; cada subclasse representa um problema específico, e o servidor consegue tratar todos de maneira uniforme com `instanceof`, mantendo o status adequado para cada situação.

### 3. Funcional. O que ganhamos com preco.ts puro? Como vocês testariam ele sem subir o servidor?

As funções de `preco.ts` calculam resultados a partir das entradas, sem alterar as pessoas ou os ingressos recebidos e sem depender de servidor, pagamento ou estado global. Isso torna o cálculo previsível, reutilizável e fácil de testar: basta importar as funções, fornecer preços e listas conhecidos e comparar os resultados esperados, como `valorDoIngresso(80)("meia") === 40` e `aplicarTaxa(0.1)(100) === 110`. Também podemos congelar as entradas com `Object.freeze` para detectar mutações e injetar diferentes regras puras de meia-entrada em `montarIngressos()`. As fábricas, o `map` e o `reduce` deixam explícitas a transformação de pessoas em ingressos e a soma dos valores.

### 4. Se fosse em outro paradigma. Escolham uma das partes e expliquem como ficaria em outro paradigma, e se ficaria melhor ou pior.

O cálculo de preços poderia ser escrito de forma imperativa: um laço percorreria as pessoas, decidiria o tipo de ingresso, acrescentaria cada resultado a uma lista e atualizaria um acumulador para calcular o total. Essa abordagem também pode produzir o resultado correto, mas, para esta transformação de dados, exigiria controlar mais estado mutável e permitiria erros como alterar a entrada ou reutilizar um acumulador. A versão funcional ficou mais adequada porque separa a regra de meia, a transformação e a totalização em funções pequenas, que podem ser combinadas e testadas isoladamente. Por isso, mantivemos em `preco.ts` o estilo funcional solicitado pelo professor.

### 5. Concorrente × paralelo. O Node roda o JavaScript numa linha só: os pedidos de vocês são concorrentes, não paralelos. O que mudaria se a venda rodasse em vários núcleos ao mesmo tempo?

Neste processo Node, o JavaScript executa um trecho síncrono por vez, e os pedidos avançam de forma concorrente enquanto outros aguardam o pagamento. Em vários processos ou núcleos atendendo vendas ao mesmo tempo, listas privadas em memória deixariam de ser suficientes: dois processos poderiam considerar a mesma poltrona livre. Seria necessário coordenar o estoque em um armazenamento compartilhado, por exemplo com uma transação e uma restrição de unicidade por evento e poltrona, ou outra operação atômica que permitisse somente uma reserva. As cobranças também precisariam de idempotência e de uma estratégia de cancelamento ou compensação para lidar com falhas sem cobrar duas vezes.

## Resultados do bench

Medição real de **26/11/2026**, no GitHub Actions, com **Ubuntu e Node.js 22.23.5**, registrada na [execução 45922063858](https://github.com/Gaabllez/bilheteria-api/actions/runs/45922063858), referente ao commit [f23a223](https://github.com/Gaabllez/bilheteria-api/commit/f23a223bb93ecd8c67f28db0b6188f828ae5aab2).

| Cenário | Pedidos | Tempo (ms) | Pedidos/s reportados | Vendidos — 201 | Poltrona ocupada — 409 | Falha de pagamento — 502 |
|---|---:|---:|---:|---:|---:|---:|
| Padrão (`main.ts`) | 200 | 167 | 1194 | 88 | 100 | 12 |

Ao final, o evento 1 tinha **12 poltronas disponíveis**, compatíveis com as 88 reservas confirmadas, e os outros dois eventos estavam intactos. As falhas de pagamento são simuladas e aleatórias; o tempo e a distribuição de respostas podem variar entre execuções. A tabela registra a medição identificada acima.

## Validação

A revisão do [PR #5](https://github.com/Gaabllez/bilheteria-api/pull/5), commit [f23a223](https://github.com/Gaabllez/bilheteria-api/commit/f23a223bb93ecd8c67f28db0b6188f828ae5aab2), passou nos jobs **`validar` e `interface`** da [execução 45922063858](https://github.com/Gaabllez/bilheteria-api/actions/runs/45922063858):

| Verificação | Resultado |
|---|---|
| TypeScript e sintaxe JavaScript | Aprovados |
| Testes originais do professor | **14 cenários, 16/16 pontos** |
| Regressões adicionais de backend, catálogo, HTTP e gate | **49 testes/subtestes aprovados**, zero falhas |
| Interface no Chromium | **38 cenários aprovados**, zero falhas |
| Arquivos originais do professor | **10 preservados**, verificados por hash |
| Benchmark | 200 pedidos, estoque consistente nos três eventos |

A revisão corrigiu a aceitação de comprovantes divergentes, diferenças de centavos, reenvio manual de poltronas com resultado incerto, fallback de imagens, validação do catálogo e erros HTTP de entrada. A suíte compra pela interface em **cada um dos 14 eventos** e verifica que o estoque da API original permanece independente. Também cobre celular, filtros, falhas, recibos e impressão.

O ensaio da demonstração de concorrência confirmou **16/16 com o código correto → 11/16 com a reserva após o pagamento → 16/16 depois da restauração**, em uma cópia isolada. A versão incorreta produziu a falha “cobrou 200 pessoas por 50 poltronas”.

Para repetir as verificações adicionais:

```bash
node validacao/conferir-originais.mjs
node validacao/conferir-testes.mjs
node --import tsx --test validacao/backend.test.ts validacao/infra.test.mjs validacao/catalogo.test.ts validacao/http.test.ts
node --check public/app.js
node validacao/demonstrar-concorrencia.mjs
```

O gate `conferir-testes.mjs` exige os 16 pontos e todos os cenários aprovados, pois o executor original pode terminar com código de saída zero mesmo exibindo falhas. Os testes originais foram preservados; as verificações adicionais ficam em `validacao/`. Consulte [VALIDACAO.md](VALIDACAO.md) para reproduções, comandos de navegador, evidências, histórico e limites dos testes.

## Catálogo e interface

O visual usa referências de cartazes de turnê e cultura pop, com títulos em Barlow Condensed, fotografias em destaque e textos diretos sobre os artistas e a reserva. A [direção visual](docs/DIRECAO_VISUAL.md) registra as referências oficiais, as mudanças e a licença da fonte local.

O site mantém 14 registros editoriais: 12 artistas/turnês e dois espetáculos teatrais, com busca, filtros por estilo e categoria, detalhes e links oficiais. As fotografias possuem créditos e usam arquivos locais ou URLs do Wikimedia Commons; quando uma imagem não carrega, card, detalhes e seleção exibem uma arte alternativa. Todos os 14 itens com `reservable: true` no [catálogo](public/catalogo.json) aparecem na interface e permitem simular uma reserva. O estoque da interface é independente do estoque da API original de três eventos.

| Artista | Turnê | Uso no projeto |
|---|---|---|
| Lady Gaga | The MAYHEM Ball | Evento 1, reserva simulada |
| Bruno Mars | The Romantic Tour | Evento 2, reserva simulada |
| The Weeknd | After Hours Til Dawn | Evento 3, reserva simulada |
| Coldplay | Music Of The Spheres World Tour | Reserva simulada no catálogo expandido |
| Shakira | Las Mujeres Ya No Lloran World Tour | Reserva simulada no catálogo expandido |
| Linkin Park | From Zero World Tour | Reserva simulada no catálogo expandido |
| Adele | Adele Live 2016 | Reserva simulada no catálogo expandido |
| Dua Lipa | Radical Optimism Tour | Reserva simulada no catálogo expandido |
| Billie Eilish | Hit Me Hard and Soft: The Tour | Reserva simulada no catálogo expandido |
| Taylor Swift | The Eras Tour | Reserva simulada no catálogo expandido |
| Beyoncé | Renaissance World Tour | Reserva simulada no catálogo expandido |
| Ed Sheeran | Mathematics Tour | Reserva simulada no catálogo expandido |
| O Fantasma da Ópera | Musical teatral | Reserva simulada no catálogo expandido |
| Wicked | Musical teatral | Reserva simulada no catálogo expandido |

O evento 1 mantém preço-base fictício de R$ 100 e 100 poltronas. Todos os itens do catálogo possuem preço e capacidade fictícios para a simulação; não há venda de ingressos reais. A interface inclui participantes, meia-entrada, taxa de 10%, comprovante imprimível e tratamento de falhas, preservando a resposta da reserva após atualizar os eventos.

As referências consultadas em **26/11/2026** estão em [FONTES.md](FONTES.md). Autoria, licenças e contexto das fotografias estão em [CREDITS.md](public/images/artists/CREDITS.md) e na [página de créditos](public/creditos.html), disponível em `/creditos.html` com o servidor ativo.

## Vídeo e entrega

O [roteiro do vídeo](docs/ROTEIRO_VIDEO.md) reúne as **oito partes obrigatórias**, incluindo a demonstração do erro e sua reversão. O [guia de entrega](docs/ENTREGA.md) contém a rubrica, a conferência dos commits individuais e o texto preparado para o Blackboard.

O vídeo da apresentação já está publicado: [assistir no YouTube](https://youtu.be/PAbFfoOZ0Is?is=VjZeK27Q1f91e-Pz).

Antes da entrega final, o grupo deve:

- Verificar os commits próprios de cada integrante e confirmar que a descrição das contribuições corresponde ao trabalho realizado.
- Confirmar o nome cadastrado do grupo e o prazo da turma no Blackboard e realizar o envio com os links, nomes completos e RGMs.

A pontuação máxima do trabalho é **3,5**: até **2,5** pelo código (`2,5 × pontos do npm test ÷ 16`), **0,75** pela avaliação do vídeo e **0,25** pelo README completo. A aprovação dos testes não substitui as etapas de entrega nem a participação individual exigida no enunciado.
