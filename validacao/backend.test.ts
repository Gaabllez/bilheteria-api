import assert from "node:assert/strict";
import { once } from "node:events";
import type { AddressInfo } from "node:net";
import test from "node:test";
import { criarBilheteria } from "../src/bilheteria.ts";
import { DadosInvalidosErro, Evento, NaoEncontradoErro, PagamentoErro, PoltronaOcupadaErro } from "../src/dominio.ts";
import type { Pagamento } from "../src/pagamento.ts";
import { aplicarTaxa, calcularTotal, valorDoIngresso } from "../src/preco.ts";
import { criarServidor } from "../src/servidor.ts";
import type { Pedido, Pessoa } from "../src/tipos.ts";

const pessoa = (poltrona = 1): Pessoa => ({ nome: "Ana", idade: 25, estudante: false, pcd: false, poltrona });
const pedido = (ingressos = [pessoa()]): Pedido => ({ eventoId: 1, ingressos });

function montar(pagar: Pagamento = async () => {}, limitePagamentoMs = 500) {
  const evento = new Evento(1, "Show", 100, 10);
  const bilheteria = criarBilheteria({ eventos: [evento], pagar, limitePagamentoMs });
  return { evento, bilheteria };
}

test("pessoas inválidas são recusadas antes de reservar ou cobrar", async (t) => {
  const invalidos: Array<[string, unknown]> = [
    ["pessoa nula", null],
    ["pessoa em array", []],
    ["nome ausente", { ...pessoa(), nome: undefined }],
    ["nome vazio", { ...pessoa(), nome: "   " }],
    ["nome numérico", { ...pessoa(), nome: 123 }],
    ["nome acima do limite do formulário", { ...pessoa(), nome: "a".repeat(81) }],
    ["idade ausente", { ...pessoa(), idade: undefined }],
    ["idade em texto", { ...pessoa(), idade: "25" }],
    ["idade negativa", { ...pessoa(), idade: -1 }],
    ["idade fracionária", { ...pessoa(), idade: 25.5 }],
    ["idade acima do limite do formulário", { ...pessoa(), idade: 121 }],
    ["idade NaN", { ...pessoa(), idade: NaN }],
    ["idade infinita", { ...pessoa(), idade: Infinity }],
    ["estudante ausente", { ...pessoa(), estudante: undefined }],
    ["estudante em texto", { ...pessoa(), estudante: "false" }],
    ["PcD em texto", { ...pessoa(), pcd: "false" }],
    ["PcD numérico", { ...pessoa(), pcd: 1 }],
  ];
  for (const [nome, valor] of invalidos) {
    await t.test(nome, async () => {
      let cobrancas = 0;
      const { bilheteria, evento } = montar(async () => { cobrancas++; });
      const entrada = { eventoId: 1, ingressos: [pessoa(1), valor] } as Pedido;
      await assert.rejects(bilheteria.reservar(entrada), DadosInvalidosErro);
      assert.equal(cobrancas, 0);
      assert.equal(evento.disponivel, 10);
    });
  }
});

test("pedido ausente, malformado ou com lista esparsa não altera o estoque", async () => {
  let cobrancas = 0;
  const { bilheteria, evento } = montar(async () => { cobrancas++; });
  const invalidos = [undefined, null, [], {}, { eventoId: 1 }, { eventoId: 1, ingressos: null },
    { eventoId: 1, ingressos: {} }, { eventoId: 1, ingressos: [] }, { eventoId: 1, ingressos: new Array(1) }];
  for (const valor of invalidos) await assert.rejects(bilheteria.reservar(valor as Pedido), DadosInvalidosErro);
  assert.equal(cobrancas, 0);
  assert.equal(evento.disponivel, 10);
});

test("evento inexistente continua 404 e poltronas inválidas continuam 400", async () => {
  let cobrancas = 0;
  const { bilheteria, evento } = montar(async () => { cobrancas++; });
  await assert.rejects(bilheteria.reservar({ ...pedido(), eventoId: 999 }), NaoEncontradoErro);
  for (const poltrona of [0, -1, 11, 1.5, NaN, Infinity, "1", null, undefined]) {
    await assert.rejects(bilheteria.reservar(pedido([{ ...pessoa(), poltrona: poltrona as number }])), DadosInvalidosErro);
  }
  assert.equal(cobrancas, 0);
  assert.equal(evento.disponivel, 10);
});

test("lista esparsa e liberação parcialmente inválida preservam a atomicidade de Evento", () => {
  const evento = new Evento(1, "Show", 100, 3);
  assert.throws(() => evento.reservar(new Array(1)), DadosInvalidosErro);
  assert.equal(evento.disponivel, 3);
  evento.reservar([1, 2]);
  assert.throws(() => evento.liberar([1, 3]), DadosInvalidosErro);
  assert.throws(() => evento.liberar(new Array(1)), DadosInvalidosErro);
  assert.equal(evento.disponivel, 1);
  assert.throws(() => evento.reservar([1]), PoltronaOcupadaErro);
  evento.liberar([1, 2]);
  assert.equal(evento.disponivel, 3);
});

test("falha síncrona ou rejeição devolve o grupo inteiro e permite nova compra", async (t) => {
  for (const modo of ["síncrona", "rejeição"] as const) {
    await t.test(modo, async () => {
      let tentativa = 0;
      const { bilheteria, evento } = montar(() => {
        if (tentativa++ > 0) return Promise.resolve();
        if (modo === "síncrona") throw new Error("falha imediata");
        return Promise.reject(new Error("pagamento recusado"));
      });
      const entrada = pedido([pessoa(1), pessoa(2)]);
      await assert.rejects(bilheteria.reservar(entrada), PagamentoErro);
      assert.equal(evento.disponivel, 10);
      const comprovante = await bilheteria.reservar(entrada);
      assert.equal(comprovante.total, 220);
      assert.equal(comprovante.reservaId, 1);
      assert.equal(evento.disponivel, 8);
      assert.equal(tentativa, 2);
    });
  }
});

test("pagamento travado expira e a rejeição tardia não remove uma venda posterior", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  let rejeitarAntigo!: (erro: Error) => void;
  let tentativa = 0;
  const { bilheteria, evento } = montar(() => ++tentativa === 1
    ? new Promise<void>((_, reject) => { rejeitarAntigo = reject; })
    : Promise.resolve(), 50);
  const expirado = assert.rejects(bilheteria.reservar(pedido()), PagamentoErro);
  assert.equal(evento.disponivel, 9);
  t.mock.timers.tick(51);
  await expirado;
  assert.equal(evento.disponivel, 10);
  const comprovante = await bilheteria.reservar(pedido());
  assert.equal(comprovante.reservaId, 1);
  rejeitarAntigo(new Error("recusa atrasada"));
  await Promise.resolve();
  assert.equal(evento.disponivel, 9);
  await assert.rejects(bilheteria.reservar(pedido()), PoltronaOcupadaErro);
});

test("pagamentos independentes concluem fora de ordem sem duplicar IDs nem cobranças", async () => {
  const concluir: Array<() => void> = [];
  const { bilheteria, evento } = montar(() => new Promise<void>(resolve => { concluir.push(resolve); }));
  const primeira = bilheteria.reservar(pedido([pessoa(1)]));
  const segunda = bilheteria.reservar(pedido([pessoa(2)]));
  assert.equal(concluir.length, 2, "a segunda cobrança não pode esperar a primeira");
  await assert.rejects(bilheteria.reservar(pedido([pessoa(1)])), PoltronaOcupadaErro);
  assert.equal(concluir.length, 2, "pedido em conflito não pode ser cobrado");
  concluir[1]();
  const segundoComprovante = await segunda;
  concluir[0]();
  const primeiroComprovante = await primeira;
  assert.notEqual(primeiroComprovante.reservaId, segundoComprovante.reservaId);
  assert.equal(evento.disponivel, 8);
});

test("pedido e respostas são isolados do estado interno durante o pagamento", async () => {
  let concluir!: () => void;
  const { bilheteria, evento } = montar(() => new Promise<void>(resolve => { concluir = resolve; }));
  const entrada = pedido();
  const pendente = bilheteria.reservar(entrada);
  entrada.ingressos[0].nome = "Alterado depois";
  entrada.ingressos[0].poltrona = 2;
  const listagem = bilheteria.listarEventos();
  listagem[0].disponivel = 999;
  listagem[0].nome = "Outro evento";
  concluir();
  const comprovante = await pendente;
  assert.equal(comprovante.ingressos[0].nome, "Ana");
  assert.equal(comprovante.ingressos[0].poltrona, 1);
  comprovante.ingressos[0].poltrona = 3;
  assert.equal(evento.disponivel, 9);
  assert.equal(bilheteria.listarEventos()[0].nome, "Show");
  await assert.rejects(bilheteria.reservar(pedido()), PoltronaOcupadaErro);
});

test("meias por idade, estudo e PcD usam uma única redução e taxa sobre a soma", async () => {
  const cobrancas: number[] = [];
  const evento = new Evento(1, "Teatro", 30.5, 5);
  const bilheteria = criarBilheteria({ eventos: [evento], pagar: async valor => { cobrancas.push(valor); }, limitePagamentoMs: 500 });
  const entrada = pedido([
    { ...pessoa(1), idade: 59 },
    { ...pessoa(2), idade: 60 },
    { ...pessoa(3), estudante: true },
    { ...pessoa(4), pcd: true },
    { ...pessoa(5), idade: 80, estudante: true, pcd: true },
  ]);
  const antes = structuredClone(entrada);
  const comprovante = await bilheteria.reservar(entrada);
  assert.deepEqual(comprovante.ingressos.map(i => i.valor), [30.5, 15.25, 15.25, 15.25, 15.25]);
  assert.equal(comprovante.total, 100.65);
  assert.deepEqual(cobrancas, [100.65]);
  assert.deepEqual(entrada, antes);
});

test("meia e taxa arredondam corretamente empates de meio centavo", () => {
  assert.equal(valorDoIngresso(2.01)("meia"), 1.01);
  assert.equal(valorDoIngresso(1.15)("meia"), 0.58);
  assert.equal(valorDoIngresso(2.01)("inteira"), 2.01);
  assert.equal(aplicarTaxa(0.1)(17.15), 18.87);
  assert.equal(aplicarTaxa(0.1)(33.05), 36.36);
  assert.equal(aplicarTaxa(0)(17.15), 17.15);
  assert.equal(calcularTotal([{ nome: "Ana", poltrona: 1, tipo: "inteira", valor: 17.15 }]), 18.87);
});

test("reserva de preço fracionário cobra os mesmos centavos do comprovante", async () => {
  const cobrancas: number[] = [];
  const bilheteria = criarBilheteria({
    eventos: [new Evento(1, "Preço fracionário", 2.01, 2)],
    pagar: async valor => { cobrancas.push(valor); },
    limitePagamentoMs: 500,
  });
  const meia = await bilheteria.reservar(pedido([{ ...pessoa(1), estudante: true }]));
  const inteira = await bilheteria.reservar(pedido([pessoa(2)]));
  assert.deepEqual(meia.ingressos, [{ nome: "Ana", poltrona: 1, tipo: "meia", valor: 1.01 }]);
  assert.equal(meia.total, 1.11);
  assert.equal(inteira.ingressos[0].valor, 2.01);
  assert.equal(inteira.total, 2.21);
  assert.deepEqual(cobrancas, [1.11, 2.21]);
  assert.equal(bilheteria.listarEventos()[0].disponivel, 0);
});

test("HTTP valida JSON e dados, mantém 404/409/502 e permite refazer pagamento recusado", async (t) => {
  let falhar = false;
  let cobrancas = 0;
  const { bilheteria, evento } = montar(async () => {
    cobrancas++;
    if (falhar) throw new Error("recusado");
  });
  const servidor = criarServidor(bilheteria).listen(0, "127.0.0.1");
  await once(servidor, "listening");
  t.after(() => new Promise<void>((resolve, reject) => {
    servidor.close(erro => erro ? reject(erro) : resolve());
    servidor.closeAllConnections();
  }));
  const url = `http://127.0.0.1:${(servidor.address() as AddressInfo).port}`;
  const post = (body: string, contentType = "application/json") => fetch(`${url}/reservas`, {
    method: "POST", headers: { "Content-Type": contentType }, body,
  });
  const catalogo = await fetch(`${url}/eventos`);
  assert.equal(catalogo.status, 200);
  assert.equal((await catalogo.json())[0].disponivel, 10);
  for (const corpo of ["{", "null", "[]", "{}", JSON.stringify({ ...pedido(), ingressos: [{ ...pessoa(), estudante: "false" }] })]) {
    const resposta = await post(corpo);
    assert.equal(resposta.status, 400, corpo);
    assert.equal(typeof (await resposta.json()).mensagem, "string");
  }
  assert.equal((await post(JSON.stringify(pedido()), "text/plain")).status, 400);
  assert.equal((await post(JSON.stringify({ ...pedido(), eventoId: 999 }))).status, 404);
  assert.equal(cobrancas, 0);
  assert.equal(evento.disponivel, 10);
  falhar = true;
  assert.equal((await post(JSON.stringify(pedido()))).status, 502);
  assert.equal(evento.disponivel, 10);
  falhar = false;
  const compra = await post(JSON.stringify(pedido()));
  assert.equal(compra.status, 201);
  assert.equal((await compra.json()).total, 110);
  assert.equal((await post(JSON.stringify(pedido()))).status, 409);
  assert.equal(cobrancas, 2);
  assert.equal(evento.disponivel, 9);
});
