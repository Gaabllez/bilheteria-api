import { criarEventosDemo, criarEventosCatalogo } from "./catalogo.ts";
import { criarBilheteria } from "./bilheteria.ts";
import { criarPagamentoFalso } from "./pagamento.ts";
import { criarAplicacao } from "./aplicacao.ts";
const eventos = criarEventosDemo();
const pagar = criarPagamentoFalso({ latenciaMs: 80, taxaDeFalha: 0.1 });
const bilheteria = criarBilheteria({ eventos, pagar, limitePagamentoMs: 500 });
const bilheteriaCatalogo = criarBilheteria({ eventos: criarEventosCatalogo(), pagar, limitePagamentoMs: 500 });
const app = criarAplicacao(bilheteria, bilheteriaCatalogo);
const porta = Number(process.env.PORT ?? 3000);
if (!Number.isInteger(porta) || porta < 1 || porta > 65535) {
  throw new Error("PORT deve ser um número inteiro entre 1 e 65535.");
}
app.listen(porta, () => console.log(`Bilheteria em http://localhost:${porta}`));
