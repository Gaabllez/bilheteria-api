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
npm install
npm test
npm run typecheck
npm start
```

Com o servidor ativo, abra http://localhost:3000 para usar o painel web (listagem de eventos, reservas e respostas HTTP). O painel é um complemento; a camada HTTP original do professor permanece intacta.

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

**Resultado medido:** [execução #5 no GitHub Actions](https://github.com/Gaabllez/bilheteria-api/actions/runs/45747150604), no Ubuntu com Node.js 22. Foram 200 pedidos em 168 ms (1194 pedidos/s). Os resultados variam devido à falha aleatória de 10% da operadora simulada. Reinicie o servidor antes de repetir o benchmark.

## Histórico de atualizações e validação

- `0efed25`: implementação da API, regras de meia-entrada, cálculo funcional, domínio e reservas concorrentes.
- `86196cc`: configuração de GitHub Actions para typecheck, testes originais e benchmark.
- `9abc09e` (Mvsff): painel web responsivo com listagem de eventos, formulário e respostas HTTP.
- `98fa503` (Mvsff): preservação da resposta da reserva ao atualizar eventos.
- `0635c27`: integração do painel pelo main.ts e restauração do servidor original.

### Estado da validação

Os dez arquivos protegidos foram comparados com o modelo do professor e possuem SHA idêntico. Na [execução do GitHub Actions de 26/11/2026](https://github.com/Gaabllez/bilheteria-api/actions/runs/45747150604), `npm ci`, `npm run typecheck`, `npm test` (**16 de 16 pontos, 100%**) e `npm run bench` foram concluídos com sucesso. Essa validação cobre o backend e as requisições HTTP, mas não substitui inspeção visual e testes de interação no navegador.

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

### Verificação estática do front-end

O JavaScript passou em verificação sintática, os seletores de IDs usados pelo script estão presentes no HTML e as chaves do CSS estão balanceadas. A validação automática do professor continua sendo executada pelo GitHub Actions; a interface também deve ser inspecionada no navegador em desktop e celular.
