import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { cp, copyFile, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// Ensaio auxiliar do roteiro do professor. No vídeo, o grupo ainda precisa
// mostrar a mudança no código, rodar npm test, explicar o erro e desfazê-lo.
// Toda alteração abaixo ocorre em uma cópia temporária, nunca no projeto.
const raiz = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const caminhoOriginal = join(raiz, "src", "bilheteria.ts");
const original = await readFile(caminhoOriginal, "utf8");
// A mutação aceita checkouts CRLF do Windows; a restauração conserva o original.
const normalizado = original.replace(/\r\n/g, "\n");
const temporario = await mkdtemp(join(tmpdir(), "bilheteria-ensaio-"));
const concorrencia = "Concorrente: 200 pedidos simultâneos disputando 50 poltronas";
const falhasEsperadas = new Set([
  "Concorrente: pedido inválido e evento inexistente",
  concorrencia,
  "Concorrente: pagamento recusado devolve as poltronas",
  "Concorrente: tempo limite na operadora",
]);

function executar(rotulo) {
  // Executa o mesmo executor e os mesmos testes do npm test. O carregador evita
  // o socket IPC da CLI do tsx, que não é permitido em alguns ambientes.
  const execucao = spawnSync(process.execPath, [
    "--import", "tsx", "testes/executar.ts", "testes/projeto.ts", "src",
  ], { cwd: temporario, encoding: "utf8", timeout: 30_000 });
  if (execucao.error) throw new Error(`${rotulo}: não foi possível executar os testes.`, { cause: execucao.error });
  assert.equal(execucao.signal, null, `${rotulo}: executor interrompido por ${execucao.signal}`);
  assert.equal(execucao.status, 0, `${rotulo}: executor encerrou com erro.\n${execucao.stderr}`);
  const resultados = execucao.stdout.split(/\r?\n/).filter(linha => linha.startsWith("@@RESULTADO@@"));
  assert.equal(resultados.length, 1, `${rotulo}: saída do executor não contém um resultado único.\n${execucao.stdout}\n${execucao.stderr}`);
  const resultado = JSON.parse(resultados[0].slice("@@RESULTADO@@".length));
  assert.equal(resultado.total, 16, `${rotulo}: total diferente dos 16 pontos originais`);
  assert.ok(Array.isArray(resultado.itens) && resultado.itens.length === 14, `${rotulo}: cenários originais incompletos`);
  console.log(`${rotulo}: ${resultado.pontos}/${resultado.total} pontos; ${resultado.itens.filter(item => item.ok).length}/${resultado.itens.length} cenários aprovados.`);
  for (const item of resultado.itens.filter(item => !item.ok)) {
    console.log(`  Falha: ${item.nome}\n    ${item.erro}`);
  }
  return resultado;
}

function exigirAprovacao(resultado, rotulo) {
  assert.equal(resultado.pontos, 16, `${rotulo}: a versão correta precisa atingir 16/16`);
  assert.ok(resultado.itens.every(item => item.ok === true), `${rotulo}: há cenário reprovado`);
}

try {
  await cp(join(raiz, "src"), join(temporario, "src"), { recursive: true });
  await cp(join(raiz, "testes"), join(temporario, "testes"), { recursive: true });
  await copyFile(join(raiz, "package.json"), join(temporario, "package.json"));
  await copyFile(join(raiz, "tsconfig.json"), join(temporario, "tsconfig.json"));
  await symlink(join(raiz, "node_modules"), join(temporario, "node_modules"), process.platform === "win32" ? "junction" : "dir");

  exigirAprovacao(executar("Antes da mudança"), "Antes da mudança");

  const reserva = "    evento.reservar(poltronas);";
  const retorno = "    return { reservaId: ++this.#contador, eventoId: evento.id, ingressos, total };";
  assert.equal(normalizado.split(reserva).length - 1, 1, "Não foi encontrada uma única marcação de poltronas para mover");
  assert.equal(normalizado.split(retorno).length - 1, 1, "Não foi encontrado o retorno esperado para o comprovante");
  assert.ok(normalizado.indexOf(reserva) < normalizado.indexOf("await comTempoLimite"), "A versão original já está com a ordem incorreta");
  const incorreto = normalizado
    .replace("    // Reserva síncrona antes de ceder o controle no await.\n", "")
    .replace(`${reserva}\n`, "")
    .replace(retorno, `    // ERRO DIDÁTICO: cobrar antes de confirmar a poltrona.\n${reserva}\n${retorno}`);
  const copia = join(temporario, "src", "bilheteria.ts");
  await writeFile(copia, incorreto);

  const demonstracao = executar("Cópia com erro proposital");
  const caso = demonstracao.itens.find(item => item.nome === concorrencia);
  assert.ok(caso && caso.ok === false, "A disputa por poltronas deveria reprovar na cópia incorreta");
  assert.match(caso.erro, /cobrou 200 pessoas por 50 poltronas/, "A falha precisa demonstrar cobranças excedentes; erro de importação, rede ou execução não serve");
  const falhas = demonstracao.itens.filter(item => !item.ok);
  assert.deepEqual(new Set(falhas.map(item => item.nome)), falhasEsperadas, "A cópia incorreta apresentou falhas diferentes das ensaiadas");
  assert.equal(demonstracao.pontos, 11, "A mudança isolada deveria reproduzir os 11/16 pontos do ensaio");

  await writeFile(copia, original);
  assert.equal(await readFile(copia, "utf8"), original, "A cópia não foi restaurada integralmente");
  exigirAprovacao(executar("Depois de desfazer a mudança"), "Depois de desfazer a mudança");
  assert.equal(await readFile(caminhoOriginal, "utf8"), original, "O arquivo original foi alterado durante o ensaio");
  console.log("Ensaio confirmado: 16/16 → erro proposital com 200 cobranças por 50 poltronas → 16/16.");
  console.log("O resultado intermediário pertence apenas à cópia com o erro intencional; não é a avaliação do projeto entregue.");
  console.log("No vídeo: mostre a linha movida, execute npm test, explique as falhas e desfaça a mudança.");
} finally {
  await rm(temporario, { recursive: true, force: true });
}
