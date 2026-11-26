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
    if (typeof item.price !== "number" || !Number.isFinite(item.price) || item.price <= 0 ||
        typeof item.capacity !== "number" || !Number.isSafeInteger(item.capacity) || item.capacity < 1) {
      throw new Error("Catálogo inválido: preço fictício e capacidade precisam ser positivos.");
    }
    const image = texto(item.image, "image");
    if (!image.startsWith("/images/") || image.includes("..") || image.includes("\\")) {
      throw new Error("Catálogo inválido: a imagem deve ser um arquivo local em /images/.");
    }
    return {
      ...item,
      id: item.id,
      artist: texto(item.artist, "artist"),
      tour: texto(item.tour, "tour"),
      category: texto(item.category, "category"),
      description: texto(item.description, "description"),
      image,
      imageAlt: texto(item.imageAlt, "imageAlt"),
      officialUrl: linkOficial(item.officialUrl, "officialUrl"),
      sourceUrl: linkOficial(item.sourceUrl, "sourceUrl"),
      price: item.price,
      capacity: item.capacity,
    };
  });
  const primeiro = events.find((evento) => evento.id === 1);
  if (!primeiro || primeiro.capacity !== 100 || primeiro.price !== 100) {
    throw new Error("Catálogo inválido: mantenha o evento 1 com 100 poltronas e preço fictício de R$ 100 para os testes do projeto.");
  }
  return { ...valor, verifiedAt, events };
}

export function lerCatalogo() {
  return validarCatalogo(JSON.parse(readFileSync(new URL("../public/catalogo.json", import.meta.url), "utf8")));
}

export function criarEventosDemo() {
  return lerCatalogo().events.map((evento) => new Evento(evento.id, `${evento.artist} — ${evento.tour}`, evento.price, evento.capacity));
}
