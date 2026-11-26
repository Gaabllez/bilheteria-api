# Roteiro do vídeo — Bilheteria concorrente

Este guia organiza as **oito partes obrigatórias, na ordem do enunciado**. Use os tópicos para estudar e explicar com suas próprias palavras: o professor exige dizer o que o código faz e por quê; a leitura de um texto pronto não substitui a explicação.

O grupo entrega um vídeo só e pode escolher apenas um integrante para falar. Mantenha o código visível enquanto o explica, com fonte legível. Slides não substituem a demonstração do código. O enunciado não fixa duração; cubra os itens sem alongar a apresentação com telas sem relação com eles.

## Preparação antes de começar a gravação

1. Confirme os nomes, RGMs, contas e contribuições reais de todos no [README](../README.md#integrantes). Não apresente uma contribuição ainda não confirmada como concluída.
2. Atualize a cópia local para a versão que será entregue. Se ela estiver sem alterações locais e a entrega estiver em `main`, use `git switch main` e `git pull --ff-only`.
3. Execute `npm ci`, abra o editor na pasta do projeto e prepare dois terminais nessa pasta.
4. Confirme que `git status --short` não mostra alterações. Isso é necessário para poder desfazer com segurança a modificação proposital da parte 6.
5. Aumente a fonte do editor e do terminal e organize as abas `src/dominio.ts`, `src/preco.ts`, `src/regras.ts`, `src/bilheteria.ts`, `src/servidor.ts` e `src/main.ts`.
6. Deixe as notificações pessoais fechadas e ensaie as explicações. O vídeo deve mostrar a versão da entrega; refaça os trechos relevantes se o código mudar depois.

Os comandos `git`, `npm` e os exemplos de `node -e` abaixo podem ser usados em Bash ou PowerShell. Para as requisições HTTP há opções específicas para cada terminal.

## 1. Abertura

**Na tela:** a tabela de integrantes no README e o terminal.

Apresente o nome completo de cada integrante e a contribuição que ele realmente realizou. Os dados atualmente registrados são:

| Integrante | RGM | Referência para a apresentação |
|---|---|---|
| Gabriel Galvão Fredrich | 33632308 | Atividades registradas na conta `Gaabllez`, descritas no README |
| Inácio Assis dos Santos Netto | 32830980 | Confirmar contribuição e conta antes da gravação |
| Marcus Vinícius Souza Fernandes Filho | 33204128 | Painel web responsivo e preservação da resposta da reserva, conta `Mvsff` |
| Rafael Olívio Ribeiro Campos | 34289461 | Confirmar contribuição e conta antes da gravação |

Execute e mostre:

```bash
git log -1
git status --short
```

Explique que o commit mostrado identifica a versão usada no vídeo. O comando de status deve ficar sem linhas de alterações. A alteração proposital exigida na parte 6 será desfeita durante a apresentação.

## 2. Projeto rodando

**Na tela:** terminal com os resultados, servidor iniciado e respostas das duas rotas.

No primeiro terminal:

```bash
npm test
npm start
```

Mostre a pontuação que o teste realmente produziu. Na versão correta, o resultado esperado é **16 de 16 pontos**, distribuídos por 14 cenários oficiais. O servidor permanece aberto nesse terminal, normalmente em `http://localhost:3000`.

No segundo terminal, faça as duas requisições.

### Bash, Git Bash, Linux ou macOS

```bash
curl -i http://localhost:3000/eventos
curl -i -X POST http://localhost:3000/reservas -H 'Content-Type: application/json' -d '{"eventoId":1,"ingressos":[{"nome":"Ana","idade":20,"estudante":true,"pcd":false,"poltrona":7}]}'
```

### PowerShell no Windows

```powershell
Invoke-RestMethod -Uri 'http://localhost:3000/eventos' | ConvertTo-Json -Depth 5

$pedido = @{
    eventoId = 1
    ingressos = @(
        @{
            nome = 'Ana'
            idade = 20
            estudante = $true
            pcd = $false
            poltrona = 7
        }
    )
} | ConvertTo-Json -Depth 5

$resposta = Invoke-WebRequest -UseBasicParsing -Method Post -Uri 'http://localhost:3000/reservas' -ContentType 'application/json' -Body $pedido
$resposta.StatusCode
$resposta.Content
```

Explique o que apareceu:

- `GET /eventos` retorna os **três eventos reserváveis**, cada um com `id`, `nome`, `preco`, `capacidade` e `disponivel`.
- O evento 1 começa com 100 poltronas. Ana é estudante: seu ingresso custa R$ 50; a taxa de 10% resulta em R$ 55.
- Quando o pagamento aprova, `POST /reservas` retorna HTTP **201** e o comprovante com identificação da reserva, evento, ingressos e total.
- A operadora foi configurada para falhar aleatoriamente em 10% das chamadas. Um **502** nessa demonstração é uma recusa simulada prevista: mostre a disponibilidade, explique a devolução da poltrona e repita o pedido para conseguir apresentar também um comprovante aprovado. Depois de um **201**, repetir a mesma poltrona resulta em **409**; não confunda isso com uma falha de pagamento.

Pode mostrar brevemente a interface, mas mantenha visíveis também os comandos e respostas solicitados. Os outros três artistas do site são conteúdo editorial e não aumentam a quantidade de eventos da API.

## 3. Orientação a objetos — `dominio.ts`

**Na tela:** [src/dominio.ts](../src/dominio.ts), seguido das demonstrações abaixo no terminal.

Pontos a explicar:

- `ErroDeNegocio` herda de `Error` e guarda o `status`. Suas subclasses associam o significado do erro a **400**, **404**, **409** ou **502**. O servidor consegue tratar a família inteira sem repetir a regra de cada erro nas rotas.
- `Evento` reúne os dados de um evento e o estado das poltronas. O campo `#vendidas` é privado de verdade no JavaScript; não pode ser acessado diretamente por código de fora da classe.
- `get disponivel()` calcula o total restante. Como não existe setter, o consumidor não pode atribuir outra disponibilidade.
- `reservar()` valida toda a lista antes de executar `push`. Se qualquer poltrona for inválida ou já vendida, nenhuma das novas poltronas do pedido é marcada.
- `liberar()` devolve poltronas após uma tentativa de pagamento que falhou. `info()` devolve os cinco dados públicos, sem expor a lista privada.

### Mostrar a proteção, sem editar a implementação

Execute o comando abaixo. Ele cria um evento independente do servidor, tenta alterar a disponibilidade e tenta acessar o campo privado. Os erros são capturados para que a demonstração continue.

```bash
node --import tsx --input-type=module -e "import { Evento } from './src/dominio.ts'; const e = new Evento(1, 'Demo', 100, 3); console.log('Antes:', e.disponivel); try { e.disponivel = 0; } catch (erro) { console.log(erro.name + ': ' + erro.message); } try { new Function('evento', 'return evento.#vendidas;')(e); } catch (erro) { console.log(erro.name + ': ' + erro.message); } console.log('Depois:', e.disponivel);"
```

O resultado deve mostrar **3 antes e 3 depois**, um `TypeError` pela atribuição ao getter e um `SyntaxError` pelo acesso a `#vendidas` fora da classe. A redação exata das mensagens pode variar com a versão do Node. `new Function` aparece apenas para capturar o erro de sintaxe nessa demonstração; não faz parte do sistema de reservas.

### Mostrar o tudo ou nada

```bash
node --import tsx --input-type=module -e "import { Evento } from './src/dominio.ts'; const e = new Evento(1, 'Demo', 100, 3); e.reservar([1]); console.log('Livres antes:', e.disponivel); try { e.reservar([2, 1]); } catch (erro) { console.log(erro.name, erro.status); } console.log('Livres depois da recusa:', e.disponivel); e.reservar([2]); console.log('A poltrona 2 continuava livre. Restam:', e.disponivel);"
```

A primeira reserva deixa duas poltronas livres. A tentativa `[2, 1]` falha com `PoltronaOcupadaErro`, status 409, e mantém as duas livres. A reserva posterior de `[2]` comprova que a tentativa recusada não vendeu parte do pedido.

## 4. Programação funcional — `preco.ts`

**Na tela:** [src/preco.ts](../src/preco.ts) e [src/regras.ts](../src/regras.ts).

Mostre a função e explique seu resultado antes de passar à próxima:

| Trecho | O que explicar |
|---|---|
| `valorDoIngresso(precoBase)` | É uma fábrica: recebe o preço e devolve uma função que recebe o tipo. `valorDoIngresso(80)('meia')` resulta em 40. |
| `aplicarTaxa(percentual)` | Devolve uma função que aplica uma taxa já definida. `aplicarTaxa(0.1)(100)` resulta em 110. |
| Arredondamento | Os resultados são números, arredondados em duas casas. Isso evita apresentar imprecisões como `110.00000000000001`. |
| `montarIngressos()` | `map` transforma cada pessoa em um ingresso, preservando a ordem e a poltrona, sem alterar o objeto original. A regra de meia é uma função recebida como argumento. |
| `direitoAMeia()` | Estudante, PcD ou idade de pelo menos 60 anos dá direito à meia. Basta uma das condições. |
| `calcularTotal()` | `reduce` soma os valores e a função produzida por `aplicarTaxa(0.1)` acrescenta a taxa. |

Para demonstrar as duas fábricas:

```bash
node --import tsx --input-type=module -e "import { valorDoIngresso, aplicarTaxa } from './src/preco.ts'; const ingressoDe80 = valorDoIngresso(80); const taxaDe10 = aplicarTaxa(0.1); console.log(typeof ingressoDe80, ingressoDe80('inteira'), ingressoDe80('meia')); console.log(typeof taxaDe10, taxaDe10(100));"
```

Explique por que o estilo funcional ajuda aqui: entradas iguais produzem os mesmos valores, as funções não alteram as pessoas recebidas e o cálculo pode ser testado sem iniciar servidor ou fazer pagamento. A pureza de `montarIngressos` pressupõe uma regra injetada também sem efeitos colaterais; a regra usada pelo projeto satisfaz isso.

## 5. Concorrência — `bilheteria.ts`

**Na tela:** [src/bilheteria.ts](../src/bilheteria.ts), destacando a ordem do método `reservar()`.

Percorra o código nesta sequência:

1. Validar o pedido, localizar o evento e validar os dados das pessoas.
2. Extrair as poltronas com `map` e chamar **`evento.reservar(poltronas)` antes do primeiro `await`**.
3. Montar os ingressos e calcular o total usando as funções da parte anterior.
4. Aguardar `comTempoLimite(this.#pagar(total), this.#limitePagamentoMs)`.
5. Em caso de falha, liberar as poltronas e lançar `PagamentoErro`.
6. Quando o pagamento aprova, incrementar o contador privado e devolver o comprovante.

Explique por que a ordem importa. No processo Node, outro pedido não interrompe esse trecho síncrono; quando o `await` permite que outro pedido progrida, as poltronas já estão marcadas. Assim, o segundo pedido para a mesma poltrona é recusado antes da cobrança. Pedidos de outras poltronas continuam enquanto o primeiro espera o pagamento; não existe uma fila global aguardando uma cobrança terminar.

Mostre `comTempoLimite()`: `Promise.race` disputa a cobrança com a rejeição do temporizador; `finally` limpa o timer. No servidor da entrega, o limite é de **500 ms**. Depois de uma falha ou de um timeout, o `catch` devolve as poltronas. Esse tempo limite encerra a espera; não é uma operação de cancelamento de uma cobrança externa real.

Mostre também os campos privados de `Bilheteria`: a lista de eventos, a função de pagamento, o limite e o contador. Eles preservam o controle do estado dentro do objeto.

## 6. Demonstração proposital do erro e correção

**Na tela:** a edição temporária de `src/bilheteria.ts`, a execução de `npm test`, as falhas e a restauração.

Esta parte é obrigatória. Faça-a somente com a versão de entrega já registrada em um commit e sem alterações locais pendentes. Não publique nem faça commit da versão propositalmente errada.

### Conferir o ponto de partida

```bash
git status --short
git diff -- src/bilheteria.ts
git diff --cached -- src/bilheteria.ts
```

Os comandos devem ficar sem alterações. Se houver trabalho local não registrado, conclua-o antes da demonstração; o comando de restauração ao final devolve o arquivo ao commit atual.

### Introduzir o erro no editor

No método `reservar()`, recorte a linha abaixo de sua posição anterior à montagem dos ingressos:

```ts
evento.reservar(poltronas);
```

Cole-a **depois do bloco `try/catch` do pagamento e imediatamente antes do `return` do comprovante**. A parte final ficará temporariamente assim:

```ts
const poltronas = pedido.ingressos.map(pessoa => pessoa.poltrona);
const ingressos = montarIngressos(evento.preco, pedido.ingressos, direitoAMeia);
const total = calcularTotal(ingressos);
try {
  await comTempoLimite(this.#pagar(total), this.#limitePagamentoMs);
} catch {
  evento.liberar(poltronas);
  throw new PagamentoErro("Pagamento recusado ou tempo esgotado");
}
evento.reservar(poltronas); // Erro proposital: só marca depois de cobrar.
return { reservaId: ++this.#contador, eventoId: evento.id, ingressos, total };
```

Salve, mostre `git diff -- src/bilheteria.ts` e execute:

```bash
npm test
```

Mostre o resultado real que aparecer. O cenário **“Concorrente: 200 pedidos simultâneos disputando 50 poltronas”** verifica tanto as vendas quanto as cobranças. Com a reserva deslocada para depois do pagamento, vários pedidos são cobrados antes de descobrir que disputavam uma poltrona já vendida. O teste passa a denunciar cobranças em excesso. As validações de poltronas e de devolução após falha também podem falhar, pois a ordem necessária foi quebrada.

Explique a causa pelo código: durante o `await`, ainda não havia poltronas marcadas, e os outros pedidos também chegaram à operadora. O erro demonstra por que o posicionamento original da reserva é parte da solução de concorrência.

O executor original pode terminar com código de saída zero mesmo quando mostra falhas. Leia a pontuação e as mensagens; não use somente o retorno do terminal para afirmar sucesso.

No ensaio realizado desta alteração, os testes originais passaram de **16/16 para 11/16**, e a mensagem central foi **“cobrou 200 pessoas por 50 poltronas”**. Depois da restauração, voltaram a **16/16**. Durante o vídeo, mostre a saída efetivamente obtida no seu terminal.

### Desfazer e provar que a versão correta voltou

Como a demonstração começou sem alterações locais e apenas esse arquivo foi modificado, restaure-o do commit atual:

```bash
git restore --source=HEAD -- src/bilheteria.ts
git diff --exit-code -- src/bilheteria.ts
npm test
node validacao/conferir-testes.mjs
git status --short
```

Mostre que a linha voltou a ficar **antes do `await`**, que a pontuação voltou a **16/16** e que não ficou alteração do erro no arquivo. Não avance para a entrega se a restauração ou a validação falhar.

### Ensaio opcional antes de gravar

O comando abaixo executa o cenário em uma cópia temporária, verifica as falhas esperadas e a restauração e mantém intacto o código de trabalho:

```bash
node validacao/demonstrar-concorrencia.mjs
```

Ele serve para estudar e verificar a demonstração. **Não substitui a parte 6 do vídeo:** é preciso mostrar a edição no código, executar `npm test`, explicar os resultados e desfazer a mudança diante da gravação.

## 7. Servidor — `servidor.ts`

**Na tela:** [src/servidor.ts](../src/servidor.ts) e [src/main.ts](../src/main.ts).

Explique o caminho do pedido:

- `express.json()` interpreta o corpo JSON e o disponibiliza em `req.body`.
- `GET /eventos` chama `bilheteria.listarEventos()` e responde com os dados públicos dos eventos.
- `POST /reservas` aguarda `bilheteria.reservar(req.body)` e devolve o comprovante com **201**.
- No tratador de erros com quatro parâmetros, `erro instanceof ErroDeNegocio` permite usar `erro.status` e `erro.message`. Assim, por exemplo, `PoltronaOcupadaErro` vira **409**.
- O servidor original trata JSON inválido como **400** e um erro inesperado como **500**. O Express 5 encaminha ao tratador também os erros das rotas assíncronas.

Em `main.ts`, mostre a criação de três eventos, a operadora de **80 ms** e **10% de falha**, o limite de **500 ms** e a porta padrão **3000**. `criarEventosDemo()` usa os três itens reserváveis do catálogo. A publicação dos arquivos de `public/` foi acrescentada na composição do aplicativo, preservando `src/servidor.ts` original.

## 8. Benchmark e interpretação

**Na tela:** servidor reiniciado, execução de `npm run bench` e números obtidos.

No terminal em que `npm start` está rodando, pressione `Ctrl+C` e inicie outra vez:

```bash
npm start
```

No outro terminal:

```bash
npm run bench
```

O benchmark precisa começar com as **100 poltronas do evento 1 livres**. Reiniciar limpa o estado em memória; executar reservas manuais antes do benchmark altera o ponto de partida.

Explique os números da execução exibida:

- São **200 pedidos**, dois para cada uma das 100 poltronas do evento 1.
- **201** são reservas confirmadas; **409**, tentativas em poltronas ocupadas; **502**, pagamentos simulados recusados ou com tempo esgotado.
- Com a operadora configurada para falhar em 10%, o enunciado indica valores próximos de 90 reservas, 100 conflitos e 10 falhas de pagamento. A quantidade exata e o tempo variam entre execuções.
- A quantidade vendida não pode ultrapassar a capacidade. Ao consultar `GET /eventos` depois, a disponibilidade do evento 1 deve corresponder a **100 menos as reservas confirmadas**, e os outros dois eventos devem continuar intactos.
- O tempo total mostra que as esperas de pagamento se sobrepõem: não se somam como se todos os pedidos estivessem numa fila de cobranças.

Mostre a [tabela real de benchmark no README](../README.md#resultados-do-bench) e explique que ela registra uma execução identificada. Não copie números esperados sobre números efetivamente medidos. Se quiser registrar a nova execução, anote o ambiente e os valores reais.

## Depois da gravação

Confira o áudio, a legibilidade do código, as oito partes na ordem e a restauração do erro. Publique no YouTube como **não listado** ou no Google Drive com acesso para **qualquer pessoa com o link**. Teste o link numa janela anônima, coloque-o no início do README e siga o [guia de entrega](ENTREGA.md).

Se apenas a documentação mudar para acrescentar o link do próprio vídeo, mantenha claro qual commit de código foi mostrado. Se a implementação mudar, atualize a gravação para corresponder ao código entregue.
