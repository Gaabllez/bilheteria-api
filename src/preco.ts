import type { Pessoa, Ingresso, TipoIngresso } from "./tipos.ts";
// Compensa a imprecisão binária para não perder um centavo em valores como 1,005.
const arredondar = (valor: number): number =>
  Math.round((valor + Number.EPSILON * Math.max(1, Math.abs(valor))) * 100) / 100;

export const valorDoIngresso = (precoBase: number) => (tipo: TipoIngresso): number =>
  tipo === "meia" ? arredondar(precoBase / 2) : precoBase;
export const aplicarTaxa = (percentual: number) => (valor: number): number =>
  arredondar(valor * (1 + percentual));
export function montarIngressos(precoBase: number, pessoas: Pessoa[], temDireitoAMeia: (pessoa: Pessoa) => boolean): Ingresso[] {
  const calcular = valorDoIngresso(precoBase);
  return pessoas.map(pessoa => {
    const tipo = temDireitoAMeia(pessoa) ? "meia" : "inteira";
    return { nome: pessoa.nome, poltrona: pessoa.poltrona, tipo, valor: calcular(tipo) };
  });
}
export function calcularTotal(ingressos: Ingresso[]): number {
  return aplicarTaxa(0.1)(ingressos.reduce((soma, ingresso) => soma + ingresso.valor, 0));
}
