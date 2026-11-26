import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";

const referencia = JSON.parse(readFileSync(new URL("./originais-professor.json", import.meta.url), "utf8"));
let erros = 0;
for (const [arquivo, esperado] of Object.entries(referencia.files)) {
  try {
    const conteudo = readFileSync(new URL(`../${arquivo}`, import.meta.url));
    const atual = createHash("sha1").update(`blob ${conteudo.length}\0`).update(conteudo).digest("hex");
    if (atual !== esperado) throw new Error("conteúdo diferente do original");
    console.log(`✔ ${arquivo}`);
  } catch (erro) {
    erros += 1;
    console.error(`✘ ${arquivo}: ${erro.message}`);
  }
}
console.log(`Referência: ${referencia.repository}@${referencia.commit}`);
if (erros) process.exitCode = 1;
else console.log(`${Object.keys(referencia.files).length} arquivos do professor preservados.`);
