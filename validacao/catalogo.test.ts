import assert from "node:assert/strict";
import { readFileSync, statSync } from "node:fs";
import test from "node:test";
import { criarEventosDemo, lerCatalogo, validarCatalogo } from "../src/catalogo.ts";
import { criarBilheteria } from "../src/bilheteria.ts";
import { NaoEncontradoErro } from "../src/dominio.ts";
import { iniciarServidorUI } from "./servidor-ui.ts";

test("catálogo reúne 14 registros editoriais, com 12 artistas e dois espetáculos teatrais, fontes HTTPS, imagens licenciadas e referência de data", () => {
  const catalogo = lerCatalogo();
  assert.equal(catalogo.events.length, 14);
  assert.equal(new Set(catalogo.events.map((evento) => evento.artist)).size, 14);
  assert.deepEqual(catalogo.events.filter((evento) => evento.reservable).map((evento) => evento.id), catalogo.events.map((evento) => evento.id));
  assert.deepEqual(catalogo.events.filter((evento) => !evento.reservable).map((evento) => evento.id), []);
  assert.equal(catalogo.verifiedAt, "2026-11-26");
  assert.deepEqual(new Set(catalogo.events.map((evento) => evento.category)), new Set(["pop", "rnb", "rock", "latino", "theatre"]));
  const phantom = catalogo.events.find((evento) => evento.id === 107)!;
  const wicked = catalogo.events.find((evento) => evento.id === 108)!;
  assert.equal(phantom.year, "Desde 1986 (Londres)");
  assert.match(phantom.sources[0].supports, /1986/);
  assert.equal(wicked.year, "Desde 2003 (Broadway)");
  assert.match(wicked.sources[0].supports, /2003/);
  assert.equal(phantom.reservable, true);
  assert.equal(wicked.reservable, true);
  for (const evento of catalogo.events) {
    assert.equal(new URL(evento.officialUrl).protocol, "https:");
    assert.equal(new URL(evento.sourceUrl).protocol, "https:");
    if (evento.image.startsWith("/images/")) {
      assert.ok(statSync(new URL(`../public${evento.image}`, import.meta.url)).size > 1000, `Imagem local ausente ou vazia para ${evento.artist}`);
    } else {
      const imagem = new URL(evento.image);
      assert.equal(imagem.protocol, "https:");
      assert.equal(imagem.hostname, "commons.wikimedia.org");
      assert.ok(imagem.pathname.startsWith("/wiki/Special:FilePath/"));
    }
    assert.ok(evento.imageAlt.includes(evento.artist), `O texto alternativo precisa identificar ${evento.artist}`);
  }
});

test("API original mantém os três eventos exigidos pelo enunciado", async (t) => {
  const catalogo = lerCatalogo();
  const servidor = await iniciarServidorUI();
  t.after(servidor.fechar);
  const resposta = await fetch(`${servidor.url}/eventos`);
  assert.equal(resposta.status, 200);
  const eventos = await resposta.json();
  assert.equal(eventos.length, 3);
  assert.deepEqual(eventos, catalogo.events.filter((evento) => [1, 2, 3].includes(evento.id)).map((evento) => ({
    id: evento.id,
    nome: `${evento.artist} — ${evento.tour}`,
    preco: evento.price,
    capacidade: evento.capacity,
    disponivel: evento.capacity,
  })));
  const metadados = await fetch(`${servidor.url}/catalogo.json`);
  assert.equal(metadados.status, 200);
  assert.deepEqual(await metadados.json(), JSON.parse(readFileSync(new URL("../public/catalogo.json", import.meta.url), "utf8")));
  for (const evento of catalogo.events.filter((item) => !item.reservable)) {
    const tentativa = await fetch(`${servidor.url}/reservas`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ eventoId: evento.id, ingressos: [{ nome: "Pessoa de teste", idade: 25, estudante: false, pcd: false, poltrona: 1 }] }),
    });
    assert.equal(tentativa.status, 404, `${evento.artist} tem conteúdo editorial, sem reserva na API.`);
  }
});

test("interface disponibiliza todos os 14 shows para simulação e permite reservar um registro expandido", async (t) => {
  const catalogo = lerCatalogo();
  const servidor = await iniciarServidorUI();
  t.after(servidor.fechar);
  const eventos = await fetch(`${servidor.url}/catalogo/eventos`).then((resposta) => resposta.json());
  assert.equal(eventos.length, catalogo.events.length);
  assert.deepEqual(eventos.map((evento: { id: number }) => evento.id), catalogo.events.map((evento) => evento.id));
  const coldplay = eventos.find((evento: { id: number }) => evento.id === 4)!;
  const resposta = await fetch(`${servidor.url}/catalogo/reservas`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ eventoId: coldplay.id, ingressos: [{ nome: "Pessoa teste", idade: 25, estudante: false, pcd: false, poltrona: 1 }] }),
  });
  assert.equal(resposta.status, 201);
  const recibo = await resposta.json();
  assert.equal(recibo.eventoId, 4);
  assert.equal(recibo.ingressos[0].poltrona, 1);
  const atualizado = await fetch(`${servidor.url}/catalogo/eventos`).then((r) => r.json());
  assert.equal(atualizado.find((evento: { id: number }) => evento.id === 4).disponivel, coldplay.capacidade - 1);
});

test("artistas editoriais não geram estoque, reservas ou cobranças", async () => {
  let cobrancas = 0;
  const bilheteria = criarBilheteria({
    eventos: criarEventosDemo(),
    pagar: async () => { cobrancas += 1; },
    limitePagamentoMs: 500,
  });
  const antes = bilheteria.listarEventos();
  for (const eventoId of [4, 5, 6, 101, 102, 103, 104, 105, 106, 107, 108]) {
    await assert.rejects(() => bilheteria.reservar({
      eventoId,
      ingressos: [{ nome: "Pessoa de teste", idade: 25, estudante: false, pcd: false, poltrona: 1 }],
    }), NaoEncontradoErro);
  }
  assert.equal(cobrancas, 0);
  assert.deepEqual(bilheteria.listarEventos(), antes);
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
  const alterarPrimeiro = (campos: Record<string, unknown>) => ({
    ...catalogo,
    events: catalogo.events.map((evento) => evento.id === 1 ? { ...evento, ...campos } : evento),
  });
  const invalidos = [
    { valor: null, erro: /ao menos um evento/ },
    { valor: { ...catalogo, verifiedAt: "2026-02-31" }, erro: /data ISO válida/ },
    { valor: { ...catalogo, events: [] }, erro: /ao menos um evento/ },
    { valor: { ...catalogo, events: [catalogo.events[0], ...catalogo.events] }, erro: /IDs devem ser/ },
    { valor: alterarPrimeiro({ price: -1 }), erro: /preço fictício e capacidade/ },
    { valor: alterarPrimeiro({ capacity: 1.5 }), erro: /preço fictício e capacidade/ },
    { valor: alterarPrimeiro({ capacity: 99 }), erro: /evento 1 disponível/ },
    { valor: alterarPrimeiro({ officialUrl: "javascript:alert(1)" }), erro: /link HTTPS/ },
    { valor: alterarPrimeiro({ image: "/images/../../segredo" }), erro: /arquivo local/ },
    { valor: alterarPrimeiro({ reservable: undefined }), erro: /reservable precisa indicar/ },
    { valor: alterarPrimeiro({ reservable: "true" }), erro: /reservable precisa indicar/ },
    { valor: { ...catalogo, events: new Array(6) }, erro: /IDs devem ser/ },
  ];
  for (const { valor, erro } of invalidos) assert.throws(() => validarCatalogo(valor), erro);
});

test("configuração permite catálogo expandido, exige ao menos três eventos e mantém o evento 1 do benchmark", () => {
  const catalogo = lerCatalogo();
  const selecionar = (ids: number[]) => ({
    ...catalogo,
    events: catalogo.events.map((evento) => ({ ...evento, reservable: ids.includes(evento.id) })),
  });
  assert.doesNotThrow(() => validarCatalogo(selecionar([1, 2, 3])));
  assert.doesNotThrow(() => validarCatalogo(selecionar([1, 2, 3, 4])));
  assert.throws(() => validarCatalogo(selecionar([1, 2])), /ao menos três eventos/);
  assert.throws(() => validarCatalogo(selecionar([2, 3, 4])), /evento 1 disponível/);
  assert.throws(() => validarCatalogo({
    ...catalogo,
    events: catalogo.events.map((evento) => evento.id === 1 ? { ...evento, id: 7 } : evento),
  }), /evento 1 disponível/);
});
