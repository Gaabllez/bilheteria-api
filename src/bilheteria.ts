import { Evento, DadosInvalidosErro, NaoEncontradoErro, PagamentoErro } from "./dominio.ts";
import { montarIngressos, calcularTotal } from "./preco.ts";
import { direitoAMeia } from "./regras.ts";
import type { ConfigBilheteria, Pedido, Comprovante, EventoInfo, Pessoa } from "./tipos.ts";
import type { Pagamento } from "./pagamento.ts";

function pessoaValida(pessoa: unknown): boolean {
  if (!pessoa || typeof pessoa !== "object" || Array.isArray(pessoa)) return false;
  const dados = pessoa as Partial<Pessoa>;
  return typeof dados.nome === "string" && dados.nome.trim().length > 0 && dados.nome.length <= 80 &&
    typeof dados.idade === "number" && Number.isInteger(dados.idade) && dados.idade >= 0 && dados.idade <= 120 &&
    typeof dados.estudante === "boolean" && typeof dados.pcd === "boolean";
}

function comTempoLimite<T>(promessa: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const limite = new Promise<never>((_, rejeitar) => {
    timer = setTimeout(() => rejeitar(new Error("tempo esgotado")), ms);
  });
  return Promise.race([promessa, limite]).finally(() => clearTimeout(timer));
}
export class Bilheteria {
  #eventos: Evento[];
  #pagar: Pagamento;
  #limitePagamentoMs: number;
  #contador = 0;
  constructor(config: ConfigBilheteria) {
    this.#eventos = [...config.eventos];
    this.#pagar = config.pagar;
    this.#limitePagamentoMs = config.limitePagamentoMs;
  }
  listarEventos(): EventoInfo[] { return this.#eventos.map(evento => evento.info()); }
  async reservar(pedido: Pedido): Promise<Comprovante> {
    if (!pedido || typeof pedido !== "object" || Array.isArray(pedido) ||
        !Array.isArray(pedido.ingressos) || !pedido.ingressos.length) {
      throw new DadosInvalidosErro("Pedido inválido");
    }
    const evento = this.#eventos.find(e => e.id === pedido.eventoId);
    if (!evento) throw new NaoEncontradoErro("Evento não encontrado");
    // Dados vindos do JSON não ficam validados só por receberem um tipo TypeScript.
    // Array.from também verifica posições vazias em chamadas diretas à classe.
    if (Array.from(pedido.ingressos).some(pessoa => !pessoaValida(pessoa))) {
      throw new DadosInvalidosErro("Informe nome (até 80 caracteres), idade inteira entre 0 e 120 e as opções de meia como booleanos");
    }
    const poltronas = pedido.ingressos.map(pessoa => pessoa.poltrona);
    // Reserva síncrona antes de ceder o controle no await.
    evento.reservar(poltronas);
    const ingressos = montarIngressos(evento.preco, pedido.ingressos, direitoAMeia);
    const total = calcularTotal(ingressos);
    try {
      await comTempoLimite(this.#pagar(total), this.#limitePagamentoMs);
    } catch {
      evento.liberar(poltronas);
      throw new PagamentoErro("Pagamento recusado ou tempo esgotado");
    }
    return { reservaId: ++this.#contador, eventoId: evento.id, ingressos, total };
  }
}
export function criarBilheteria(config: ConfigBilheteria): Bilheteria { return new Bilheteria(config); }
