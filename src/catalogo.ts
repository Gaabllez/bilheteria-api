import { readFileSync } from "node:fs";
import { Evento } from "./dominio.ts";

function objeto(valor: unknown): valor is Record<string, unknown> {
  return valor !== null && typeof valor === "object" && !Array.isArray(valor);
}

function texto(valor: unknown, campo: string): string {
  if (typeof valor !== "string" || !valor.trim()) throw new Error(`Catálogo inválido: ${campo} precisa de texto.`);
  return valor;
}

function linkOficial(valor: unknown, campo: string): string {
  const link = texto(valor, campo);
  const url = new URL(link);
  if (url.protocol !== "https:" || url.username || url.password) {
    throw new Error(`Catálogo inválido: ${campo} precisa de um link HTTPS.`);
  }
  return link;
}

function opcao(valor: unknown, campo: string, opcoes: string[]): string {
  const escolha = texto(valor, campo);
  if (!opcoes.includes(escolha)) throw new Error(`Catálogo inválido: ${campo} contém uma opção não suportada.`);
  return escolha;
}

function imagemCatalogo(valor: unknown): string {
  const image = texto(valor, "image");
  if (/^\/images\/artists\/[a-z0-9-]+\.(?:webp|svg)$/.test(image)) return image;
  if (/^https:\/\/commons\.wikimedia\.org\/wiki\/Special:FilePath\/[^?#]+(?:\?width=\d{1,4})?$/.test(image)) {
    const url = new URL(image);
    const prefixo = "/wiki/Special:FilePath/";
    // URL normaliza segmentos como %2e%2e; o destino também precisa ser uma imagem.
    if (url.pathname.startsWith(prefixo) && url.pathname.length > prefixo.length) return image;
  }
  throw new Error("Catálogo inválido: use um arquivo local em /images/artists/ ou uma imagem HTTPS do Wikimedia Commons no formato suportado.");
}

// As informações editoriais e os valores fictícios têm uma fonte única.
// Nenhum arquivo de tipos ou configuração fornecido pelo professor é alterado.
export function validarCatalogo(valor: unknown) {
  if (!objeto(valor) || !Array.isArray(valor.events) || valor.events.length === 0) {
    throw new Error("Catálogo inválido: informe ao menos um evento.");
  }
  const verifiedAt = texto(valor.verifiedAt, "verifiedAt");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(verifiedAt) || !Number.isFinite(Date.parse(verifiedAt)) || new Date(verifiedAt).toISOString().slice(0, 10) !== verifiedAt) {
    throw new Error("Catálogo inválido: verifiedAt precisa ser uma data ISO válida.");
  }
  const ids = new Set<number>();
  const events = Array.from(valor.events).map((item: unknown) => {
    if (!objeto(item) || typeof item.id !== "number" || !Number.isSafeInteger(item.id) || item.id < 1 || ids.has(item.id)) {
      throw new Error("Catálogo inválido: IDs devem ser inteiros positivos e únicos.");
    }
    ids.add(item.id);
    if (typeof item.reservable !== "boolean") {
      throw new Error("Catálogo inválido: reservable precisa indicar se a turnê participa do simulador.");
    }
    if (typeof item.price !== "number" || !Number.isFinite(item.price) || item.price <= 0 ||
        typeof item.capacity !== "number" || !Number.isSafeInteger(item.capacity) || item.capacity < 1) {
      throw new Error("Catálogo inválido: preço fictício e capacidade precisam ser positivos.");
    }
    const image = imagemCatalogo(item.image);
    const objectPosition = texto(item.objectPosition, "objectPosition");
    if (!/^\d{1,3}% \d{1,3}%$/.test(objectPosition) || objectPosition.match(/\d+/g)!.some((posicao) => Number(posicao) > 100)) {
      throw new Error("Catálogo inválido: objectPosition precisa de duas porcentagens entre 0 e 100.");
    }
    const accent = texto(item.accent, "accent");
    if (!/^#[a-f0-9]{6}$/i.test(accent)) {
      throw new Error("Catálogo inválido: accent precisa de uma cor hexadecimal com seis dígitos.");
    }
    if (!objeto(item.credit)) {
      throw new Error("Catálogo inválido: credit precisa informar a atribuição da imagem.");
    }
    const credit = {
      ...item.credit,
      author: texto(item.credit.author, "credit.author"),
      license: texto(item.credit.license, "credit.license"),
      description: texto(item.credit.description, "credit.description"),
      licenseUrl: linkOficial(item.credit.licenseUrl, "credit.licenseUrl"),
      sourceUrl: linkOficial(item.credit.sourceUrl, "credit.sourceUrl"),
    };
    return {
      ...item,
      id: item.id,
      reservable: item.reservable,
      artist: texto(item.artist, "artist"),
      tour: texto(item.tour, "tour"),
      category: opcao(item.category, "category", ["pop", "rnb", "rock", "latino", "theatre"]),
      type: opcao(item.type, "type", ["artist", "theatre"]),
      genre: texto(item.genre, "genre"),
      year: texto(item.year, "year"),
      status: texto(item.status, "status"),
      description: texto(item.description, "description"),
      image,
      imageAlt: texto(item.imageAlt, "imageAlt"),
      objectPosition,
      accent,
      dialogImageFit: opcao(item.dialogImageFit, "dialogImageFit", ["contain", "cover"]),
      credit,
      officialUrl: linkOficial(item.officialUrl, "officialUrl"),
      sourceUrl: linkOficial(item.sourceUrl, "sourceUrl"),
      price: item.price,
      capacity: item.capacity,
    };
  });
  const primeiro = events.find((evento) => evento.id === 1);
  if (!primeiro || !primeiro.reservable || primeiro.capacity !== 100 || primeiro.price !== 100) {
    throw new Error("Catálogo inválido: mantenha o evento 1 disponível para reserva, com 100 poltronas e preço fictício de R$ 100 para os testes do projeto.");
  }
  for (const id of [2, 3]) {
    if (!events.some((evento) => evento.id === id && evento.reservable)) {
      throw new Error(`Catálogo inválido: mantenha o evento ${id} disponível para reserva na API original.`);
    }
  }
  if (events.some((evento) => !evento.reservable)) {
    throw new Error("Catálogo inválido: todos os eventos precisam estar disponíveis para simulação.");
  }
  return { ...valor, verifiedAt, events };
}

export function lerCatalogo() {
  return validarCatalogo(JSON.parse(readFileSync(new URL("../public/catalogo.json", import.meta.url), "utf8")));
}

export function criarEventosDemo() {
  // A bilheteria principal preserva os três eventos exigidos pelo enunciado.
  return lerCatalogo().events
    .filter((evento) => [1, 2, 3].includes(evento.id))
    .map((evento) => new Evento(evento.id, `${evento.artist} — ${evento.tour}`, evento.price, evento.capacity));
}

export function criarEventosCatalogo() {
  // Estoque independente para a simulação completa exibida no site.
  return lerCatalogo().events
    .filter((evento) => evento.reservable)
    .map((evento) => new Evento(evento.id, `${evento.artist} — ${evento.tour}`, evento.price, evento.capacity));
}
