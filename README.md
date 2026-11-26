# Bilheteria concorrente

**Link do vídeo:** PENDENTE — gravação e publicação ainda não concluídas.

Projeto final de **Paradigmas de Linguagens de Programação**, baseado no [modelo do professor Douglas](https://github.com/douglasmeneses/bilheteria-projeto-final). A aplicação reúne uma API de reservas concorrentes e uma interface de bilheteria com artistas e turnês reais. **Preços, capacidades, reservas e pagamentos são demonstrativos; não há venda de ingressos reais.**

## Integrantes

| Nome | RGM | GitHub | Contribuição registrada |
|---|---|---|---|
| Gabriel Galvão Fredrich | 33632308 | [Gaabllez](https://github.com/Gaabllez) | API, integração, validação automatizada, catálogo e aprimoramentos da interface |
| Inácio Assis dos Santos Netto | 32830980 | [nettoinacio](https://github.com/nettoinacio) | Ampliação do catálogo e da navegação com categorias de artistas e teatro; inclusão de registros editoriais de espetáculos teatrais; atualização da interface, documentação e testes. |
| Marcus Vinícius Souza Fernandes Filho | 33204128 | [Mvsff](https://github.com/Mvsff) | Painel web responsivo e preservação da resposta da reserva após a atualização dos eventos |
| Rafael Olívio Ribeiro Campos | 34289461 | [rafaeloliviooo](https://github.com/rafaeloliviooo) | Ampliação do catálogo de 6 para 12 artistas/turnês; inclusão de Adele, Dua Lipa, Billie Eilish, Taylor Swift, Beyoncé e Ed Sheeran; criação da arte vetorial editorial; atualização do catálogo, interface, README e testes; correção dos IDs e dos testes após os checks de CI |

As contribuições dos quatro integrantes estão registradas na tabela.

### Contribuição de Inácio Assis dos Santos Netto (@nettoinacio)

- Ampliou a navegação do catálogo com filtros específicos para artistas e espetáculos teatrais, preservando os filtros por estilo musical.
- Incluiu registros editoriais para O Fantasma da Ópera e Wicked, sem habilitar reservas ou alterar os três eventos exigidos pelo enunciado.
- Atualizou a validação do catálogo, os textos da interface e os testes automatizados para contemplar os novos tipos de conteúdo.
- Registrou seu usuário GitHub e a contribuição nesta seção de integrantes.

### Contribuição de Rafael Olívio Ribeiro Campos (@rafaeloliviooo)

- Expandiu o catálogo editorial de 6 para 12 artistas e turnês, mantendo apenas os três eventos exigidos pelo enunciado como reserváveis.
- Adicionou os registros editoriais de Adele, Dua Lipa, Billie Eilish, Taylor Swift, Beyoncé e Ed Sheeran, com links oficiais e indicação de que não representam disponibilidade atual de ingressos.
- Criou a arte vetorial abstrata original usada nos novos registros, com créditos/licença e texto alternativo, e ajustou a validação de imagens para aceitar SVG.
- Atualizou a lista de artistas na interface, o catálogo JSON, a documentação e os testes para refletir os 12 registros.
- Corrigiu os IDs dos novos registros para evitar conflito com os IDs do catálogo original e atualizou os testes de catálogo e navegador que ainda esperavam seis cartões.
- Registrou seu usuário GitHub e essas atividades nesta seção de integrantes.

## Executar

Use **Node.js 22 ou superior**. Na pasta do projeto:

```bash
npm ci
npm run typecheck
npm test
npm start
```

Abra [http://localhost:3000](http://localhost:3000). `npm start` executa `src/main.ts` com `tsx` e serve a interface de `public/`; não há etapa de build. A porta padrão é **3000**, com possibilidade de configuração pela variável `PORT`.

O servidor cria **exatamente três eventos**, conforme o Passo 6 do enunciado. O evento de ID 1 começa com **100 poltronas**. A operadora simulada usa **80 ms de latência** e **10% de falha**, e a bilheteria limita a espera do pagamento a **500 ms**. Os arquivos fornecidos prontos pelo professor permanecem preservados e são conferidos por hash.

### Consultar eventos e fazer uma reserva

Com o servidor ativo, execute em outro terminal Bash ou Git Bash:

```bash
curl -i http://localhost:3000/eventos
curl -i -X POST http://localhost:3000/reservas -H 'Content-Type: application/json' -d '{"eventoId":1,"ingressos":[{"nome":"Ana","idade":20,"estudante":true,"pcd":false,"poltrona":7}]}'
```

`GET /eventos` lista os três eventos e a disponibilidade. Quando aprovada, a reserva retorna **201** com o comprovante; nesse exemplo, a meia-entrada de R$ 50 mais a taxa de 10% totaliza **R$ 55**. A operadora pode recusar o pagamento com **502**; após uma reserva aprovada, repetir a mesma poltrona retorna **409**. Há [comandos equivalentes para PowerShell](docs/ROTEIRO_VIDEO.md#2-projeto-rodando).

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

Medição real de **26/11/2026**, no GitHub Actions, com **Ubuntu e Node.js 22.23.5**, registrada na [execução 45755830771](https://github.com/Gaabllez/bilheteria-api/actions/runs/45755830771), referente ao commit [153b8d7cfbfcd6e0621dad1e65110069e39f84df](https://github.com/Gaabllez/bilheteria-api/commit/153b8d7cfbfcd6e0621dad1e65110069e39f84df).

| Cenário | Pedidos | Tempo (ms) | Pedidos/s reportados | Vendidos — 201 | Poltrona ocupada — 409 | Falha de pagamento — 502 |
|---|---:|---:|---:|---:|---:|---:|
| Padrão (`main.ts`) | 200 | 168 | 1191 | 93 | 100 | 7 |

Ao final, o evento 1 tinha **7 poltronas disponíveis**, compatíveis com as 93 reservas confirmadas, e os outros dois eventos estavam intactos. A quantidade de falhas é aleatória porque a operadora foi configurada com taxa de 10%; o tempo e a distribuição de respostas podem variar entre execuções. A tabela registra a medição acima, não um resultado fixo esperado.

## Validação

A execução de validação do commit de correção [11552f3](https://github.com/Gaabllez/bilheteria-api/commit/11552f3aacf3075b24e1b7536c55bd51265d25ef) concluiu com **success** nos dois checks (`validar` e `interface`): [ver GitHub Actions](https://github.com/Gaabllez/bilheteria-api/actions/runs/45866704404). A mesma [execução 45755830771](https://github.com/Gaabllez/bilheteria-api/actions/runs/45755830771) aprovou os jobs de backend e interface para o commit identificado acima:

| Verificação | Resultado |
|---|---|
| TypeScript e sintaxe JavaScript | Aprovados |
| Testes originais do professor | **14 cenários, 16/16 pontos** |
| Regressões adicionais de backend, catálogo e validação | **38 testes/subtestes aprovados**, zero falhas |
| Interface no Chromium | **17 cenários aprovados**, zero falhas |
| Arquivos originais do professor | **10 preservados**, verificados por hash |
| Benchmark | 200 pedidos, estoque consistente nos três eventos |

O ensaio da demonstração de concorrência também foi executado em uma cópia isolada: **16/16 com o código correto → 11/16 com a reserva após o pagamento → 16/16 depois da restauração**. A versão incorreta produziu a falha “cobrou 200 pessoas por 50 poltronas”.

Para repetir as verificações adicionais:

```bash
node validacao/conferir-originais.mjs
node validacao/conferir-testes.mjs
node --import tsx --test validacao/backend.test.ts validacao/infra.test.mjs validacao/catalogo.test.ts
node --check public/app.js
node validacao/demonstrar-concorrencia.mjs
```

O gate `conferir-testes.mjs` exige os 16 pontos e todos os cenários aprovados, pois o executor original pode terminar com código de saída zero mesmo exibindo falhas. Os testes originais foram preservados; as verificações adicionais ficam em `validacao/`. Consulte [VALIDACAO.md](VALIDACAO.md) para comandos de navegador, evidências, histórico e limites dos testes.

## Catálogo e interface

O site mantém 14 registros editoriais: 12 artistas/turnês e dois espetáculos teatrais, com busca, filtros por estilo e categoria, detalhes e links oficiais. As novas entradas editoriais usam arte abstrata original quando não há fotografia específica licenciada. Somente os três itens com `reservable: true` no [catálogo](public/catalogo.json) são instanciados na API e aparecem no formulário de reserva.

| Artista | Turnê | Uso no projeto |
|---|---|---|
| Lady Gaga | The MAYHEM Ball | Evento 1, reserva simulada |
| Bruno Mars | The Romantic Tour | Evento 2, reserva simulada |
| The Weeknd | After Hours Til Dawn | Evento 3, reserva simulada |
| Coldplay | Music Of The Spheres World Tour | Consulta editorial, sem reserva |
| Shakira | Las Mujeres Ya No Lloran World Tour | Consulta editorial, sem reserva |
| Linkin Park | From Zero World Tour | Consulta editorial, sem reserva |
| Adele | Adele Live 2016 | Consulta editorial, sem reserva |
| Dua Lipa | Radical Optimism Tour | Consulta editorial, sem reserva |
| Billie Eilish | Hit Me Hard and Soft: The Tour | Consulta editorial, sem reserva |
| Taylor Swift | The Eras Tour | Consulta editorial, sem reserva |
| Beyoncé | Renaissance World Tour | Consulta editorial, sem reserva |
| Ed Sheeran | Mathematics Tour | Consulta editorial, sem reserva |

O evento 1 mantém preço-base fictício de R$ 100 e 100 poltronas. Os itens editoriais não apresentam preço de reserva nem permitem envio ao checkout. A interface inclui participantes, meia-entrada, taxa de 10%, comprovante imprimível e tratamento de falhas, preservando a resposta da reserva após atualizar os eventos.

As referências consultadas em **26/11/2026** estão em [FONTES.md](FONTES.md). Autoria, licenças e contexto das fotografias estão em [CREDITS.md](public/images/artists/CREDITS.md) e na [página de créditos](public/creditos.html), disponível em `/creditos.html` com o servidor ativo.

## Vídeo e entrega

O [roteiro do vídeo](docs/ROTEIRO_VIDEO.md) reúne as **oito partes obrigatórias**, incluindo a demonstração do erro e sua reversão. O [guia de entrega](docs/ENTREGA.md) contém a rubrica, a conferência dos commits individuais e o texto preparado para o Blackboard.

Ainda depende do grupo:

- Verificar os commits próprios de cada integrante e confirmar que a descrição das contribuições corresponde ao trabalho realizado.
- Gravar e publicar o vídeo com o código da entrega, testar o acesso sem login e colocar o link verdadeiro no início deste README.
- Confirmar o nome cadastrado do grupo e o prazo da turma no Blackboard e realizar o envio com os links, nomes completos e RGMs.

A pontuação máxima do trabalho é **3,5**: até **2,5** pelo código (`2,5 × pontos do npm test ÷ 16`), **0,75** pela avaliação do vídeo e **0,25** pelo README completo. A aprovação dos testes não substitui as etapas de entrega nem a participação individual exigida no enunciado.
