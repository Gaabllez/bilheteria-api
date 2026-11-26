import type { EventoInfo } from "./tipos.ts";
export abstract class ErroDeNegocio extends Error {
  constructor(mensagem: string, public readonly status: number) { super(mensagem); this.name = new.target.name; }
}
export class DadosInvalidosErro extends ErroDeNegocio { constructor(mensagem: string) { super(mensagem, 400); } }
export class NaoEncontradoErro extends ErroDeNegocio { constructor(mensagem: string) { super(mensagem, 404); } }
export class PoltronaOcupadaErro extends ErroDeNegocio { constructor(mensagem: string) { super(mensagem, 409); } }
export class PagamentoErro extends ErroDeNegocio { constructor(mensagem: string) { super(mensagem, 502); } }
export class Evento {
  #vendidas: number[] = [];
  constructor(public readonly id: number, public readonly nome: string, public readonly preco: number, public readonly capacidade: number) {}
  get disponivel(): number { return this.capacidade - this.#vendidas.length; }
  reservar(poltronas: number[]): void {
    if (!Array.isArray(poltronas) || !poltronas.length || new Set(poltronas).size !== poltronas.length ||
        poltronas.some(p => !Number.isInteger(p) || p < 1 || p > this.capacidade)) {
      throw new DadosInvalidosErro("Poltronas inválidas");
    }
    if (poltronas.some(p => this.#vendidas.includes(p))) throw new PoltronaOcupadaErro("Poltrona ocupada");
    this.#vendidas.push(...poltronas);
  }
  liberar(poltronas: number[]): void {
    if (!Array.isArray(poltronas) || new Set(poltronas).size !== poltronas.length ||
        poltronas.some(p => !this.#vendidas.includes(p))) throw new DadosInvalidosErro("Poltrona não reservada");
    this.#vendidas = this.#vendidas.filter(p => !poltronas.includes(p));
  }
  info(): EventoInfo {
    return { id: this.id, nome: this.nome, preco: this.preco, capacidade: this.capacidade, disponivel: this.disponivel };
  }
}
