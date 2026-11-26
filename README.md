# Bilheteria concorrente

**Link do vídeo:** pendente de gravação e publicação.

Projeto final de Paradigmas de Linguagens de Programação, baseado no [modelo do professor](https://github.com/douglasmeneses/bilheteria-projeto-final).

## Integrantes

| Nome | RGM | GitHub | Parte principal |
|---|---|---|---|
| Gabriel Galvão Fredrich | 33632308 | Gaabllez | Implementação da API e integração do projeto, validação automatizada, catálogo e aprimoramentos da interface registrados nos commits da conta |
| Inácio Assis dos Santos Netto | 32830980 | A confirmar | A confirmar |
| Marcus Vinícius Souza Fernandes Filho | 33204128 | Mvsff | Painel web responsivo e preservação do comprovante após atualização dos eventos |
| Rafael Olívio Ribeiro Campos | 34289461 | A confirmar | A confirmar |

As contribuições de Gabriel e Marcus acima foram identificadas no histórico das contas `Gaabllez` e `Mvsff`. A participação de Inácio e Rafael precisa ser confirmada por eles e registrada com commits das próprias contas; os campos pendentes não representam contribuições já verificadas.

O [roteiro do vídeo](docs/ROTEIRO_VIDEO.md) organiza as oito partes obrigatórias. O [guia de entrega](docs/ENTREGA.md) reúne a rubrica, os itens restantes e o texto para o Blackboard.

## Executar

Node.js 22 ou superior.

```bash
npm ci
npm test
npm run typecheck
npm start
```

Com o servidor ativo, abra [http://localhost:3000](http://localhost:3000) para usar o catálogo e reservar ingressos de demonstração. A camada HTTP original do professor permanece intacta. A porta padrão é 3000; `PORT` permite outra porta quando o ambiente precisar.

Não há etapa de build: `npm start` executa `src/main.ts` com `tsx` e serve os arquivos de `public/`. Os comandos e as dependências originais do professor foram mantidos.

Em outro terminal:

```bash
curl http://localhost:3000/eventos
curl -X POST http://localhost:3000/reservas -H 'Content-Type: application/json' -d '{"eventoId":1,"ingressos":[{"nome":"Ana","idade":20,"estudante":true,"pcd":false,"poltrona":7}]}'
```

Antes do benchmark, encerre o servidor com `Ctrl+C` e execute `npm start` novamente. Em outro terminal, execute `npm run bench`. Isso garante que a medição comece com as 100 poltronas livres do evento 1. Há comandos equivalentes para PowerShell no [roteiro](docs/ROTEIRO_VIDEO.md#2-projeto-rodando).

## Aderência ao enunciado

O servidor cria **exatamente três eventos**, conforme o Passo 6: Lady Gaga (ID 1), Bruno Mars (ID 2) e The Weeknd (ID 3). O evento 1 começa com 100 poltronas. A operadora mantém latência de 80 ms, taxa de falha de 10% e tempo limite da bilheteria de 500 ms; a porta padrão é 3000.

Os seis artistas permanecem na apresentação do site. Coldplay, Shakira e Linkin Park são conteúdo editorial, com detalhes e agenda oficial, e não são eventos da API nem opções de reserva. O campo `reservable` do catálogo distingue esses usos, e a configuração exige exatamente três eventos reserváveis, incluindo o ID 1.

Os arquivos fornecidos prontos pelo professor são conferidos por hash. A revisão de código e os testes não substituem o vídeo, a participação individual e o envio ao Blackboard; os itens que dependem do grupo estão no [guia de entrega](docs/ENTREGA.md).

## Decisões

1. **Concorrência:** validamos e marcamos todas as poltronas sincronamente antes do primeiro await. Se a marcação fosse posterior ao pagamento, pedidos concorrentes poderiam cobrar a mesma poltrona. O timeout usa Promise.race e limpa o timer; falhas liberam as poltronas. A corrida limita a espera, mas não cancela uma cobrança externa real; em produção seriam necessários cancelamento ou compensação e idempotência.
2. **OO:** Evento guarda as poltronas em um campo privado e expõe a disponibilidade por getter. Valida toda a lista antes de modificar o estado para evitar reservas parciais. A hierarquia de erros associa cada erro ao seu status HTTP e permite tratamento uniforme pelo servidor.
3. **Funcional:** as fábricas retornam funções parametrizadas, map transforma pessoas em ingressos, reduce soma os valores. As funções não modificam os dados de entrada e podem ser testadas diretamente com valores e regras injetadas, sem HTTP.
4. **Outro paradigma:** o cálculo poderia ser imperativo, com loops e acumuladores mutáveis. Funcionaria, mas a composição funcional deixa a transformação e a soma explícitas e facilita testes isolados.
5. **Concorrente × paralelo:** no processo Node, o trecho síncrono não é interrompido por outro pedido enquanto o await permite progresso de outras requisições. Em vários processos ou núcleos com estado compartilhado, seria necessário coordenar reservas com transações, restrições de unicidade ou operações atômicas em armazenamento compartilhado.

## Resultados do bench

| Cenário | Pedidos | Tempo (ms) | Vendidos | Poltrona ocupada | Falha de pagamento |
|---|---:|---:|---:|---:|---:|
| Padrão (GitHub Actions, 26/11/2026) | 200 | 168 | 88 | 100 | 12 |
| Revisão anterior — PR #2 (26/11/2026) | 200 | 246 | 90 | 100 | 10 |
| Catálogo real — PR #3 (26/11/2026) | 200 | 169 | 85 | 100 | 15 |

**Resultado medido:** [execução #5 no GitHub Actions](https://github.com/Gaabllez/bilheteria-api/actions/runs/45747150604), no Ubuntu com Node.js 22. Foram 200 pedidos em 168 ms (1194 pedidos/s). Os resultados variam devido à falha aleatória de 10% da operadora simulada. Reinicie o servidor antes de repetir o benchmark.

**Histórico do PR #2:** a [execução 45749110996](https://github.com/Gaabllez/bilheteria-api/actions/runs/45749110996), commit `5b2a15a`, mediu 200 pedidos em 246 ms (814 pedidos/s), com 90 reservas, 100 conflitos, 10 recusas simuladas e 10 poltronas restantes.

**Histórico do catálogo com seis eventos, antes do ajuste ao Passo 6:** a [execução 45752558050](https://github.com/Gaabllez/bilheteria-api/actions/runs/45752558050), commit `a630347`, mediu 200 pedidos em **169 ms (1181 pedidos/s)**. O gate confirmou 85 reservas, 100 conflitos, 15 recusas simuladas, **15 lugares restantes no evento 1** e os outros cinco eventos intactos naquela versão. Ambas as revisões usaram Node.js 22.23.5. O tempo varia entre execuções; não é uma comparação de desempenho entre versões. A configuração atual possui três eventos na API.

## Histórico de atualizações e validação

- `0efed25`: implementação da API, regras de meia-entrada, cálculo funcional, domínio e reservas concorrentes.
- `86196cc`: configuração de GitHub Actions para typecheck, testes originais e benchmark.
- `9abc09e` (Mvsff): painel web responsivo com listagem de eventos, formulário e respostas HTTP.
- `98fa503` (Mvsff): preservação da resposta da reserva ao atualizar eventos.
- `0635c27`: integração do painel pelo main.ts e restauração do servidor original.
- `8e49302` / [PR #1](https://github.com/Gaabllez/bilheteria-api/pull/1): catálogo e experiência visual de bilheteria.
- `a70cb49`: validação de entrada da API, correções de formulário/conexão/comprovante e novas regressões.
- `5b2a15a` / [PR #2](https://github.com/Gaabllez/bilheteria-api/pull/2): teste móvel corrigido e Actions atualizadas para runtime suportado.
- `a630347` / [PR #3](https://github.com/Gaabllez/bilheteria-api/pull/3): seis artistas e turnês reais, fontes oficiais, fotografias locais com créditos, nova apresentação visual e catálogo compartilhado entre API e interface.
- Ajuste de conformidade ao enunciado: três eventos na API, três artistas adicionais somente para consulta, validação dessa configuração e documentação das oito partes do vídeo e da entrega.

### Estado da validação

**Histórico do PR #2:** a [execução 45749110996, de 26/11/2026](https://github.com/Gaabllez/bilheteria-api/actions/runs/45749110996), aprovou os jobs `validar` e `interface` em Node.js 22.23.5: 32 testes/subtestes adicionais, 14 cenários de interface, benchmark e auditoria sem vulnerabilidades reportadas naquela revisão. Essa execução antecede o novo catálogo.

**Histórico do PR #3, anterior ao ajuste de três eventos:** a [execução 45752558050](https://github.com/Gaabllez/bilheteria-api/actions/runs/45752558050) aprovou os jobs `validar` e `interface` no commit **`a630347e2182233f7df58c85f5301495d6d090b9`**, com Node.js **22.23.5**. A tabela abaixo pertence a essa execução; as evidências da revisão de conformidade devem ser consultadas no [relatório de validação](VALIDACAO.md) e na [execução correspondente ao commit entregue](https://github.com/Gaabllez/bilheteria-api/actions).

| Verificação | Resultado |
|---|---|
| TypeScript e sintaxe JavaScript | Aprovados |
| Testes originais do professor | 14 cenários, **16/16 pontos** |
| Regressões de backend, gate e catálogo | **36 testes/subtestes aprovados**, zero falhas (29 + 3 + 4) |
| Interface no Chromium | **16 cenários aprovados**, zero falhas |
| Arquivos fornecidos pelo professor | **10 preservados**, verificados por hash |
| Benchmark de 200 pedidos | Gate aprovado; estoque consistente nos seis eventos daquela revisão |

O executor original retorna código zero mesmo quando um teste falha. Por isso, `validacao/conferir-testes.mjs` exige os **16 pontos e todos os cenários aprovados**. Os arquivos originais em `testes/` não foram alterados. As regressões novas ficam em `validacao/`.

O [relatório de validação](VALIDACAO.md) registra erros reproduzidos, correções, comandos, evidências e limites dos testes.

## Catálogo real e nova interface

A interface criada por **Marcus (Mvsff)** foi aprimorada em `public/`, preservando seu fluxo de reserva e a resposta do POST após atualizar os eventos. A seleção atual reúne as turnês abaixo, conferidas em fontes oficiais em **26/11/2026**; as categorias organizam os filtros do site.

| Artista | Turnê e página oficial | Categoria | Uso no projeto |
|---|---|---|---|
| Lady Gaga | [The MAYHEM Ball](https://www.ladygaga.com/us-en/live/) | Pop | Evento 1, reserva simulada |
| Bruno Mars | [The Romantic Tour](https://www.brunomars.com/theromantictour) | Pop | Evento 2, reserva simulada |
| The Weeknd | [After Hours Til Dawn](https://www.theweeknd.com/tour/) | R&B | Evento 3, reserva simulada |
| Coldplay | [Music Of The Spheres World Tour](https://www.coldplay.com/tour/) | Rock | Consulta editorial, sem reserva |
| Shakira | [Las Mujeres Ya No Lloran World Tour](https://www.shakira.com/tour-hub/) | Latino | Consulta editorial, sem reserva |
| Linkin Park | [From Zero World Tour](https://www.linkinpark.com/tour) | Rock | Consulta editorial, sem reserva |

O [catálogo JSON](public/catalogo.json) é a fonte dos seis artistas e de seus metadados. `src/catalogo.ts` instancia somente os três itens com `reservable: true`; seus preços fictícios, capacidades e disponibilidade são usados pela API e pelo formulário. `GET /eventos` devolve exatamente esses três eventos. O evento 1 mantém preço-base de R$ 100 e 100 poltronas para preservar o benchmark. Os itens editoriais não apresentam preço de reserva nem permitem envio ao checkout.

- Página inicial com destaque fotográfico, cards responsivos e busca por artista ou turnê, com ou sem acentos.
- Detalhes de cada turnê com situação da pesquisa, agenda oficial, fotografia e atribuição.
- Reserva pela API com participantes, poltronas, meia-entrada, taxa de 10%, comprovante imprimível e atualização do estoque.
- Área técnica recolhida por padrão, com endpoints e última resposta HTTP.

As fotos são servidas em oito arquivos WebP locais — seis cards e dois destaques — que somam **850.490 bytes**. Autoria, licença, contexto e alterações estão na [página de créditos](public/creditos.html), servida em `/creditos.html`, e em [CREDITS.md](public/images/artists/CREDITS.md); as referências das turnês estão em [FONTES.md](FONTES.md). Fotos de arquivo são identificadas com seu contexto original.

**Preços, capacidades, reservas e pagamentos são demonstrativos.** O site não vende ingressos reais. Os textos registram a situação encontrada nas fontes consultadas e encaminham à agenda oficial; não inventam próximas datas nem disponibilidade comercial.

### Correções funcionais e validação da interface

- Idade em branco, valores inválidos e poltronas duplicadas são recusados com mensagem persistente e foco no campo.
- Adicionar uma pessoa após remover outra sugere uma poltrona diferente; após uma compra, o formulário é limpo e evita os lugares já confirmados nesta sessão.
- Durante o envio, os controles ficam bloqueados para impedir alterações e pedidos simultâneos.
- Falhas na listagem eliminam dados antigos e bloqueiam o envio até a reconexão.
- Requisições têm prazo de 10 segundos. Se a resposta do POST se perder, a tela informa resultado desconhecido e exige iniciar outro pedido explicitamente; não repete a reserva automaticamente.
- O recibo do POST permanece na área técnica após atualizar o catálogo, preservando a correção inicial do Marcus.
- A impressão usa fundo branco e texto preto, preserva o aviso de comprovante fictício e omite a navegação. Um recibo fechado não aparece numa impressão comum da página.
- Rótulos, campos, foco de teclado e menu móvel foram revisados; a busca encontra palavras com ou sem acento.

A suíte aprovada no PR #3 inclui detalhes das turnês e recuperação após falha inicial do catálogo. Usa as fotografias locais reais e substitui apenas fontes externas. Na conferência manual, as seis fotos dos cards carregaram e uma reserva de Bruno Mars confirmou o comprovante **#1**, com meia de **R$ 70**, taxa de **R$ 7** e total de **R$ 77**.

### Repetir as validações adicionais

```bash
node validacao/conferir-originais.mjs
node validacao/conferir-testes.mjs
node --import tsx --test validacao/backend.test.ts validacao/infra.test.mjs validacao/catalogo.test.ts
node --check public/app.js
```

O workflow executa também os testes de navegador e salva evidências em seus artefatos. O [relatório](VALIDACAO.md) explica como rodá-los separadamente, sem modificar as dependências do professor.

## Pendências para a entrega acadêmica

O código e os testes não substituem as etapas de entrega do enunciado. O grupo ainda precisa:

- Confirmar o GitHub e a contribuição real de Inácio e Rafael, com commits de cada um na própria conta.
- Gravar e publicar o vídeo seguindo o [roteiro de oito partes](docs/ROTEIRO_VIDEO.md), com o código da entrega, e substituir a indicação pendente no início deste README pelo link acessível sem login.
- Conferir o nome cadastrado do grupo e o prazo da turma e realizar o envio ao Blackboard usando o [guia e texto de entrega](docs/ENTREGA.md).

No histórico revisado, foram identificados commits das contas `Gaabllez` e `Mvsff`. Não foram inventados contas, contribuições, link de vídeo ou confirmação de envio para preencher as etapas ainda não comprovadas. O trabalho vale **3,5 pontos**: até **2,5** pelo código (`2,5 × pontos do npm test ÷ 16`), **0,75** pelas três partes da avaliação do vídeo e **0,25** pelo README completo.
