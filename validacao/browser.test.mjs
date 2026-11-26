import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { iniciarServidorUI } from "./servidor-ui.ts";
import { criarEventosDemo, lerCatalogo } from "../src/catalogo.ts";

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
const events = criarEventosDemo().map((evento) => evento.info());

async function fixture(t, run, options = {}) {
  const server = await iniciarServidorUI();
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    locale: "pt-BR",
    reducedMotion: "reduce",
    ...options,
  });
  // As fotografias dos artistas são arquivos locais reais. Apenas fontes
  // externas são substituídas para os testes não dependerem de terceiros.
  await context.route("https://fonts.googleapis.com/**", (route) => route.fulfill({
    status: 200, contentType: "text/css", body: "",
  }));
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
    ...catalog.events.map((event) => event.image),
    "/images/artists/hero-gaga.webp",
    "/images/artists/hero-coldplay.webp",
  ]), "Os oito arquivos de fotografia devem carregar na página principal.");
  await page.evaluate(() => window.scrollTo({ top: 0, left: 0, behavior: "instant" }));
  await aguardarPintura(page);
}

test("catálogo real, busca sem acentos e filtros selecionam o evento", { timeout: 30000 }, async (t) => {
  await fixture(t, async ({ page, server }) => {
    await abrir(page, server);
    assert.match(await page.title(), /Bilheteria/i);
    assert.equal(await page.locator(".event-card").count(), 6);
    assert.deepEqual(await page.locator(".event-card h3").allTextContents(), catalog.events.map((event) => event.artist));
    await page.locator('[data-filter="rock"]').click();
    assert.deepEqual(await page.locator(".event-card h3").allTextContents(), ["Coldplay", "Linkin Park"]);
    assert.equal(await page.locator('[data-filter="rock"]').getAttribute("aria-pressed"), "true");
    await page.locator(".event-book").first().click();
    assert.equal(await page.locator("#event-select").inputValue(), "4");
    await preco(page, "#summary-total", "R$ 132,00");
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
      assert.match(await page.locator("#event-dialog").textContent(), /simulad|simula[çc][ãa]o/i);
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
    page.on("request", (request) => { if (request.method() === "POST" && request.url().endsWith("/reservas")) requests += 1; });
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
    await page.route("**/reservas", async (route) => {
      posts += 1;
      await gate;
      await route.continue();
    });
    try {
      const sent = page.waitForRequest((request) => request.method() === "POST" && request.url().endsWith("/reservas"));
      const response = page.waitForResponse((received) => received.request().method() === "POST" && received.url().endsWith("/reservas"));
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

for (const [status, expected] of [[409, /já foi reservada/], [502, /não foi aprovado.*poltronas foram liberadas/]]) {
  test(`HTTP ${status} mostra orientação persistente e permite nova tentativa`, { timeout: 30000 }, async (t) => {
    await fixture(t, async ({ page, server }) => {
      await abrir(page, server);
      await preencher(page);
      let posts = 0;
      await page.route("**/reservas", (route) => {
        posts += 1;
        return route.fulfill({ status, contentType: "application/json", body: JSON.stringify({ mensagem: "Falha controlada" }) });
      });
      for (let attempt = 1; attempt <= 2; attempt += 1) {
        await page.locator("#submit-reservation").click();
        await page.locator("#reservation-message.error").waitFor();
        await terminoDoPedido(page);
        assert.match(await page.locator("#reservation-message").textContent(), expected);
        assert.equal(await page.locator("#submit-reservation").isEnabled(), true);
        assert.equal(cleanText(await page.locator("#submit-reservation").textContent()), "Confirmar reserva");
        assert.equal(await page.locator("#receipt-dialog").isVisible(), false);
        assert.equal(posts, attempt);
      }
    });
  });
}

test("falha no catálogo limpa eventos antigos, bloqueia reserva e recupera ao atualizar", { timeout: 30000 }, async (t) => {
  await fixture(t, async ({ page, server }) => {
    await abrir(page, server);
    await page.route("**/eventos", (route) => route.abort("failed"));
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
    await page.unroute("**/eventos");
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
      if (request.url().endsWith("/eventos")) eventRequests += 1;
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
    assert.equal(await page.locator(".event-card").count(), 6);
    assert.deepEqual(await page.locator(".event-card h3").allTextContents(), catalog.events.map((event) => event.artist));
  });
});

test("catálogo vazio, esgotado ou malformado não permite reserva", { timeout: 30000 }, async (t) => {
  await fixture(t, async ({ page, server }) => {
    for (const [payload, status] of [[[], "online"], [[{ ...events[0], disponivel: 0 }], "online"], [[events[0], events[0]], "offline"]]) {
      await page.route("**/eventos", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(payload) }));
      await page.goto(server.url, { waitUntil: "domcontentloaded" });
      await page.locator(`#connection-label.${status}`).waitFor();
      await page.locator("#refresh-events:not([disabled])").waitFor();
      assert.equal(await page.locator("#submit-reservation").isDisabled(), true);
      if (payload.length === 1) assert.equal(await page.locator(".event-book").isDisabled(), true);
      else assert.equal(await page.locator(".event-card").count(), 0);
      await page.unroute("**/eventos");
    }
  });
});

test("POST sem resposta expira em 10s, não repete automaticamente e exige novo pedido explícito", { timeout: 30000 }, async (t) => {
  await fixture(t, async ({ page, server }) => {
    await abrir(page, server);
    await page.clock.install();
    await preencher(page);
    let posts = 0;
    await page.route("**/reservas", () => { posts += 1; }); // Mantém a resposta pendente até o AbortController agir.
    const request = page.waitForRequest((sent) => sent.method() === "POST" && sent.url().endsWith("/reservas"));
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
  });
});

for (const failure of ["conexao", "comprovante"]) {
  test(`POST com falha de ${failure} não confirma sucesso nem permite reenvio imediato`, { timeout: 30000 }, async (t) => {
    await fixture(t, async ({ page, server }) => {
      await abrir(page, server);
      await preencher(page);
      await page.route("**/reservas", (route) => failure === "conexao" ? route.abort("failed") : route.fulfill({ status: 201, contentType: "application/json", body: "{}" }));
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

test("nomes são texto seguro e impressão mantém aviso de comprovante fictício", { timeout: 30000 }, async (t) => {
  await fixture(t, async ({ page, server }) => {
    const payload = '<img src=x onerror="window.injetado=true">';
    await page.route("**/catalogo.json", (route) => route.fulfill({
      status: 200, contentType: "application/json", body: JSON.stringify({ ...catalog, events: [{ ...catalog.events[0], artist: payload }, ...catalog.events.slice(1)] }),
    }));
    await page.route("**/eventos", async (route) => {
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
    await page.screenshot({ path: resolve(artifacts, "comprovante-impressao.png"), fullPage: true });
    await page.emulateMedia({ media: "screen" });
    await page.locator("#close-receipt").click();
    await page.emulateMedia({ media: "print" });
    assert.equal(await page.locator("#receipt-dialog").isHidden(), true, "Uma impressão comum não deve incluir comprovante fechado.");
  });
});
