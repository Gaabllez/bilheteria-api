# Bilheteria concorrente

**Link do vídeo:** pendente de gravação e publicação.

Projeto final de Paradigmas de Linguagens de Programação, baseado no [modelo do professor](https://github.com/douglasmeneses/bilheteria-projeto-final).

## Integrantes

| Nome | RGM | GitHub | Parte principal |
|---|---|---|---|
| Gabriel Galvão Fredrich | 33632308 | Gaabllez | A confirmar |
| Inácio Assis dos Santos Netto | 32830980 | A confirmar | A confirmar |
| Marcus Vinícius Souza Fernandes Filho | 33204128 | Mvsff | Painel web responsivo e preservação do comprovante após atualização dos eventos |
| Rafael Olívio Ribeiro Campos | 34289461 | A confirmar | A confirmar |

## Executar

Node.js 22 ou superior.

```bash
npm ci
npm test
npm run typecheck
npm start
```

Com o servidor ativo, abra [http://localhost:3000](http://localhost:3000) para usar o catálogo e reservar ingressos de demonstração. A camada HTTP original do professor permanece intacta. A porta padrão é 3000; `PORT` permite outra porta quando o ambiente precisar.

Em outro terminal:

```bash
curl http://localhost:3000/eventos
curl -X POST http://localhost:3000/reservas -H 'Content-Type: application/json' -d '{"eventoId":1,"ingressos":[{"nome":"Ana","idade":20,"estudante":true,"pcd":false,"poltrona":7}]}'
npm run bench
```

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
| Revisão completa (GitHub Actions, 26/11/2026) | 200 | 246 | 90 | 100 | 10 |

**Resultado medido:** [execução #5 no GitHub Actions](https://github.com/Gaabllez/bilheteria-api/actions/runs/45747150604), no Ubuntu com Node.js 22. Foram 200 pedidos em 168 ms (1194 pedidos/s). Os resultados variam devido à falha aleatória de 10% da operadora simulada. Reinicie o servidor antes de repetir o benchmark.

**Revisão completa:** [execução 45749110996](https://github.com/Gaabllez/bilheteria-api/actions/runs/45749110996), commit `5b2a15a`, em Node.js 22.23.5: 200 pedidos em 246 ms (814 pedidos/s), com 90 reservas, 100 conflitos e 10 recusas simuladas. O verificador confirmou as 10 poltronas restantes e que os outros eventos não foram alterados. O tempo de execução varia entre máquinas; não é uma comparação de desempenho entre versões.

## Histórico de atualizações e validação

- `0efed25`: implementação da API, regras de meia-entrada, cálculo funcional, domínio e reservas concorrentes.
- `86196cc`: configuração de GitHub Actions para typecheck, testes originais e benchmark.
- `9abc09e` (Mvsff): painel web responsivo com listagem de eventos, formulário e respostas HTTP.
- `98fa503` (Mvsff): preservação da resposta da reserva ao atualizar eventos.
- `0635c27`: integração do painel pelo main.ts e restauração do servidor original.
- `8e49302` / [PR #1](https://github.com/Gaabllez/bilheteria-api/pull/1): catálogo e experiência visual de bilheteria.
- `a70cb49`: validação de entrada da API, correções de formulário/conexão/comprovante e novas regressões.
- `5b2a15a` / [PR #2](https://github.com/Gaabllez/bilheteria-api/pull/2): teste móvel corrigido e Actions atualizadas para runtime suportado.

### Estado da validação

Na [validação completa de 26/11/2026](https://github.com/Gaabllez/bilheteria-api/actions/runs/45749110996), os dois jobs (`validar` e `interface`) passaram em Node.js 22.23.5:

| Verificação | Resultado |
|---|---|
| Instalação com lockfile e TypeScript | Aprovados |
| Testes originais do professor | 14 cenários, **16/16 pontos** |
| Regressões de backend e do gate | **32 testes/subtestes aprovados** (29 do backend + 3 do gate) |
| Interface no Chromium | **14 cenários aprovados**, desktop e larguras móveis de 360, 390 e 768 px |
| Arquivos fornecidos pelo professor | **10 preservados**, verificados por hash |
| Benchmark de 200 pedidos | Sem exceder capacidade; contagem e estoque consistentes |
| Auditoria de dependências | Zero vulnerabilidades reportadas na revisão |

O executor original retorna código zero mesmo quando um teste falha. Por isso, `validacao/conferir-testes.mjs` exige os **16 pontos e todos os cenários aprovados**. Os arquivos originais em `testes/` não foram alterados. As regressões novas ficam em `validacao/`.

O [relatório de validação](VALIDACAO.md) registra erros reproduzidos, correções, comandos, evidências e limites dos testes.

## Nova experiência web: bilheteria para público

A interface demonstrativa de **Marcus (Mvsff)** foi preservada e aprimorada em `public/`, sem alterar os dez arquivos protegidos. A atualização inclui:

- Página inicial com identidade visual, catálogo com fotografias e layout responsivo.
- Busca por nome e filtros de shows, teatro e festivais.
- Consulta real de disponibilidade em `GET /eventos`, sem dados falsos de poltronas ocupadas.
- Fluxo de reserva com múltiplos participantes, escolha de poltrona e meia-entrada calculada em tempo real.
- Resumo com subtotal, taxa de serviço de 10% e valor total, seguindo as fórmulas do backend.
- Confirmação via `POST /reservas`, com comprovante imprimível e atualização do catálogo após compra.
- Mensagens específicas para conflitos HTTP 409 e falhas de pagamento simuladas HTTP 502.
- Área técnica recolhível com os endpoints e a última resposta JSON.

**Atenção:** evento, imagens e pagamentos são **demonstrativos**; o sistema não vende ingressos reais, não seleciona assentos disponíveis individualmente e não processa pagamentos de verdade. Execute `npm start` e abra [http://localhost:3000](http://localhost:3000).

### Correções funcionais e validação da interface

- Idade em branco, valores inválidos e poltronas duplicadas são recusados com mensagem persistente e foco no campo.
- Adicionar uma pessoa após remover outra sugere uma poltrona diferente; após uma compra, o formulário é limpo e evita os lugares já confirmados nesta sessão.
- Durante o envio, os controles ficam bloqueados para impedir alterações e pedidos simultâneos.
- Falhas na listagem eliminam dados antigos e bloqueiam o envio até a reconexão.
- Requisições têm prazo de 10 segundos. Se a resposta do POST se perder, a tela informa resultado desconhecido e exige iniciar outro pedido explicitamente; não repete a reserva automaticamente.
- O recibo do POST permanece na área técnica após atualizar o catálogo, preservando a correção inicial do Marcus.
- A impressão mantém o aviso de comprovante fictício, e um recibo fechado não aparece numa impressão comum da página.
- Rótulos, campos, foco de teclado e menu móvel foram revisados; a busca encontra palavras com ou sem acento.

Além da automação, a interface foi inspecionada no navegador com imagens reais. Foram realizadas duas reservas na API de demonstração, incluindo três participantes, meia por estudante/idade, subtotal, taxa, comprovante e atualização da disponibilidade. A suíte automatizada substitui imagens e fontes externas para testar os fluxos sem depender desses serviços.

### Repetir as validações adicionais

```bash
node validacao/conferir-originais.mjs
node validacao/conferir-testes.mjs
node --import tsx --test validacao/backend.test.ts validacao/infra.test.mjs
node --check public/app.js
```

O workflow executa também os testes de navegador e salva evidências em seus artefatos. O [relatório](VALIDACAO.md) explica como rodá-los separadamente, sem modificar as dependências do professor.

## Pendências para a entrega acadêmica

O código e os testes não substituem as etapas de entrega do enunciado. Ainda é necessário informar o link do vídeo, confirmar o GitHub e a contribuição de todos os integrantes e verificar os commits próprios de cada pessoa. Na revisão do histórico, foram identificados commits das contas `Gaabllez` e `Mvsff`; a contribuição das demais contas precisa ser confirmada pelo grupo. O README mantém os campos desconhecidos como pendentes.
