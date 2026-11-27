import assert from "node:assert/strict";
import { once } from "node:events";
import type { AddressInfo } from "node:net";
import { gzipSync } from "node:zlib";
import test from "node:test";
import { criarAplicacao } from "../src/aplicacao.ts";
import { criarBilheteria } from "../src/bilheteria.ts";
import { criarEventosCatalogo, criarEventosDemo } from "../src/catalogo.ts";

const pedido = {
  eventoId: 1,
  ingressos: [{ nome: "Ana", idade: 25, estudante: false, pcd: false, poltrona: 1 }],
};

async function iniciar() {
  const cobrancas: number[] = [];
  const pagar = async (valor: number) => { cobrancas.push(valor); };
  const bilheteria = criarBilheteria({ eventos: criarEventosDemo(), pagar, limitePagamentoMs: 500 });
  const catalogo = criarBilheteria({ eventos: criarEventosCatalogo(), pagar, limitePagamentoMs: 500 });
  const servidor = criarAplicacao(bilheteria, catalogo).listen(0, "127.0.0.1");
  await once(servidor, "listening");
  const url = `http://127.0.0.1:${(servidor.address() as AddressInfo).port}`;
  return {
    url, cobrancas, bilheteria, catalogo,
    fechar: async () => {
      servidor.closeAllConnections();
      await new Promise<void>((resolve, reject) => servidor.close(erro => erro ? reject(erro) : resolve()));
    },
  };
}

test("JSON excessivo, codificação inválida e sintaxe inválida têm status de entrada sem cobrar", async (t) => {
  for (const caminho of ["/reservas", "/catalogo/reservas"]) {
    await t.test(caminho, async (t) => {
      const app = await iniciar();
      t.after(app.fechar);
      const estoqueOriginal = app.bilheteria.listarEventos();
      const estoqueCatalogo = app.catalogo.listarEventos();
      const casos = [
        { status: 413, body: JSON.stringify({ ...pedido, texto: "a".repeat(105_000) }), headers: {} },
        { status: 415, body: JSON.stringify(pedido), headers: { "Content-Encoding": "desconhecida" } },
        { status: 415, body: JSON.stringify(pedido), headers: { "Content-Type": "application/json; charset=iso-8859-1" } },
        { status: 400, body: "isto nao e gzip", headers: { "Content-Encoding": "gzip" } },
        { status: 400, body: "{", headers: {} },
      ];
      for (const caso of casos) {
        const resposta = await fetch(app.url + caminho, {
          method: "POST",
          headers: { "Content-Type": "application/json", ...caso.headers },
          body: caso.body,
        });
        assert.equal(resposta.status, caso.status);
        assert.match(resposta.headers.get("content-type") ?? "", /application\/json/);
        const erro = await resposta.json();
        assert.deepEqual(Object.keys(erro), ["mensagem"]);
        assert.equal(typeof erro.mensagem, "string");
        assert.equal(app.cobrancas.length, 0);
        assert.deepEqual(app.bilheteria.listarEventos(), estoqueOriginal);
        assert.deepEqual(app.catalogo.listarEventos(), estoqueCatalogo);
      }
      // O corpo continua chegando normalmente às rotas depois de uma entrada inválida.
      const resposta = await fetch(app.url + caminho, {
        method: "POST", headers: { "Content-Type": "application/json", "Content-Encoding": "gzip" }, body: gzipSync(JSON.stringify(pedido)),
      });
      assert.equal(resposta.status, 201);
      assert.equal((await resposta.json()).total, 110);
      assert.deepEqual(app.cobrancas, [110]);
    });
  }
});

test("aplicação serve o site e as duas APIs com reservas e estoques independentes", async (t) => {
  const app = await iniciar();
  t.after(app.fechar);
  const pagina = await fetch(app.url);
  assert.equal(pagina.status, 200);
  assert.match(pagina.headers.get("content-type") ?? "", /text\/html/);
  assert.match(await pagina.text(), /<html/);
  const [original, catalogo, editorial] = await Promise.all(
    ["/eventos", "/catalogo/eventos", "/catalogo.json"].map(async caminho => {
      const resposta = await fetch(app.url + caminho);
      assert.equal(resposta.status, 200);
      return resposta.json();
    }),
  );
  assert.deepEqual(original.map((evento: { id: number }) => evento.id), [1, 2, 3]);
  assert.equal(catalogo.length, 14);
  assert.deepEqual(catalogo.map((evento: { id: number }) => evento.id), editorial.events.map((evento: { id: number }) => evento.id));
  for (const caminho of ["/reservas", "/catalogo/reservas"]) {
    const resposta = await fetch(app.url + caminho, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(pedido),
    });
    assert.equal(resposta.status, 201);
    assert.equal((await resposta.json()).total, 110);
  }
  assert.equal(app.bilheteria.listarEventos()[0].disponivel, 99);
  assert.equal(app.catalogo.listarEventos()[0].disponivel, 99);
  assert.deepEqual(app.cobrancas, [110, 110]);
});
