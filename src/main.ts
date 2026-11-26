import { Evento } from "./dominio.ts";
import { criarBilheteria } from "./bilheteria.ts";
import { criarPagamentoFalso } from "./pagamento.ts";
import { criarServidor } from "./servidor.ts";
const eventos = [new Evento(1, "Show", 100, 100), new Evento(2, "Teatro", 80, 60), new Evento(3, "Festival", 150, 200)];
const pagar = criarPagamentoFalso({ latenciaMs: 80, taxaDeFalha: 0.1 });
const bilheteria = criarBilheteria({ eventos, pagar, limitePagamentoMs: 500 });
criarServidor(bilheteria).listen(3000, () => console.log("Bilheteria em http://localhost:3000"));
