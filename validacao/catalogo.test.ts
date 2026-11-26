import assert from "node:assert/strict";
import { readFileSync, statSync } from "node:fs";
import test from "node:test";
import { criarEventosDemo, lerCatalogo, validarCatalogo } from "../src/catalogo.ts";
import { criarBilheteria } from "../src/bilheteria.ts";
import { iniciarServidorUI } from "./servidor-ui.ts";

test("catálogo reúne seis artistas, fontes HTTPS, fotos locais e referência de data", () => {
  const catalogo = lerCatalogo();
  assert.equal(catalogo.events.length, 6);
  assert.equal(new Set(catalogo.events.map((evento) => evento.artist)).size, 6);
  assert.equal(catalogo.verifiedAt, "2026-11-26");
  assert.deepEqual(new Set(catalogo.events.map((evento) => evento.category)), new Set(["pop", "rnb", "rock", "latino"]));
  for (const evento of catalogo.events) {
    assert.equal(new URL(evento.officialUrl).protocol, "https:");
    assert.equal(new URL(evento.sourceUrl).protocol, "https:");
    assert.ok(statSync(new URL(`../public${evento.image}`, import.meta.url)).size > 1000, `Foto local ausente ou vazia para ${evento.artist}`);
    assert.ok(evento.imageAlt.includes(evento.artist), `A fotografia precisa identificar ${evento.artist}`);
  }
});

test("API e simulador usam a mesma fonte de nomes, preços fictícios e capacidades", async (t) => {
  const catalogo = lerCatalogo();
  const servidor = await iniciarServidorUI();
  t.after(servidor.fechar);
  const resposta = await fetch(`${servidor.url}/eventos`);
  assert.equal(resposta.status, 200);
  assert.deepEqual(await resposta.json(), catalogo.events.map((evento) => ({
    id: evento.id,
    nome: `${evento.artist} — ${evento.tour}`,
    preco: evento.price,
    capacidade: evento.capacity,
    disponivel: evento.capacity,
  })));
  const metadados = await fetch(`${servidor.url}/catalogo.json`);
  assert.equal(metadados.status, 200);
  assert.deepEqual(await metadados.json(), JSON.parse(readFileSync(new URL("../public/catalogo.json", import.meta.url), "utf8")));
});

test("instâncias do catálogo têm estoques independentes e mantêm o evento 1 do benchmark", async () => {
  const primeira = criarEventosDemo();
  const segunda = criarEventosDemo();
  const evento = primeira.find((item) => item.id === 1)!;
  assert.equal(evento.capacidade, 100);
  assert.equal(evento.preco, 100);
  evento.reservar([1]);
  assert.equal(evento.disponivel, 99);
  assert.equal(segunda.find((item) => item.id === 1)!.disponivel, 100);
  const bilheteria = criarBilheteria({ eventos: segunda, pagar: async () => {}, limitePagamentoMs: 500 });
  const recibo = await bilheteria.reservar({ eventoId: 1, ingressos: [{ nome: "Pessoa de teste", idade: 60, estudante: false, pcd: false, poltrona: 1 }] });
  assert.equal(recibo.total, 55);
  assert.equal(recibo.ingressos[0].tipo, "meia");
  assert.equal(bilheteria.listarEventos()[0].disponivel, 99);
  assert.ok(bilheteria.listarEventos().slice(1).every((item) => item.disponivel === item.capacidade));
});

test("configuração inválida falha antes de iniciar a venda", () => {
  const catalogo = lerCatalogo();
  const invalidos = [
    null,
    { ...catalogo, verifiedAt: "2026-02-31" },
    { ...catalogo, events: [] },
    { ...catalogo, events: [catalogo.events[0], catalogo.events[0]] },
    { ...catalogo, events: [{ ...catalogo.events[0], price: -1 }] },
    { ...catalogo, events: [{ ...catalogo.events[0], capacity: 1.5 }] },
    { ...catalogo, events: [{ ...catalogo.events[0], capacity: 99 }] },
    { ...catalogo, events: [{ ...catalogo.events[0], officialUrl: "javascript:alert(1)" }] },
    { ...catalogo, events: [{ ...catalogo.events[0], image: "/images/../../segredo" }] },
    { ...catalogo, events: new Array(1) },
  ];
  for (const valor of invalidos) assert.throws(() => validarCatalogo(valor));
});
