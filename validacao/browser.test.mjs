import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { iniciarServidorUI } from "./servidor-ui.ts";
import { criarEventosCatalogo, lerCatalogo } from "../src/catalogo.ts";

// O CI instala Playwright em um prefixo temporário para preservar package.json
// e package-lock.json fornecidos pelo professor. Não execute esta suíte no
// preview managed: a inspeção local nesse ambiente usa CUA.
if (!process.env.PLAYWRIGHT_MODULE_PATH) {
  throw new Error("Defina PLAYWRIGHT_MODULE_PATH com o caminho absoluto de playwright/index.mjs.");
}
const { chromium } = await import(pathToFileURL(resolve(process.env.PLAYWRIGHT_MODULE_PATH)).href);
const artifacts = resolve("coverage/ui");
let browser;

before(async () => {
  await mkdir(artifacts, { recursive: true });
  browser = await chromium.launch({ headless: true });
});
after(async () => { await browser?.close(); });

const cleanText = (value) => value.replace(/\s+/g, " ").trim();
const catalog = lerCatalogo();
const events = criarEventosCatalogo().map((evento) => evento.info());

async function fixture(t, run, options = {}) {
  const server = await iniciarServidorUI();
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    locale: "pt-BR",
    reducedMotion: "reduce",
    ...options,
  });
  // Arquivos locais são servidos de verdade. Imagens remotas falham de forma
  // controlada para exercitar o fallback sem depender da Internet ou do Commons.
  await context.route("https://fonts.googleapis.com/**", (route) => route.fulfill({
    status: 200, contentType: "text/css", body: "",
  }));
  await context.route("https://commons.wikimedia.org/**", (route) => route.abort("failed"));
  const page = await context.newPage();
  page.setDefaultTimeout(7000);
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  try {
    await run({ page, context, server });
    assert.deepEqual(errors, [], "A interface não deve gerar exceções JavaScript não tratadas.");
  } catch (error) {
    const name = t.name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9]+/g, "-").slice(0, 120);
    await page.screenshot({ path: resolve(artifacts, `falha-${name}.png`), fullPage: true }).catch(() => {});
    throw error;
  } finally {
    await context.close();
    await server.fechar();
  }
}

async function abrir(page, server) {
  await page.goto(server.url, { waitUntil: "domcontentloaded" });
  // O cabeçalho oculta este indicador no celular; a classe confirma o GET.
  await page.locator("#connection-label.online").waitFor({ state: "attached" });
  await page.locator("#submit-reservation:not([disabled])").waitFor();
}

async function preencher(page, { nome = "Ana de Teste", idade = "25", poltrona } = {}, index = 0) {
  const row = page.locator(".ticket-card").nth(index);
  await row.locator('[name="nome"]').fill(nome);
  await row.locator('[name="idade"]').fill(idade);
  if (poltrona !== undefined) await row.locator('[name="poltrona"]').fill(String(poltrona));
}

async function terminoDoPedido(page) {
  await page.locator('#reservation-form[aria-busy="false"]').waitFor();
}

async function abrirRespostaAPI(page) {
  const details = page.locator("details.api-details");
  if (await details.getAttribute("open") === null) await details.locator("summary").click();
  await page.locator("#response-body").waitFor({ state: "visible" });
  await page.locator("#response-meta").waitFor({ state: "visible" });
}

async function preco(page, selector, esperado) {
  assert.equal(cleanText(await page.locator(selector).textContent()), esperado);
}

async function aguardarPintura(page) {
  await page.evaluate(() => new Promise((resolveFrame) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolveFrame()));
  }));
}

async function prepararCapturaCompleta(page) {
  // A captura fullPage não percorre a página: visitamos as fotos para exercitar
  // o lazy loading real, sem alterar o atributo loading ou forçar downloads.
  const images = page.locator("main img");
  for (let index = 0; index < await images.count(); index += 1) {
    await images.nth(index).scrollIntoViewIfNeeded();
    await page.waitForFunction((imageIndex) => {
      const image = document.querySelectorAll("main img")[imageIndex];
      return image?.complete && image.naturalWidth > 0;
    }, index, { timeout: 5000 });
  }
  const loadedSources = await images.evaluateAll((photos) => photos.map((photo) => new URL(photo.currentSrc || photo.src).pathname));
  assert.deepEqual(new Set(loadedSources), new Set([
    ...catalog.events.map((event) => event.image.startsWith("/") ? event.image : "/images/artists/catalog-placeholder.svg"),
    "/images/artists/hero-gaga.webp",
    "/images/artists/hero-coldplay.webp",
  ]), "Todas as imagens locais e os fallbacks das imagens remotas devem carregar na página principal.");
  await page.evaluate(() => window.scrollTo({ top: 0, left: 0, behavior: "instant" }));
  await aguardarPintura(page);
}

test("14 eventos reserváveis (12 artistas e 2 peças) mantêm busca, filtros e seleção corretos", { timeout: 30000 }, async (t) => {
  await fixture(t, async ({ page, server }) => {
    await abrir(page, server);
    assert.match(await page.title(), /Bilheteria/i);
    assert.equal(await page.locator(".event-card").count(), 14);
    assert.deepEqual(await page.locator(".event-card h3").allTextContents(), catalog.events.map((event) => event.artist));
    assert.equal(await page.locator(".event-book").count(), 14);
    await page.locator('[data-filter="teatro"]').click();
    assert.deepEqual(await page.locator(".event-card h3").allTextContents(), ["O Fantasma da Ópera", "Wicked"]);
    await page.locator('[data-filter="artistas"]').click();
    assert.equal(await page.locator(".event-card").count(), 12);
    await page.locator('[data-filter="todos"]').click();
    assert.deepEqual(await page.locator("#event-select option").evaluateAll((options) => options.map((option) => option.value)), catalog.events.map((event) => String(event.id)));
    const response = await page.request.get(`${server.url}/eventos`);
    assert.deepEqual((await response.json()).map((event) => event.id), [1, 2, 3], "A API original do professor continua com seus três eventos.");
    const catalogResponse = await page.request.get(`${server.url}/catalogo/eventos`);
    assert.deepEqual((await catalogResponse.json()).map((event) => event.id), catalog.events.map((event) => event.id));
    await page.locator('[data-filter="rock"]').click();
    assert.deepEqual(await page.locator(".event-card h3").allTextContents(), ["Coldplay", "Linkin Park"]);
    assert.equal(await page.locator('[data-filter="rock"]').getAttribute("aria-pressed"), "true");
    assert.equal(await page.locator(".event-book").count(), 2);
    assert.match(await page.locator("#events-grid").textContent(), /R\$/);
    await page.locator(".event-details").first().click();
    assert.equal(await page.locator("#event-dialog-title").textContent(), "Coldplay");
    assert.equal(await page.locator("#event-reserve").isVisible(), true);
    await preco(page, "#event-dialog-price", "R$ 60,00");
    assert.equal(await page.locator("#event-dialog-editorial").isVisible(), false);
    await page.locator("#event-reserve").click();
    assert.equal(await page.locator("#event-select").inputValue(), "4");
    await preco(page, "#summary-total", "R$ 132,00");
    await page.locator('[data-filter="pop"]').click();
    await page.locator(".event-book").nth(1).click();
    assert.equal(await page.locator("#event-select").inputValue(), "2");
    await preco(page, "#summary-total", "R$ 154,00");
    await page.locator('[data-filter="todos"]').click();
    await page.locator("#search-events").fill("GÁGA");
    assert.deepEqual(await page.locator(".event-card h3").allTextContents(), ["Lady Gaga"]);
    await page.locator("#search-events").fill("The Romantic");
    assert.deepEqual(await page.locator(".event-card h3").allTextContents(), ["Bruno Mars"]);
    await page.locator("#search-events").fill("evento inexistente");
    assert.equal(await page.locator(".event-card").count(), 0);
    assert.match(await page.locator("#events-grid").textContent(), /Nenhum evento corresponde/);
    await page.locator("#search-events").fill("");
    await page.locator('[data-filter="latino"]').click();
    assert.deepEqual(await page.locator(".event-card h3").allTextContents(), ["Shakira"]);
    await page.locator('[data-filter="todos"]').click();
    await prepararCapturaCompleta(page);
    await page.screenshot({ path: resolve(artifacts, "desktop-catalogo.png"), fullPage: true });
  });
});

test("detalhes mostram a turnê e o link oficial e iniciam a simulação correta", { timeout: 30000 }, async (t) => {
  await fixture(t, async ({ page, server }) => {
    await abrir(page, server);
    for (const [index, event] of catalog.events.entries()) {
      await page.locator(".event-details").nth(index).click();
      await page.locator("#event-dialog[open]").waitFor();
      assert.equal(await page.locator("#event-dialog-title").textContent(), event.artist);
      assert.equal(await page.locator("#event-dialog-tour").textContent(), event.tour);
      assert.equal(await page.locator("#event-official-link").getAttribute("href"), event.officialUrl);
      assert.equal(await page.locator("#event-official-link").getAttribute("target"), "_blank");
      assert.match(await page.locator("#event-official-link").getAttribute("rel"), /noopener/);
      assert.equal(await page.locator("#event-dialog-simulation").isVisible(), event.reservable);
      assert.equal(await page.locator("#event-dialog-editorial").isVisible(), !event.reservable);
      assert.equal(await page.locator("#event-reserve").isVisible(), event.reservable);
      await page.locator("#close-event").click();
      assert.equal(await page.locator("#event-dialog").isVisible(), false);
    }
    await page.locator(".event-details").nth(2).click();
    await page.locator("#event-reserve").click();
    assert.equal(await page.locator("#event-dialog").isVisible(), false);
    assert.equal(await page.locator("#event-select").inputValue(), "3");
    await preco(page, "#summary-total", "R$ 176,00");
    await page.locator("#featured-tour").click();
    await page.locator("#event-dialog[open]").waitFor();
    assert.equal(await page.locator("#event-dialog-title").textContent(), "Lady Gaga");
  });
});

test("todos os 14 eventos concluem uma reserva pela interface no estoque do catálogo", { timeout: 60000 }, async (t) => {
  await fixture(t, async ({ page, server }) => {
    await abrir(page, server);
    for (const event of catalog.events) {
      await page.locator("#event-select").selectOption(String(event.id));
      await preencher(page, { nome: `Participante ${event.id}`, poltrona: 1 });
      const response = page.waitForResponse((received) => received.request().method() === "POST" && received.url().endsWith("/catalogo/reservas"));
      await page.locator("#submit-reservation").click();
      assert.equal((await response).status(), 201, `A reserva de ${event.artist} deve ser confirmada.`);
      await page.locator("#receipt-dialog[open]").waitFor();
      await terminoDoPedido(page);
      assert.ok((await page.locator("#receipt-info").textContent()).includes(event.artist));
      const receipt = JSON.parse(await page.locator("#response-body").textContent());
      assert.equal(receipt.eventoId, event.id);
      assert.equal(receipt.ingressos[0].poltrona, 1);
      assert.equal(receipt.ingressos[0].valor, event.price);
      assert.equal(receipt.total, Math.round(event.price * 110) / 100);
      await page.locator("#close-receipt").click();
      assert.ok((await page.locator("#selected-event").textContent()).includes(`${event.capacity - 1} de ${event.capacity}`));
    }
    const original = await page.request.get(`${server.url}/eventos`);
    assert.ok((await original.json()).every((event) => event.disponivel === event.capacidade), "O estoque independente da API original não é consumido pelo site.");
  });
});

test("imagem remota indisponível usa fallback no card, detalhes e seleção sem acumular handlers", { timeout: 30000 }, async (t) => {
  await fixture(t, async ({ page, server }) => {
    await abrir(page, server);
    const remoteIndex = catalog.events.findIndex((event) => event.image.startsWith("https://"));
    assert.ok(remoteIndex >= 0, "O catálogo deve exercitar a imagem remota indisponível controlada.");
    const card = page.locator(".event-card").nth(remoteIndex);
    await card.scrollIntoViewIfNeeded();
    await page.waitForFunction((index) => {
      const image = document.querySelectorAll(".event-card img")[index];
      return image.dataset.fallback === "true" && image.complete && image.naturalWidth > 0;
    }, remoteIndex);
    assert.equal(await card.locator("img").getAttribute("src"), "/images/artists/catalog-placeholder.svg");
    await card.locator(".event-details").click();
    await page.waitForFunction(() => {
      const image = document.querySelector("#event-dialog-image");
      return image.dataset.fallback === "true" && image.complete && image.naturalWidth > 0;
    });
    assert.equal(await page.locator("#event-dialog-image").getAttribute("src"), "/images/artists/catalog-placeholder.svg");
    await page.locator("#event-reserve").click();
    await page.waitForFunction(() => {
      const image = document.querySelector(".selected-event-cover");
      return image.dataset.fallback === "true" && image.complete && image.naturalWidth > 0;
    });
    assert.equal(await page.locator(".selected-event-cover").getAttribute("src"), "/images/artists/catalog-placeholder.svg");
    for (let opening = 0; opening < 3; opening += 1) {
      await page.locator(".event-details").first().click();
      await page.waitForFunction(() => {
        const image = document.querySelector("#event-dialog-image");
        return image.getAttribute("src") === "/images/artists/gaga.webp" && image.complete && image.naturalWidth > 0;
      });
      if (opening < 2) await page.locator("#close-event").click();
    }
    const srcChanges = await page.locator("#event-dialog-image").evaluate((image) => {
      const observer = new MutationObserver(() => {});
      observer.observe(image, { attributes: true, attributeFilter: ["src"] });
      image.dispatchEvent(new Event("error"));
      const first = observer.takeRecords().length;
      image.dispatchEvent(new Event("error"));
      const second = observer.takeRecords().length;
      observer.disconnect();
      return { first, second };
    });
    assert.deepEqual(srcChanges, { first: 1, second: 0 }, "Cada falha deve acionar o fallback uma vez; uma falha do próprio fallback não inicia loop.");
  });
});

test("layout móvel não transborda e menu funciona por toque e Escape", { timeout: 30000 }, async (t) => {
  await fixture(t, async ({ page, server }) => {
    await abrir(page, server);
    for (const width of [360, 390, 768]) {
      await page.setViewportSize({ width, height: 844 });
      const size = await page.evaluate(() => ({
        content: document.documentElement.scrollWidth,
        viewport: document.documentElement.clientWidth,
      }));
      assert.ok(size.content <= size.viewport + 1, `Há rolagem horizontal em ${width}px: ${JSON.stringify(size)}`);
      await page.locator("#mobile-toggle").click();
      assert.equal(await page.locator("#mobile-menu").isVisible(), true);
      assert.equal(await page.locator("#mobile-toggle").getAttribute("aria-expanded"), "true");
      await page.keyboard.press("Escape");
      assert.equal(await page.locator("#mobile-menu").isHidden(), true);
      assert.equal(await page.locator("#mobile-toggle").getAttribute("aria-label"), "Abrir menu");
    }
    await page.setViewportSize({ width: 390, height: 844 });
    await page.locator("#mobile-toggle").click();
    await page.locator('#mobile-menu a[href="#reserva"]').click();
    assert.equal(await page.locator("#mobile-menu").isHidden(), true);
    await prepararCapturaCompleta(page);
    await page.screenshot({ path: resolve(artifacts, "mobile-390.png"), fullPage: true });
  }, { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
});

test("idade vazia ou fracionária é rejeitada sem enviar reserva e recebe foco", { timeout: 30000 }, async (t) => {
  await fixture(t, async ({ page, server }) => {
    let requests = 0;
    page.on("request", (request) => { if (request.method() === "POST" && request.url().endsWith("/catalogo/reservas")) requests += 1; });
    await abrir(page, server);
    await preencher(page, { idade: "" });
    for (const value of ["", "20.5", "-1", "121"]) {
      await page.locator('[name="idade"]').fill(value);
      await page.locator("#submit-reservation").click();
      assert.match(await page.locator("#reservation-message").textContent(), /idade válida/);
      assert.equal(await page.locator('[name="idade"]').getAttribute("aria-invalid"), "true");
      assert.equal(await page.locator('[name="idade"]').evaluate((field) => field === document.activeElement), true);
    }
    assert.equal(requests, 0);
    assert.equal(await page.locator("#receipt-dialog").isVisible(), false);
  });
});

test("remover e adicionar participantes não repete poltronas; duplicidade manual é bloqueada", { timeout: 30000 }, async (t) => {
  await fixture(t, async ({ page, server }) => {
    let requests = 0;
    page.on("request", (request) => { if (request.method() === "POST") requests += 1; });
    await abrir(page, server);
    await page.locator("#add-ticket").click();
    await page.locator("#add-ticket").click();
    await page.locator(".ticket-card").nth(1).locator(".remove-ticket").click();
    await page.locator("#add-ticket").click();
    const seats = await page.locator('[name="poltrona"]').evaluateAll((fields) => fields.map((field) => field.value));
    assert.deepEqual(seats, ["1", "3", "2"]);
    assert.equal(new Set(seats).size, seats.length);
    for (let index = 0; index < 3; index += 1) await preencher(page, { nome: `Pessoa ${index + 1}` }, index);
    await page.locator('[name="poltrona"]').nth(2).fill("1");
    await page.locator("#submit-reservation").click();
    assert.match(await page.locator("#reservation-message").textContent(), /mesma poltrona/);
    assert.equal(requests, 0);
  });
});

test("meia por estudante, PcD e 60 anos não acumula descontos e aplica 10%", { timeout: 30000 }, async (t) => {
  await fixture(t, async ({ page, server }) => {
    await abrir(page, server);
    await preencher(page);
    await page.locator("#add-ticket").click();
    await preencher(page, { nome: "Beto de Teste" }, 1);
    await preco(page, "#summary-total", "R$ 220,00");
    const first = page.locator(".ticket-card").first();
    await first.locator('[name="estudante"]').check();
    await preco(page, "#summary-subtotal", "R$ 150,00");
    await preco(page, "#summary-fee", "R$ 15,00");
    await preco(page, "#summary-total", "R$ 165,00");
    await first.locator('[name="pcd"]').check();
    await preco(page, "#summary-total", "R$ 165,00");
    await first.locator('[name="estudante"]').uncheck();
    await preco(page, "#summary-total", "R$ 165,00");
    await first.locator('[name="pcd"]').uncheck();
    await first.locator('[name="idade"]').fill("60");
    await preco(page, "#summary-total", "R$ 165,00");
    await first.locator('[name="idade"]').fill("59");
    await preco(page, "#summary-total", "R$ 220,00");
  });
});

test("reserva usa API real, bloqueia edição durante envio e preserva POST após GET", { timeout: 30000 }, async (t) => {
  await fixture(t, async ({ page, server }) => {
    await abrir(page, server);
    await preencher(page);
    await page.locator('[name="estudante"]').check();
    await page.locator("#add-ticket").click();
    await preencher(page, { nome: "Beto de Teste" }, 1);
    let release;
    const gate = new Promise((resolveGate) => { release = resolveGate; });
    let posts = 0;
    await page.route("**/catalogo/reservas", async (route) => {
      posts += 1;
      await gate;
      await route.continue();
    });
    try {
      const sent = page.waitForRequest((request) => request.method() === "POST" && request.url().endsWith("/catalogo/reservas"));
      const response = page.waitForResponse((received) => received.request().method() === "POST" && received.url().endsWith("/catalogo/reservas"));
      await page.locator("#submit-reservation").click();
      const request = await sent;
      assert.equal(request.postDataJSON().ingressos.length, 2);
      for (const selector of ["#submit-reservation", "#event-select", "#add-ticket", '[name="nome"]', '[name="idade"]', ".remove-ticket", ".event-book"]) {
        assert.equal(await page.locator(selector).first().isDisabled(), true, `${selector} deve bloquear durante o envio`);
      }
      await page.locator("#reservation-form").dispatchEvent("submit");
      release();
      assert.equal((await response).status(), 201);
      await page.locator("#receipt-dialog[open]").waitFor();
      await terminoDoPedido(page);
      assert.equal(posts, 1, "Submissões repetidas não devem criar outro pedido em andamento.");
      await preco(page, "#receipt-total", "R$ 165,00");
      assert.match(await page.locator("#receipt-items").textContent(), /Ana de Teste.*Poltrona 1/);
      await page.locator("#close-receipt").click();
      assert.equal(await page.locator("#events-heading").evaluate((heading) => heading === document.activeElement), true);
      await abrirRespostaAPI(page);
      const receipt = JSON.parse(await page.locator("#response-body").textContent());
      assert.equal(receipt.reservaId, 1);
      assert.equal(receipt.total, 165);
      assert.equal(receipt.ingressos.length, 2);
      assert.match(await page.locator("#response-meta").textContent(), /Status: 201/);
      assert.match(await page.locator("#selected-event").textContent(), /98 de 100/);
      assert.equal(await page.locator(".ticket-card").count(), 1);
      assert.equal(await page.locator('[name="nome"]').inputValue(), "");
      assert.equal(await page.locator('[name="poltrona"]').inputValue(), "3");
      await preencher(page, { nome: "Nova compra" });
      await page.locator("#submit-reservation").click();
      await page.locator("#receipt-dialog[open]").waitFor();
      await terminoDoPedido(page);
      await page.locator("#close-receipt").click();
      await abrirRespostaAPI(page);
      const second = JSON.parse(await page.locator("#response-body").textContent());
      assert.equal(second.reservaId, 2);
      assert.equal(second.ingressos[0].poltrona, 3);
      assert.match(await page.locator("#selected-event").textContent(), /97 de 100/);
      assert.equal(cleanText(await page.locator("#submit-reservation").textContent()), "Confirmar reserva");
    } finally {
      release();
    }
  });
});

for (const [status, expected, message = "Falha controlada"] of [
  [409, /já foi reservada/],
  [502, /não foi aprovado.*poltronas foram liberadas/],
  [413, /JSON excede o limite de 100 KB/, "JSON excede o limite de 100 KB"],
  [415, /Codificação do JSON não suportada/, "Codificação do JSON não suportada"],
]) {
  test(`HTTP ${status} mostra orientação persistente e permite nova tentativa`, { timeout: 30000 }, async (t) => {
    await fixture(t, async ({ page, server }) => {
      await abrir(page, server);
      await preencher(page);
      let posts = 0;
      await page.route("**/catalogo/reservas", (route) => {
        posts += 1;
        return route.fulfill({ status, contentType: "application/json", body: JSON.stringify({ mensagem: message }) });
      });
      for (let attempt = 1; attempt <= 2; attempt += 1) {
        await page.locator("#submit-reservation").click();
        await page.locator("#reservation-message.error").waitFor();
        await terminoDoPedido(page);
        assert.match(await page.locator("#reservation-message").textContent(), expected);
        assert.equal(await page.locator("#submit-reservation").isEnabled(), true);
        assert.equal(cleanText(await page.locator("#submit-reservation").textContent()), "Confirmar reserva");
        assert.equal(await page.locator("#receipt-dialog").isVisible(), false);
        assert.equal(await page.locator("#reset-reservation").isVisible(), false, "Rejeição conhecida não cria resultado desconhecido.");
        assert.equal(posts, attempt);
      }
    });
  });
}

test("falha no catálogo limpa eventos antigos, bloqueia reserva e recupera ao atualizar", { timeout: 30000 }, async (t) => {
  await fixture(t, async ({ page, server }) => {
    await abrir(page, server);
    await page.route("**/catalogo/eventos", (route) => route.abort("failed"));
    await page.locator("#refresh-events").click();
    await page.locator("#connection-label.offline").waitFor();
    await page.locator("#refresh-events:not([disabled])").waitFor();
    assert.equal(await page.locator(".event-card").count(), 0);
    assert.equal(await page.locator("#event-select").inputValue(), "");
    assert.equal(await page.locator("#event-select").isDisabled(), true);
    assert.equal(await page.locator("#submit-reservation").isDisabled(), true);
    await page.locator("#search-events").fill("Gaga");
    await page.locator('[data-filter="pop"]').click();
    assert.equal(await page.locator(".event-card").count(), 0, "Filtros não podem restaurar catálogo obsoleto.");
    await page.unroute("**/catalogo/eventos");
    await page.locator("#refresh-events").click();
    await page.locator("#connection-label.online").waitFor();
    await page.locator("#submit-reservation:not([disabled])").waitFor();
    assert.deepEqual(await page.locator(".event-card h3").allTextContents(), ["Lady Gaga"]);
    assert.equal(await page.locator("#event-select").isEnabled(), true);
  });
});

test("falha inicial dos metadados permite recuperar o catálogo pelo botão Atualizar", { timeout: 30000 }, async (t) => {
  await fixture(t, async ({ page, server }) => {
    let metadataRequests = 0;
    let eventRequests = 0;
    page.on("request", (request) => {
      if (request.url().endsWith("/catalogo.json")) metadataRequests += 1;
      if (request.url().endsWith("/catalogo/eventos")) eventRequests += 1;
    });
    await page.route("**/catalogo.json", (route) => route.abort("failed"));
    await page.goto(server.url, { waitUntil: "domcontentloaded" });
    await page.locator("#connection-label.offline").waitFor({ state: "attached" });
    await page.locator("#refresh-events:not([disabled])").waitFor();
    assert.equal(await page.locator(".event-card").count(), 0);
    assert.equal(await page.locator("#submit-reservation").isDisabled(), true);
    assert.equal(eventRequests, 0, "As reservas não devem ser oferecidas sem carregar o catálogo editorial.");
    await page.unroute("**/catalogo.json");
    await page.locator("#refresh-events").click();
    await page.locator("#connection-label.online").waitFor({ state: "attached" });
    await page.locator("#submit-reservation:not([disabled])").waitFor();
    assert.ok(metadataRequests >= 2, "Atualizar deve buscar novamente os metadados que falharam.");
    assert.ok(eventRequests >= 1);
    assert.equal(await page.locator(".event-card").count(), 14);
    assert.deepEqual(await page.locator(".event-card h3").allTextContents(), catalog.events.map((event) => event.artist));
  });
});

for (const [description, payload, status] of [
  ["vazio", [], "offline"],
  ["incompleto", events.slice(0, -1), "offline"],
  ["IDs duplicados", events.map((event, index) => index === 1 ? events[0] : event), "offline"],
  ["evento desconhecido", events.map((event, index) => index === 1 ? { ...event, id: 9999 } : event), "offline"],
  ["preço divergente", events.map((event, index) => index === 1 ? { ...event, preco: event.preco + 1 } : event), "offline"],
  ["nome divergente", events.map((event, index) => index === 1 ? { ...event, nome: "Evento diferente" } : event), "offline"],
  ["capacidade divergente", events.map((event, index) => index === 1 ? { ...event, capacidade: event.capacidade + 1 } : event), "offline"],
  ["disponibilidade inválida", events.map((event, index) => index === 1 ? { ...event, disponivel: event.capacidade + 1 } : event), "offline"],
  ["esgotado", events.map((event) => ({ ...event, disponivel: 0 })), "online"],
]) {
  test(`catálogo ${description} não permite reserva`, { timeout: 30000 }, async (t) => {
    await fixture(t, async ({ page, server }) => {
      await page.route("**/catalogo/eventos", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(payload) }));
      await page.goto(server.url, { waitUntil: "domcontentloaded" });
      await page.locator(`#connection-label.${status}`).waitFor({ state: "attached" });
      await page.locator("#refresh-events:not([disabled])").waitFor();
      assert.equal(await page.locator("#submit-reservation").isDisabled(), true);
      if (status === "online") {
        assert.equal(await page.locator(".event-card").count(), 14);
        assert.equal(await page.locator(".event-book:disabled").count(), 14);
        await page.locator(".event-details").first().click();
        assert.equal(await page.locator("#event-reserve").isDisabled(), true);
        assert.equal(await page.locator("#event-reserve").textContent(), "Simulação esgotada");
      } else {
        assert.equal(await page.locator(".event-card").count(), 0);
        assert.equal(await page.locator("#event-select").inputValue(), "");
      }
    });
  });
}

test("metadados que retiram uma reserva do catálogo bloqueiam dados incompatíveis", { timeout: 30000 }, async (t) => {
  await fixture(t, async ({ page, server }) => {
    await page.route("**/catalogo.json", (route) => route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ...catalog, events: catalog.events.map((event, index) => index === 3 ? { ...event, reservable: false } : event) }),
    }));
    await page.goto(server.url, { waitUntil: "domcontentloaded" });
    await page.locator("#connection-label.offline").waitFor({ state: "attached" });
    await page.locator("#refresh-events:not([disabled])").waitFor();
    assert.equal(await page.locator("#submit-reservation").isDisabled(), true);
    assert.equal(await page.locator("#event-select").inputValue(), "");
    assert.equal(await page.locator(".event-book").count(), 0);
  });
});

test("POST sem resposta expira em 10s, não repete automaticamente e exige novo pedido explícito", { timeout: 30000 }, async (t) => {
  await fixture(t, async ({ page, server }) => {
    await abrir(page, server);
    await page.clock.install();
    await preencher(page);
    let posts = 0;
    await page.route("**/catalogo/reservas", () => { posts += 1; }); // Mantém a resposta pendente até o AbortController agir.
    const request = page.waitForRequest((sent) => sent.method() === "POST" && sent.url().endsWith("/catalogo/reservas"));
    await page.locator("#submit-reservation").click();
    await request;
    await page.clock.runFor(10001);
    await page.locator("#reservation-message.warning").waitFor();
    await terminoDoPedido(page);
    assert.match(await page.locator("#reservation-message").textContent(), /pode ter sido registrada/);
    assert.equal(await page.locator("#submit-reservation").isDisabled(), true);
    assert.equal(await page.locator("#reset-reservation").isVisible(), true);
    assert.equal(await page.locator('[name="nome"]').inputValue(), "Ana de Teste");
    await page.locator("#reservation-form").dispatchEvent("submit");
    await page.clock.runFor(20000);
    assert.equal(posts, 1);
    await page.locator("#reset-reservation").click();
    assert.equal(await page.locator('[name="nome"]').inputValue(), "");
    assert.equal(await page.locator('[name="poltrona"]').inputValue(), "2");
    assert.match(await page.locator("#reservation-message").textContent(), /anterior continua com resultado desconhecido/);
    assert.equal(await page.locator("#submit-reservation").isEnabled(), true);
    await preencher(page, { poltrona: 1 });
    await page.locator("#submit-reservation").click();
    assert.match(await page.locator("#reservation-message").textContent(), /resultado desconhecido.*outro lugar/);
    assert.equal(await page.locator('[name="poltrona"]').getAttribute("aria-invalid"), "true");
    assert.equal(posts, 1, "Digitar a poltrona incerta manualmente também deve impedir reenvio.");
    // O bloqueio pertence ao evento original, não impede a mesma numeração em outro.
    await page.unroute("**/catalogo/reservas");
    await page.clock.resume();
    await page.locator("#event-select").selectOption("2");
    await preencher(page, { nome: "Outro evento", poltrona: 1 });
    await page.locator("#submit-reservation").click();
    await page.locator("#receipt-dialog[open]").waitFor();
    await terminoDoPedido(page);
    assert.match(await page.locator("#receipt-info").textContent(), /Bruno Mars/);
  });
});

for (const failure of ["conexao", "comprovante", "servidor"]) {
  test(`POST com falha de ${failure} não confirma sucesso nem permite reenvio imediato`, { timeout: 30000 }, async (t) => {
    await fixture(t, async ({ page, server }) => {
      await abrir(page, server);
      await preencher(page);
      await page.route("**/catalogo/reservas", (route) => failure === "conexao" ? route.abort("failed") : route.fulfill({ status: failure === "servidor" ? 500 : 201, contentType: "application/json", body: failure === "servidor" ? JSON.stringify({ mensagem: "erro interno" }) : "{}" }));
      await page.locator("#submit-reservation").click();
      await page.locator("#reservation-message.warning").waitFor();
      await terminoDoPedido(page);
      assert.match(await page.locator("#reservation-message").textContent(), /Não foi possível confirmar/);
      assert.equal(await page.locator("#receipt-dialog").isVisible(), false);
      assert.equal(await page.locator("#submit-reservation").isDisabled(), true);
      assert.equal(await page.locator("#reset-reservation").isVisible(), true);
    });
  });
}

for (const [description, change] of [
  ["tipo de ingresso", (receipt) => ({ ...receipt, ingressos: receipt.ingressos.map((ticket) => ({ ...ticket, tipo: "meia", valor: 50 })), total: 55 })],
  ["valor do ingresso", (receipt) => ({ ...receipt, ingressos: receipt.ingressos.map((ticket) => ({ ...ticket, valor: 1 })), total: 1.1 })],
  ["total da reserva", (receipt) => ({ ...receipt, total: 999 })],
  ["identificador inseguro", (receipt) => ({ ...receipt, reservaId: Number.MAX_SAFE_INTEGER + 1 })],
  ["nome do participante", (receipt) => ({ ...receipt, ingressos: receipt.ingressos.map((ticket) => ({ ...ticket, nome: "Outra pessoa" })) })],
  ["poltrona", (receipt) => ({ ...receipt, ingressos: receipt.ingressos.map((ticket) => ({ ...ticket, poltrona: 2 })) })],
]) {
  test(`comprovante com ${description} divergente não confirma a reserva`, { timeout: 30000 }, async (t) => {
    await fixture(t, async ({ page, server }) => {
      await abrir(page, server);
      await preencher(page);
      await page.route("**/catalogo/reservas", (route) => route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify(change({ reservaId: 1, eventoId: 1, ingressos: [{ nome: "Ana de Teste", poltrona: 1, tipo: "inteira", valor: 100 }], total: 110 })),
      }));
      await page.locator("#submit-reservation").click();
      await page.locator("#reservation-message.warning").waitFor();
      await terminoDoPedido(page);
      assert.equal(await page.locator("#receipt-dialog").isVisible(), false);
      assert.equal(await page.locator("#submit-reservation").isDisabled(), true);
      assert.equal(await page.locator('[name="nome"]').inputValue(), "Ana de Teste");
    });
  });
}

for (const [basePrice, student, ticketValue, expectedTotal] of [[2.01, true, 1.01, 1.11], [17.15, false, 17.15, 18.87]]) {
  test(`resumo e recibo arredondam corretamente preço fracionário ${basePrice}`, { timeout: 30000 }, async (t) => {
    await fixture(t, async ({ page, server }) => {
      const targetId = 2;
      await page.route("**/catalogo.json", (route) => route.fulfill({
        status: 200, contentType: "application/json", body: JSON.stringify({ ...catalog, events: catalog.events.map((event) => event.id === targetId ? { ...event, price: basePrice } : event) }),
      }));
      await page.route("**/catalogo/eventos", (route) => route.fulfill({
        status: 200, contentType: "application/json", body: JSON.stringify(events.map((event) => event.id === targetId ? { ...event, preco: basePrice } : event)),
      }));
      let reservationRequest;
      await page.route("**/catalogo/reservas", (route) => {
        reservationRequest = route.request().postDataJSON();
        return route.fulfill({ status: 201, contentType: "application/json", body: JSON.stringify({
          reservaId: 1, eventoId: targetId, ingressos: [{ nome: "Ana de Teste", poltrona: 1, tipo: student ? "meia" : "inteira", valor: ticketValue }], total: expectedTotal,
        }) });
      });
      await abrir(page, server);
      await page.locator("#event-select").selectOption(String(targetId));
      await preencher(page);
      if (student) await page.locator('[name="estudante"]').check();
      const currency = (value) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value).replace(/\s+/g, " ");
      await preco(page, "#summary-subtotal", currency(ticketValue));
      await preco(page, "#summary-total", currency(expectedTotal));
      await page.locator("#submit-reservation").click();
      await page.locator("#receipt-dialog[open]").waitFor();
      await terminoDoPedido(page);
      await preco(page, "#receipt-total", currency(expectedTotal));
      assert.equal(reservationRequest.eventoId, targetId);
      assert.equal(reservationRequest.ingressos[0].estudante, student);
    });
  });
}

test("nomes são texto seguro e impressão mantém aviso de comprovante fictício", { timeout: 30000 }, async (t) => {
  await fixture(t, async ({ page, server }) => {
    const payload = '<img src=x onerror="window.injetado=true">';
    await page.route("**/catalogo.json", (route) => route.fulfill({
      status: 200, contentType: "application/json", body: JSON.stringify({ ...catalog, events: [{ ...catalog.events[0], artist: payload }, ...catalog.events.slice(1)] }),
    }));
    await page.route("**/catalogo/eventos", async (route) => {
      const response = await route.fetch();
      const lista = await response.json();
      await route.fulfill({ response, contentType: "application/json", body: JSON.stringify(lista.map((event) => event.id === 1 ? { ...event, nome: `${payload} — ${catalog.events[0].tour}` } : event)) });
    });
    await abrir(page, server);
    assert.equal(await page.locator(".event-card h3").first().textContent(), payload);
    assert.equal(await page.locator(".event-card h3 img").count(), 0);
    await preencher(page, { nome: payload });
    await page.locator("#submit-reservation").click();
    await page.locator("#receipt-dialog[open]").waitFor();
    await terminoDoPedido(page);
    assert.match(await page.locator("#receipt-items").textContent(), /<img src=x/);
    assert.equal(await page.locator("#receipt-items img").count(), 0);
    assert.equal(await page.evaluate(() => window.injetado), undefined);
    await page.emulateMedia({ media: "print" });
    assert.equal(await page.evaluate(() => matchMedia("print").matches), true, "O navegador precisa aplicar a mídia de impressão.");
    await aguardarPintura(page);
    await page.waitForFunction(() => {
      const body = getComputedStyle(document.body);
      const dialog = getComputedStyle(document.querySelector("#receipt-dialog"));
      return body.backgroundColor === "rgb(255, 255, 255)" && dialog.backgroundColor === "rgb(255, 255, 255)";
    }, undefined, { timeout: 3000 }).catch(async (error) => {
      const diagnostics = await page.evaluate(() => ({
        print: matchMedia("print").matches,
        theme: getComputedStyle(document.documentElement).getPropertyValue("--bg"),
        body: getComputedStyle(document.body).backgroundColor,
        rules: Array.from(document.styleSheets).filter((sheet) => sheet.href?.endsWith("/styles.css")).flatMap((sheet) => Array.from(sheet.cssRules)).filter((rule) => rule.conditionText === "print").map((rule) => rule.cssText),
      }));
      throw new Error(`O tema impresso não foi aplicado: ${JSON.stringify(diagnostics)}`, { cause: error });
    });
    const printStyles = await page.evaluate(() => {
      const body = getComputedStyle(document.body);
      const dialog = getComputedStyle(document.querySelector("#receipt-dialog"));
      return { bodyBackground: body.backgroundColor, bodyText: body.color, dialogBackground: dialog.backgroundColor, dialogText: dialog.color };
    });
    assert.deepEqual(printStyles, {
      bodyBackground: "rgb(255, 255, 255)",
      bodyText: "rgb(0, 0, 0)",
      dialogBackground: "rgb(255, 255, 255)",
      dialogText: "rgb(0, 0, 0)",
    }, "A impressão deve aplicar fundo branco e texto preto ao comprovante.");
    assert.equal(await page.locator(".receipt-disclaimer").isVisible(), true);
    assert.match(await page.locator(".receipt-disclaimer").textContent(), /não é válido para entrada em eventos reais/);
    assert.equal(await page.locator(".receipt-actions").isHidden(), true);
    assert.equal(await page.locator(".announcement").isHidden(), true);
    assert.equal(await page.locator(".site-header").isHidden(), true);
    await page.screenshot({ path: resolve(artifacts, "comprovante-impressao.png"), fullPage: true });
    await page.emulateMedia({ media: "screen" });
    await page.locator("#close-receipt").click();
    await page.emulateMedia({ media: "print" });
    assert.equal(await page.locator("#receipt-dialog").isHidden(), true, "Uma impressão comum não deve incluir comprovante fechado.");
  });
});
