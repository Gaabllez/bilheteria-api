import express from "express";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Evento } from "./dominio.ts";
import { criarBilheteria } from "./bilheteria.ts";
import { criarPagamentoFalso } from "./pagamento.ts";
import { criarServidor } from "./servidor.ts";
const eventos = [new Evento(1, "Show", 100, 100), new Evento(2, "Teatro", 80, 60), new Evento(3, "Festival", 150, 200)];
const pagar = criarPagamentoFalso({ latenciaMs: 80, taxaDeFalha: 0.1 });
const bilheteria = criarBilheteria({ eventos, pagar, limitePagamentoMs: 500 });
const app = criarServidor(bilheteria);
app.use(express.static(resolve(dirname(fileURLToPath(import.meta.url)), "../public")));
const porta = Number(process.env.PORT ?? 3000);
if (!Number.isInteger(porta) || porta < 1 || porta > 65535) {
  throw new Error("PORT deve ser um número inteiro entre 1 e 65535.");
}
app.listen(porta, () => console.log(`Bilheteria em http://localhost:${porta}`));
