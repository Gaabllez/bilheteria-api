import type { Pessoa, Ingresso, TipoIngresso } from "./tipos.ts";
export const valorDoIngresso = (precoBase: number) => (tipo: TipoIngresso): number =>
  tipo === "meia" ? Math.round(precoBase / 2 * 100) / 100 : precoBase;
export const aplicarTaxa = (percentual: number) => (valor: number): number =>
  Math.round(valor * (1 + percentual) * 100) / 100;
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
