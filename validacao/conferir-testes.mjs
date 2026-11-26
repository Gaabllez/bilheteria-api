import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

// O executor original imprime a pontuação, mas usa exit(0) até quando há falhas.
// Mantemos o arquivo do professor intacto e verificamos seu resultado por fora.
export function conferirResultado(saida, status) {
  if (status !== 0) throw new Error(`O executor encerrou com status ${status}.`);
  const linhas = saida.split(/\r?\n/).filter((linha) => linha.startsWith("@@RESULTADO@@"));
  if (linhas.length !== 1) throw new Error("Resultado oficial ausente ou duplicado.");
  const resultado = JSON.parse(linhas[0].slice("@@RESULTADO@@".length));
  if (!Array.isArray(resultado.itens) || resultado.itens.length === 0) {
    throw new Error("A bateria oficial não executou nenhum cenário.");
  }
  const totalCalculado = resultado.itens.reduce((total, item) => total + item.peso, 0);
  const pontosCalculados = resultado.itens.reduce((total, item) => total + (item.ok === true ? item.peso : 0), 0);
  if (resultado.total !== 16 || resultado.pontos !== 16 || totalCalculado !== 16 || pontosCalculados !== 16 || resultado.itens.some((item) => item.ok !== true)) {
    const falhas = resultado.itens.filter((item) => item.ok !== true).map((item) => `${item.nome}: ${item.erro}`).join("\n");
    throw new Error(`Bateria oficial reprovada: ${resultado.pontos}/${resultado.total} pontos.\n${falhas}`);
  }
  return resultado;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const raiz = fileURLToPath(new URL("../", import.meta.url));
  const execucao = spawnSync(process.execPath, ["--import", "tsx", "testes/executar.ts", "testes/projeto.ts", "src"], {
    cwd: raiz, encoding: "utf8", timeout: 120_000, maxBuffer: 4 * 1024 * 1024,
  });
  if (execucao.stderr) process.stderr.write(execucao.stderr);
  try {
    if (execucao.error) throw execucao.error;
    const resultado = conferirResultado(execucao.stdout, execucao.status);
    for (const item of resultado.itens) console.log(`✔ [${item.peso}] ${item.nome}`);
    console.log(`\nPontos: ${resultado.pontos} de ${resultado.total} (100%) — ${resultado.itens.length} cenários.`);
  } catch (erro) {
    if (execucao.stdout) process.stdout.write(execucao.stdout);
    console.error(erro.message);
    process.exitCode = 1;
  }
}
