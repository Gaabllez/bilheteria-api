import { Evento, DadosInvalidosErro, NaoEncontradoErro, PagamentoErro } from "./dominio.ts";
import { montarIngressos, calcularTotal } from "./preco.ts";
import { direitoAMeia } from "./regras.ts";
import type { ConfigBilheteria, Pedido, Comprovante, EventoInfo } from "./tipos.ts";
import type { Pagamento } from "./pagamento.ts";
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
    if (!pedido || !Array.isArray(pedido.ingressos) || !pedido.ingressos.length ||
        pedido.ingressos.some(p => !p || typeof p !== "object")) throw new DadosInvalidosErro("Pedido inválido");
    const evento = this.#eventos.find(e => e.id === pedido.eventoId);
    if (!evento) throw new NaoEncontradoErro("Evento não encontrado");
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
