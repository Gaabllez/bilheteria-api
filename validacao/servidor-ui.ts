import express from "express";
import { setTimeout as esperar } from "node:timers/promises";
import { fileURLToPath } from "node:url";
import type { AddressInfo } from "node:net";
import { criarBilheteria } from "../src/bilheteria.ts";
import { Evento } from "../src/dominio.ts";
import { criarServidor } from "../src/servidor.ts";

// A API e o domínio são os mesmos do aplicativo. Somente a operadora é injetada
// para aprovar sempre e tornar os testes da interface independentes da aleatoriedade.
export async function iniciarServidorUI() {
  const eventos = [
    new Evento(1, "Show", 100, 100),
    new Evento(2, "Teatro", 80, 60),
    new Evento(3, "Festival", 150, 200),
  ];
  const bilheteria = criarBilheteria({
    eventos,
    pagar: async () => { await esperar(25); },
    limitePagamentoMs: 500,
  });
  const app = criarServidor(bilheteria);
  app.use(express.static(fileURLToPath(new URL("../public/", import.meta.url))));
  const servidor = app.listen(0, "127.0.0.1");
  await new Promise<void>((resolver, rejeitar) => {
    servidor.once("listening", resolver);
    servidor.once("error", rejeitar);
  });
  const endereco = servidor.address() as AddressInfo;
  return {
    url: `http://127.0.0.1:${endereco.port}`,
    fechar: async () => {
      servidor.closeAllConnections();
      await new Promise<void>((resolver, rejeitar) => {
        servidor.close((erro) => erro ? rejeitar(erro) : resolver());
      });
    },
  };
}
