import express from "express";
import type { NextFunction, Request, Response } from "express";
import { fileURLToPath } from "node:url";
import type { Bilheteria } from "./bilheteria.ts";
import { criarServidor } from "./servidor.ts";
import { criarServidorCatalogo } from "./servidor-catalogo.ts";

// Composição usada pelo servidor principal e pelas verificações HTTP/interface.
// O parser externo trata erros de transporte sem alterar o servidor do professor.
export function criarAplicacao(bilheteria: Bilheteria, bilheteriaCatalogo: Bilheteria) {
  const app = express();
  app.use(express.json({ limit: "100kb" }));
  app.use((erro: unknown, req: Request, res: Response, next: NextFunction) => {
    const tipo = typeof erro === "object" && erro !== null && "type" in erro ? erro.type : undefined;
    const status = typeof erro === "object" && erro !== null && "status" in erro ? erro.status : undefined;
    if (tipo === "entity.too.large") {
      res.status(413).json({ mensagem: "JSON excede o limite de 100 KB" });
    } else if (tipo === "encoding.unsupported" || tipo === "charset.unsupported") {
      res.status(415).json({ mensagem: "Codificação do JSON não suportada" });
    } else if (tipo === "request.aborted" || tipo === "request.size.invalid") {
      res.status(400).json({ mensagem: "Corpo da requisição incompleto" });
    } else if (tipo === "entity.parse.failed" || erro instanceof SyntaxError || status === 400) {
      // Inclui conteúdo comprimido inválido, que o parser marca como 400 sem type.
      res.status(400).json({ mensagem: "JSON inválido" });
    } else {
      console.error(erro);
      res.status(500).json({ mensagem: "erro interno" });
    }
  });

  // O JSON já foi lido: o parser do servidor original reconhece o corpo consumido.
  app.use(criarServidor(bilheteria));
  app.use(criarServidorCatalogo(bilheteriaCatalogo));
  app.use(express.static(fileURLToPath(new URL("../public/", import.meta.url))));
  return app;
}
