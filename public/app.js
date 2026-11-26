"use strict";

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const money = (value) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
const round = (value) => Math.round((value + Number.EPSILON) * 100) / 100;
const state = { events: [], filter: "todos", search: "", lastResponse: null, processing: false, loading: false, connected: false, uncertain: false };
const confirmedSeats = new Map();
const uncertainSeats = new Map();
const REQUEST_TIMEOUT_MS = 10000;
const searchText = (value) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR").trim();
let catalog = new Map();
let catalogLoaded = false;
let catalogVerifiedAt = "";
let detailedEventId = null;
const meta = (event) => catalog.get(event.id);
const hasText = (value) => typeof value === "string" && value.trim().length > 0;

function isHttpsUrl(value) {
  if (!hasText(value)) return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password;
  } catch { return false; }
}

async function loadCatalog() {
  const data = await api("/catalogo.json", {}, false);
  const date = data && hasText(data.verifiedAt) ? new Date(data.verifiedAt) : null;
  if (!data || !/^\d{4}-\d{2}-\d{2}$/.test(data.verifiedAt) || !date || !Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== data.verifiedAt || !Array.isArray(data.events) || !data.events.length) {
    throw new Error("O catálogo editorial não está no formato esperado.");
  }
  const entries = new Map();
  for (const item of data.events) {
    const credit = item?.credit;
    const positions = typeof item?.objectPosition === "string" && /^\d{1,3}% \d{1,3}%$/.test(item.objectPosition) ? item.objectPosition.match(/\d+/g).map(Number) : null;
    if (!item || !Number.isSafeInteger(item.id) || item.id < 1 || entries.has(item.id) ||
        !["artist", "tour", "genre", "year", "description", "imageAlt", "status"].every((field) => hasText(item[field])) ||
        !["pop", "rnb", "rock", "latino"].includes(item.category) ||
        !/^\/images\/artists\/[a-z0-9-]+\.webp$/.test(item.image) ||
        !isHttpsUrl(item.officialUrl) || !isHttpsUrl(item.sourceUrl) ||
        !Number.isFinite(item.price) || item.price <= 0 || !Number.isSafeInteger(item.capacity) || item.capacity < 1 ||
        !/^#[a-f0-9]{6}$/i.test(item.accent) || !["contain", "cover"].includes(item.dialogImageFit) || !positions || positions.some((position) => position > 100) ||
        !credit || !["author", "license", "description"].every((field) => hasText(credit[field])) || !isHttpsUrl(credit.licenseUrl) || !isHttpsUrl(credit.sourceUrl)) {
      throw new Error("O catálogo contém informações incompletas ou inválidas.");
    }
    entries.set(item.id, item);
  }
  // Só guarda metadados validados. O botão Atualizar tenta de novo após uma falha.
  catalog = entries;
  catalogVerifiedAt = new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC" }).format(date);
  catalogLoaded = true;
}

function node(tag, className, text) {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (text !== undefined) el.textContent = String(text);
  return el;
}

function toast(message, kind = "error") {
  const el = $("#toast");
  el.textContent = message;
  el.className = "toast " + kind;
  el.hidden = false;
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => { el.hidden = true; }, 5500);
}

function setConnection(online, message) {
  const label = $("#connection-label");
  label.classList.toggle("online", online);
  label.classList.toggle("offline", !online);
  label.replaceChildren(node("span", "connection-dot"), document.createTextNode(message));
}

function recordResponse(status, duration, body) {
  state.lastResponse = { status, duration, body };
  $("#response-meta").textContent = "Status: " + (status ?? "sem conexão") + "  •  Tempo: " + Math.round(duration) + " ms";
  $("#response-body").textContent = body == null ? "Sem conteúdo" : JSON.stringify(body, null, 2);
}

async function api(path, options = {}, record = true) {
  const started = performance.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  let response;
  try {
    response = await fetch(path, { ...options, cache: "no-store", signal: controller.signal });
    const raw = await response.text();
    let data;
    try { data = raw ? JSON.parse(raw) : null; }
    catch { data = null; }
    if (record) recordResponse(response.status, performance.now() - started, data ?? { mensagem: "Resposta fora do formato esperado." });
    if (!response.ok) {
      const error = new Error(typeof data?.mensagem === "string" ? data.mensagem : "Erro HTTP " + response.status);
      error.status = response.status;
      throw error;
    }
    if (data === null) {
      const error = new Error("O servidor retornou uma resposta inválida.");
      error.uncertain = options.method === "POST";
      throw error;
    }
    return data;
  } catch (error) {
    if (error.status || error.uncertain) throw error;
    const interrupted = new Error(controller.signal.aborted ? "O servidor demorou para responder. Tente atualizar os eventos." : "A conexão foi interrompida. Verifique sua conexão e atualize os eventos.");
    interrupted.uncertain = options.method === "POST";
    if (record) recordResponse(response?.status ?? null, performance.now() - started, { mensagem: interrupted.message });
    setConnection(false, "Sem conexão");
    throw interrupted;
  } finally {
    clearTimeout(timeout);
  }
}

function updateControls() {
  const blocked = state.processing;
  const unavailable = blocked || !state.connected || state.loading;
  $("#reservation-form").setAttribute("aria-busy", String(blocked));
  $$("#reservation-form input, #reservation-form button").forEach((control) => { control.disabled = blocked; });
  $$(".event-book").forEach((control) => { control.disabled = unavailable || state.uncertain || control.dataset.soldOut === "true"; });
  $$(".event-details").forEach((control) => { control.disabled = unavailable; });
  $("#featured-tour").disabled = unavailable || !state.events.some((event) => event.id === 1);
  const detailedEvent = state.events.find((event) => event.id === detailedEventId);
  $("#event-reserve").disabled = unavailable || state.uncertain || !detailedEvent || detailedEvent.disponivel === 0;
  $("#event-reserve").textContent = detailedEvent?.disponivel === 0 ? "Simulação esgotada" : "Simular reserva";
  $("#add-ticket").disabled = blocked || $$(".ticket-card").length >= 12;
  $("#event-select").disabled = unavailable;
  $("#refresh-events").disabled = blocked || state.loading;
  $("#submit-reservation").disabled = blocked || !state.connected || state.loading || state.uncertain || !selectedEvent() || selectedEvent().disponivel === 0;
  $("#reset-reservation").hidden = !state.uncertain;
  $("#reset-reservation").disabled = blocked;
}

function formMessage(message = "", kind = "error", focusTarget = null) {
  const box = $("#reservation-message");
  box.textContent = message;
  box.hidden = !message;
  box.className = "reservation-message " + kind;
  $$("#reservation-form [aria-invalid]").forEach((field) => field.removeAttribute("aria-invalid"));
  if (focusTarget) {
    focusTarget.setAttribute("aria-invalid", "true");
    focusTarget.focus();
  }
}

function selectedEvent() {
  return state.events.find((item) => String(item.id) === $("#event-select").value);
}

function currentTickets() {
  return $$(".ticket-card").map((row) => ({
    nome: $('[name="nome"]', row).value.trim(),
    idade: $('[name="idade"]', row).valueAsNumber,
    estudante: $('[name="estudante"]', row).checked,
    pcd: $('[name="pcd"]', row).checked,
    poltrona: $('[name="poltrona"]', row).valueAsNumber
  }));
}

function ticketType(ticket) {
  return ticket.estudante || ticket.pcd || ticket.idade >= 60 ? "meia" : "inteira";
}

function ticketPrice(base, ticket) {
  return ticketType(ticket) === "meia" ? round(base / 2) : base;
}

function calculateSummary() {
  const event = selectedEvent();
  const tickets = currentTickets();
  const subtotal = event ? tickets.reduce((sum, ticket) => sum + ticketPrice(event.preco, ticket), 0) : 0;
  const total = round(subtotal * 1.1);
  const panel = $("#summary-rows");
  panel.replaceChildren();
  if (!event) {
    panel.append(node("div", "summary-empty", "Escolha um evento para calcular seu pedido."));
  } else {
    tickets.forEach((ticket, index) => {
      const row = node("div", "summary-row");
      const left = node("div");
      left.append(node("span", "", ticket.nome || "Participante " + (index + 1)), node("small", "", (Number.isInteger(ticket.poltrona) ? "Poltrona " + ticket.poltrona : "Escolha a poltrona") + " • " + (ticketType(ticket) === "meia" ? "Meia-entrada" : "Inteira")));
      row.append(left, node("strong", "", money(ticketPrice(event.preco, ticket))));
      panel.append(row);
    });
  }
  $("#summary-subtotal").textContent = money(subtotal);
  $("#summary-fee").textContent = money(round(total - subtotal));
  $("#summary-total").textContent = money(total);
  $$(".ticket-card").forEach((row, index) => {
    const ticket = tickets[index];
    $(".ticket-kind", row).textContent = ticketType(ticket) === "meia" ? "Meia-entrada (50%)" : "Entrada inteira";
    $(".ticket-amount", row).textContent = money(event ? ticketPrice(event.preco, ticket) : 0);
  });
  const checkout = $("#checkout-event");
  checkout.replaceChildren();
  const mark = node("div", "checkout-event-icon", "✦");
  const details = node("div");
  details.append(node("strong", "", event?.nome || "Selecione um evento"), node("span", "", event ? tickets.length + (tickets.length === 1 ? " ingresso" : " ingressos") + " • " + event.disponivel + " lugares no simulador" : "Seu resumo aparecerá aqui"));
  checkout.append(mark, details);
}

function renderSelectedEvent() {
  const event = selectedEvent();
  const target = $("#selected-event");
  target.replaceChildren();
  if (event) {
    const image = node("img", "selected-event-cover");
    image.src = meta(event).image;
    image.alt = "";
    const detail = node("div");
    detail.append(node("strong", "", event.nome), node("span", "", money(event.preco) + " • " + event.disponivel + " de " + event.capacidade + " lugares no simulador"));
    target.append(image, detail);
  } else {
    target.append(node("span", "selected-placeholder", "Selecione um evento para conferir disponibilidade e valores."));
  }
  $$('.ticket-card [name="poltrona"]').forEach((input) => { input.max = String(event?.capacidade || 999); });
  calculateSummary();
}

function nextSeat(event, rows = currentTickets()) {
  const used = new Set(rows.map((ticket) => ticket.poltrona));
  const alreadyReserved = confirmedSeats.get(event?.id) || new Set();
  for (let seat = 1; seat <= (event?.capacidade || 999); seat += 1) {
    if (!used.has(seat) && !alreadyReserved.has(seat) && !uncertainSeats.get(event?.id)?.has(seat)) return String(seat);
  }
  return "";
}

function addTicket() {
  if (state.processing) return;
  if ($$(".ticket-card").length >= 12) { toast("Você pode adicionar até 12 ingressos por reserva."); return; }
  const seat = nextSeat(selectedEvent());
  const row = $("#ticket-template").content.firstElementChild.cloneNode(true);
  $('[name="poltrona"]', row).value = seat;
  $("#ticket-list").append(row);
  row.addEventListener("input", () => {
    calculateSummary();
    if (!state.uncertain) formMessage();
  });
  row.addEventListener("change", calculateSummary);
  $(".remove-ticket", row).addEventListener("click", () => {
    if (state.processing) return;
    if ($$(".ticket-card").length === 1) { toast("A reserva precisa de pelo menos um participante."); return; }
    row.remove();
    renumberTickets();
    calculateSummary();
    if (!state.uncertain) formMessage();
    updateControls();
  });
  renumberTickets();
  renderSelectedEvent();
  updateControls();
}

function resetTickets(event = selectedEvent()) {
  $("#ticket-list").replaceChildren();
  // A nova reserva começa em uma poltrona ainda não confirmada nesta sessão.
  const wasProcessing = state.processing;
  state.processing = false;
  addTicket();
  $('[name="poltrona"]', $(".ticket-card")).value = nextSeat(event, []);
  calculateSummary();
  state.processing = wasProcessing;
  updateControls();
}

function renumberTickets() {
  const rows = $$(".ticket-card");
  rows.forEach((row, index) => {
    $(".ticket-tag", row).textContent = "INGRESSO " + String(index + 1).padStart(2, "0");
    $("legend", row).textContent = "Dados do participante " + (index + 1);
    $(".remove-ticket", row).setAttribute("aria-label", "Remover participante " + (index + 1));
    $(".remove-ticket", row).hidden = rows.length === 1;
  });
}

function chooseEvent(id) {
  const event = state.events.find((item) => item.id === id);
  if (state.processing || state.loading || !state.connected || state.uncertain || !event || event.disponivel === 0) return;
  if ($("#event-dialog").open) $("#event-dialog").close();
  $("#event-select").value = String(id);
  formMessage();
  renderSelectedEvent();
  updateControls();
  $("#reserva").scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" });
  $("#event-select").focus({ preventScroll: true });
}

function sourceLink(text, url) {
  const link = node("a", "", text);
  link.href = url;
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  return link;
}

function showEventDetails(id) {
  const event = state.events.find((item) => item.id === id);
  if (state.processing || state.loading || !state.connected || !event || $("#receipt-dialog").open) return;
  const data = meta(event);
  detailedEventId = id;
  $("#event-dialog-title").textContent = data.artist;
  $("#event-dialog-tour").textContent = data.tour;
  $("#event-dialog-description").textContent = data.description;
  $("#event-dialog-genre").textContent = data.genre;
  $("#event-dialog-style").textContent = data.genre;
  $("#event-dialog-year").textContent = data.year;
  $("#event-dialog-note").textContent = data.status + " Fontes consultadas em " + catalogVerifiedAt + ".";
  $("#event-dialog-price").textContent = money(round(event.preco / 2));
  const photo = $("#event-dialog-image");
  photo.src = data.image;
  photo.alt = data.imageAlt;
  photo.style.objectPosition = data.objectPosition;
  photo.style.objectFit = data.dialogImageFit;
  const officialLink = $("#event-official-link");
  officialLink.href = data.officialUrl;
  officialLink.target = "_blank";
  officialLink.rel = "noopener noreferrer";
  const credit = data.credit;
  $("#event-image-credit").replaceChildren(
    document.createTextNode("Foto: " + credit.author + " · "),
    sourceLink(credit.license, credit.licenseUrl),
    document.createTextNode(" · "),
    sourceLink("Ver original", credit.sourceUrl),
    document.createTextNode(". " + credit.description)
  );
  const dialog = $("#event-dialog");
  dialog.style.setProperty("--event-accent", data.accent);
  updateControls();
  if (!dialog.open) dialog.showModal();
}

function createEventCard(event) {
  const data = meta(event);
  const soldOut = event.disponivel === 0;
  const unavailable = state.processing || state.loading || !state.connected;
  const card = node("article", "event-card");
  card.style.setProperty("--event-accent", data.accent);
  const cover = node("div", "event-cover");
  const image = node("img", "event-img");
  image.src = data.image;
  image.alt = data.imageAlt;
  image.loading = "lazy";
  image.decoding = "async";
  image.width = data.credit.width || 800;
  image.height = data.credit.height || 600;
  image.style.objectPosition = data.objectPosition;
  cover.append(image, node("span", "event-tag", data.genre), node("span", "event-year", data.year));
  const info = node("div", "event-info");
  info.append(node("span", "event-genre", "ARTISTA EM DESTAQUE"), node("h3", "event-title", data.artist), node("p", "event-tour", data.tour), node("p", "event-description", data.description));
  const foot = node("div", "event-footer");
  const price = node("div", "event-price");
  price.append(node("small", "", "MEIA NO SIMULADOR"), node("strong", "", money(round(event.preco / 2))), node("small", "price-note", "+ taxa de serviço (10%)"));
  const actions = node("div", "event-actions");
  const details = node("button", "event-details", "Ver turnê");
  details.type = "button";
  details.setAttribute("aria-label", "Ver turnê de " + data.artist);
  details.disabled = unavailable;
  details.addEventListener("click", () => showEventDetails(event.id));
  const book = node("button", "event-book", soldOut ? "Simulação esgotada" : "Simular");
  book.type = "button";
  book.setAttribute("aria-label", soldOut ? "Simulação esgotada para " + data.artist : "Simular reserva para " + data.artist);
  book.dataset.soldOut = String(soldOut);
  book.disabled = unavailable || state.uncertain || soldOut;
  book.addEventListener("click", () => chooseEvent(event.id));
  actions.append(details, book);
  foot.append(price, actions);
  info.append(foot);
  card.append(cover, info);
  return card;
}

function renderEvents() {
  if (!state.connected) {
    $("#catalog-counter").textContent = state.loading ? "Carregando..." : "Sem conexão";
    $("#events-grid").replaceChildren(node("div", "empty-events", state.loading ? "Buscando eventos disponíveis..." : "Não foi possível carregar os eventos. Verifique sua conexão e clique em Atualizar."));
    return;
  }
  const search = searchText(state.search);
  const matching = state.events.filter((event) => {
    const info = meta(event);
    const matchesCategory = state.filter === "todos" || info.category === state.filter;
    const matchesSearch = !search || searchText(info.artist + " " + info.tour + " " + info.genre + " " + info.description).includes(search);
    return matchesCategory && matchesSearch;
  });
  $("#catalog-counter").textContent = matching.length + (matching.length === 1 ? " turnê encontrada" : " turnês encontradas");
  $("#events-grid").replaceChildren(...(matching.length ? matching.map(createEventCard) : [node("div", "empty-events", state.events.length ? "Nenhum evento corresponde à busca. Experimente outro filtro." : "Nenhum evento disponível no momento.")]));
}

function isEvent(event) {
  return event && Number.isInteger(event.id) && event.id > 0 && typeof event.nome === "string" && event.nome.trim().length > 0 && Number.isFinite(event.preco) && event.preco > 0 && Number.isInteger(event.capacidade) && event.capacidade > 0 && Number.isInteger(event.disponivel) && event.disponivel >= 0 && event.disponivel <= event.capacidade;
}

async function loadEvents(record = false) {
  if (state.loading) return false;
  state.loading = true;
  updateControls();
  try {
    if (!catalogLoaded) await loadCatalog();
    const events = await api("/eventos", {}, record);
    if (!Array.isArray(events) || !events.every(isEvent) || new Set(events.map((event) => event.id)).size !== events.length) throw new Error("O servidor retornou um formato de eventos inesperado.");
    if (!events.every((event) => {
      const info = meta(event);
      return info && event.nome === info.artist + " — " + info.tour && event.preco === info.price && event.capacidade === info.capacity;
    })) {
      catalogLoaded = false;
      throw new Error("O catálogo e os dados de reserva estão inconsistentes.");
    }
    state.events = events;
    state.connected = true;
    const select = $("#event-select");
    const previous = select.value;
    select.replaceChildren();
    events.forEach((event) => {
      const option = node("option", "", event.nome + " — " + money(event.preco) + " • " + event.disponivel + " lugares no simulador");
      option.value = String(event.id);
      select.append(option);
    });
    if (events.some((event) => String(event.id) === previous)) select.value = previous;
    else if (events.length) select.value = String(events.find((event) => event.disponivel > 0)?.id ?? events[0].id);
    else {
      const empty = node("option", "", "Nenhum evento disponível");
      empty.value = "";
      select.append(empty);
    }
    renderEvents();
    renderSelectedEvent();
    setConnection(true, "Conectado");
    return true;
  } catch (error) {
    state.events = [];
    state.connected = false;
    setConnection(false, "Sem conexão");
    const empty = node("option", "", "Atualize os eventos para continuar");
    empty.value = "";
    $("#event-select").replaceChildren(empty);
    renderSelectedEvent();
    return false;
  } finally {
    state.loading = false;
    renderEvents();
    updateControls();
  }
}

function validateTickets(event, tickets) {
  const issue = (message, element = null) => ({ message, element });
  if (!state.connected || !event) return issue("Atualize os eventos e escolha uma opção antes de continuar.", $("#refresh-events"));
  if (!tickets.length) return issue("Adicione pelo menos um participante.");
  if (event.disponivel < tickets.length) return issue("Não há lugares disponíveis suficientes para esta reserva.");
  const seats = new Set();
  const rows = $$(".ticket-card");
  for (const [index, ticket] of tickets.entries()) {
    if (!ticket.nome || ticket.nome.length > 80) return issue("Informe o nome do participante " + (index + 1) + " (até 80 caracteres).", $('[name="nome"]', rows[index]));
    if (!Number.isInteger(ticket.idade) || ticket.idade < 0 || ticket.idade > 120) return issue("Informe uma idade válida (0 a 120 anos) para o participante " + (index + 1) + ".", $('[name="idade"]', rows[index]));
    if (!Number.isInteger(ticket.poltrona) || ticket.poltrona < 1 || ticket.poltrona > event.capacidade) return issue("A poltrona deve estar entre 1 e " + event.capacidade + ".", $('[name="poltrona"]', rows[index]));
    if (seats.has(ticket.poltrona)) return issue("Há duas pessoas com a mesma poltrona. Escolha lugares diferentes.", $('[name="poltrona"]', rows[index]));
    if (confirmedSeats.get(event.id)?.has(ticket.poltrona)) return issue("A poltrona " + ticket.poltrona + " já foi confirmada nesta sessão. Escolha outro lugar.", $('[name="poltrona"]', rows[index]));
    seats.add(ticket.poltrona);
  }
  return null;
}

function isReceipt(receipt, event, tickets) {
  return receipt && Number.isInteger(receipt.reservaId) && receipt.reservaId > 0 && receipt.eventoId === event.id && Array.isArray(receipt.ingressos) && receipt.ingressos.length === tickets.length && Number.isFinite(receipt.total) && receipt.total > 0 && receipt.ingressos.every((ticket, index) => ticket && ticket.nome === tickets[index].nome && ticket.poltrona === tickets[index].poltrona && (ticket.tipo === "inteira" || ticket.tipo === "meia") && Number.isFinite(ticket.valor) && ticket.valor > 0);
}

function showReceipt(receipt, event) {
  const dialog = $("#receipt-dialog");
  const info = $("#receipt-info");
  info.replaceChildren();
  const fields = [["RESERVA", "#" + receipt.reservaId], ["EVENTO", event?.nome || String(receipt.eventoId)], ["INGRESSOS", String(receipt.ingressos.length)], ["SITUAÇÃO", "CONFIRMADA · SIMULAÇÃO"]];
  fields.forEach(([label, value]) => {
    const el = node("div");
    el.append(node("small", "", label), node("strong", "", value));
    info.append(el);
  });
  const items = $("#receipt-items");
  items.replaceChildren();
  receipt.ingressos.forEach((ticket) => {
    const row = node("div", "receipt-item");
    const left = node("span");
    left.append(document.createTextNode(ticket.nome + " — Poltrona " + ticket.poltrona + " "), node("small", "", "(" + (ticket.tipo === "meia" ? "meia" : "inteira") + ")"));
    row.append(left, node("strong", "", money(ticket.valor)));
    items.append(row);
  });
  $("#receipt-total").textContent = money(receipt.total);
  dialog.showModal();
}

async function submitReservation(event) {
  event.preventDefault();
  if (state.processing || state.uncertain || state.loading) return;
  const selected = selectedEvent();
  const tickets = currentTickets();
  const invalid = validateTickets(selected, tickets);
  if (invalid) { formMessage(invalid.message, "error", invalid.element); return; }
  formMessage();
  state.processing = true;
  updateControls();
  const submit = $("#submit-reservation");
  submit.replaceChildren(node("span", "spinner"), document.createTextNode(" Processando reserva..."));
  try {
    const receipt = await api("/reservas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ eventoId: selected.id, ingressos: tickets })
    });
    if (!isReceipt(receipt, selected, tickets)) {
      const error = new Error("O servidor não enviou um comprovante válido.");
      error.uncertain = true;
      throw error;
    }
    const seats = confirmedSeats.get(selected.id) || new Set();
    tickets.forEach((ticket) => seats.add(ticket.poltrona));
    confirmedSeats.set(selected.id, seats);
    showReceipt(receipt, selected);
    await loadEvents(false); // Preserva o comprovante POST na última resposta, como na correção do Marcus.
    resetTickets(selected);
    formMessage("Reserva confirmada. O formulário está pronto para uma nova reserva.", "success");
  } catch (error) {
    if (error.uncertain || (error.status && ![400, 404, 409, 502].includes(error.status))) {
      state.uncertain = true;
      const attemptedSeats = uncertainSeats.get(selected.id) || new Set();
      tickets.forEach((ticket) => attemptedSeats.add(ticket.poltrona));
      uncertainSeats.set(selected.id, attemptedSeats);
      formMessage("Não foi possível confirmar o resultado da reserva. Ela pode ter sido registrada. Não envie o mesmo pedido novamente: esta demonstração não oferece consulta de reservas. Os dados foram mantidos para conferência.", "warning");
    } else if (error.status === 409) {
      formMessage("Uma das poltronas já foi reservada. Escolha outros números e tente novamente.");
    } else if (error.status === 502) {
      formMessage("O pagamento de demonstração não foi aprovado. As poltronas foram liberadas; você pode tentar novamente.");
    } else if (error.status === 404) {
      formMessage("Evento não encontrado. Atualize os eventos e tente novamente.");
    } else {
      formMessage(error.message || "Não foi possível concluir a reserva.");
    }
    await loadEvents(false);
  } finally {
    state.processing = false;
    submit.textContent = "Confirmar reserva";
    updateControls();
  }
}

$("#search-events").addEventListener("input", (event) => { state.search = event.target.value; renderEvents(); });
$$("[data-filter]").forEach((button) => button.addEventListener("click", () => {
  state.filter = button.dataset.filter;
  $$("[data-filter]").forEach((item) => {
    const active = item === button;
    item.classList.toggle("active", active);
    item.setAttribute("aria-pressed", String(active));
  });
  renderEvents();
}));
$("#refresh-events").addEventListener("click", () => loadEvents(true));
$("#featured-tour").addEventListener("click", () => showEventDetails(1));
$("#close-event").addEventListener("click", () => $("#event-dialog").close());
$("#event-reserve").addEventListener("click", () => chooseEvent(detailedEventId));
$("#event-select").addEventListener("change", () => {
  if (!state.uncertain) formMessage();
  renderSelectedEvent();
  updateControls();
});
$("#add-ticket").addEventListener("click", addTicket);
$("#reservation-form").addEventListener("submit", submitReservation);
$("#close-receipt").addEventListener("click", () => {
  $("#receipt-dialog").close();
  $("#events-heading").focus();
  $("#eventos").scrollIntoView({ behavior: "smooth" });
});
$("#reset-reservation").addEventListener("click", () => {
  state.uncertain = false;
  resetTickets();
  formMessage("Novo pedido iniciado. A reserva anterior continua com resultado desconhecido; escolha outras poltronas.", "warning");
  updateControls();
  $('.ticket-card [name="nome"]').focus();
});
$("#print-receipt").addEventListener("click", () => { if ($("#receipt-dialog").open) window.print(); });
$("#copy-response").addEventListener("click", async () => {
  if (!state.lastResponse) { toast("Ainda não há nenhuma resposta para copiar."); return; }
  try { await navigator.clipboard.writeText(JSON.stringify(state.lastResponse, null, 2)); toast("Resposta copiada para a área de transferência.", "success"); }
  catch { toast("Não foi possível copiar automaticamente. Selecione o JSON para copiar."); }
});
$("#mobile-toggle").addEventListener("click", () => {
  const menu = $("#mobile-menu");
  menu.hidden = !menu.hidden;
  $("#mobile-toggle").setAttribute("aria-expanded", String(!menu.hidden));
  $("#mobile-toggle").setAttribute("aria-label", menu.hidden ? "Abrir menu" : "Fechar menu");
});
$$("#mobile-menu a").forEach((a) => a.addEventListener("click", () => {
  $("#mobile-menu").hidden = true;
  $("#mobile-toggle").setAttribute("aria-expanded", "false");
  $("#mobile-toggle").setAttribute("aria-label", "Abrir menu");
}));
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !$("#mobile-menu").hidden) {
    $("#mobile-menu").hidden = true;
    $("#mobile-toggle").setAttribute("aria-expanded", "false");
    $("#mobile-toggle").setAttribute("aria-label", "Abrir menu");
    $("#mobile-toggle").focus();
  }
});
addTicket();
loadEvents();
