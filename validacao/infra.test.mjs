import test from "node:test";
import assert from "node:assert/strict";
import { conferirResultado } from "./conferir-testes.mjs";

const resultado = (pontos, ok) => `@@RESULTADO@@${JSON.stringify({ pontos, total: 16, itens: [{ nome: "cenário de controle", peso: 16, ok, erro: ok ? "" : "falha simulada" }] })}`;

test("gate reprova 0/16 mesmo se o executor retornar exit(0)", () => {
  assert.throws(() => conferirResultado(resultado(0, false), 0), /reprovada/);
});
test("gate aceita a bateria completa e confere os itens", () => {
  assert.equal(conferirResultado(resultado(16, true), 0).pontos, 16);
  assert.throws(() => conferirResultado(resultado(16, false), 0), /reprovada/);
});
test("gate reprova erro de execução, saída ausente ou JSON truncado", () => {
  assert.throws(() => conferirResultado(resultado(16, true), 1), /status/);
  assert.throws(() => conferirResultado("", 0), /ausente/);
  assert.throws(() => conferirResultado("@@RESULTADO@@{", 0), SyntaxError);
});
