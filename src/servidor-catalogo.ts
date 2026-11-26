// Rotas adicionais da interface para simulação de reservas em todo o catálogo.
// Mantém src/servidor.ts e a API original do professor intactos.
import express from "express";
import type { NextFunction, Request, Response } from "express";
import type { Bilheteria } from "./bilheteria.ts";
import { ErroDeNegocio } from "./dominio.ts";

export function criarServidorCatalogo(bilheteria: Bilheteria) {
  const router = express.Router();

  router.get("/catalogo/eventos", (req, res) => {
    res.json(bilheteria.listarEventos());
  });

  router.post("/catalogo/reservas", async (req, res) => {
    const comprovante = await bilheteria.reservar(req.body);
    res.status(201).json(comprovante);
  });

  router.use((erro: Error, req: Request, res: Response, next: NextFunction) => {
    if (erro instanceof ErroDeNegocio) {
      res.status(erro.status).json({ mensagem: erro.message });
    } else if (erro instanceof SyntaxError) {
      res.status(400).json({ mensagem: "JSON inválido" });
    } else {
      console.error(erro);
      res.status(500).json({ mensagem: "erro interno" });
    }
  });

  return router;
}
