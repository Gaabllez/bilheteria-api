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
const catalog = {
  1: { category: "show", tag: "SHOW AO VIVO", genre: "MÚSICA & ENERGIA", description: "A energia de um show inesquecível. Encontre seu lugar e deixe a música fazer o resto.", image: "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?auto=format&fit=crop&w=1000&q=85", alt: "Luzes coloridas iluminando um show ao vivo" },
  2: { category: "teatro", tag: "ARTES CÊNICAS", genre: "CULTURA & EMOÇÃO", description: "Histórias que ganham vida no palco, com emoção e um lugar reservado para você.", image: "https://images.unsplash.com/photo-1507676184212-d03ab07a01bf?auto=format&fit=crop&w=1000&q=85", alt: "Cortinas e luzes de um palco teatral" },
  3: { category: "festival", tag: "EXPERIÊNCIA", genre: "FESTIVAL & CONEXÃO", description: "Música, encontros e momentos especiais em um só lugar. Venha viver tudo isso.", image: "https://images.unsplash.com/photo-1492684223066-81342ee5ff30?auto=format&fit=crop&w=1000&q=85", alt: "Multidão reunida em festival de música" }
};
const fallbackCover = { category: "show", tag: "EVENTO", genre: "EXPERIÊNCIA", description: "Uma nova experiência esperando por você.", image: "https://images.unsplash.com/photo-1459749411175-04bf5292ceea?auto=format&fit=crop&w=1000&q=85", alt: "Pessoas aproveitando apresentação musical" };
const meta = (event) => catalog[event.id] || fallbackCover;

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
  $("#reservation-form").setAttribute("aria-busy", String(blocked));
  $$("#reservation-form input, #reservation-form button, .event-book").forEach((control) => {
    control.disabled = blocked || (control.classList.contains("event-book") && control.dataset.soldOut === "true");
  });
  $("#add-ticket").disabled = blocked || $$(".ticket-card").length >= 12;
  $("#event-select").disabled = blocked || !state.connected;
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
  details.append(node("strong", "", event?.nome || "Selecione um evento"), node("span", "", event ? tickets.length + (tickets.length === 1 ? " ingresso" : " ingressos") + " • " + event.disponivel + " lugares disponíveis" : "Seu resumo aparecerá aqui"));
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
    detail.append(node("strong", "", event.nome), node("span", "", money(event.preco) + " • " + event.disponivel + " de " + event.capacidade + " lugares disponíveis"));
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

function createEventCard(event) {
  const data = meta(event);
  const remaining = Number(event.disponivel);
  const sold = Math.max(0, event.capacidade - remaining);
  const percent = event.capacidade ? Math.min(100, Math.max(0, sold / event.capacidade * 100)) : 0;
  const card = node("article", "event-card");
  const cover = node("div", "event-cover");
  const image = node("img");
  image.src = data.image;
  image.alt = data.alt;
  image.loading = "lazy";
  cover.append(image, node("span", "cover-tag", data.tag), node("span", "cover-badge", "✳  " + data.genre));
  const info = node("div", "event-info");
  const top = node("div", "event-meta");
  top.append(node("span", "", "EVENTO #" + String(event.id).padStart(2, "0")), node("span", "event-meta-dot"), node("span", "", "EXPERIÊNCIA AO VIVO"));
  info.append(top, node("h3", "", event.nome), node("p", "event-desc", data.description));
  const availability = node("div", "availability" + (remaining === 0 ? " sold" : remaining <= 10 ? " low" : ""));
  availability.append(node("span", "availability-dot"), node("span", "", remaining > 0 ? remaining + " lugares disponíveis" : "Ingressos esgotados"));
  info.append(availability);
  const progress = node("div", "event-progress");
  const fill = node("span");
  fill.style.width = percent + "%";
  progress.append(fill);
  info.append(progress);
  const foot = node("div", "event-card-foot");
  const price = node("div", "event-price");
  price.append(node("small", "", "MEIA-ENTRADA"), node("strong", "", money(round(event.preco / 2))), node("small", "price-note", "+ taxa de serviço (10%)"));
  const action = node("button", "event-book", remaining > 0 ? "Escolher ingresso" : "Esgotado");
  action.type = "button";
  action.dataset.soldOut = String(remaining <= 0);
  action.disabled = state.processing || remaining <= 0;
  action.addEventListener("click", () => {
    if (state.processing) return;
    $("#event-select").value = String(event.id);
    renderSelectedEvent();
    updateControls();
    $("#reserva").scrollIntoView({ behavior: "smooth" });
  });
  foot.append(price, action);
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
    const matchesSearch = !search || searchText(event.nome + " " + info.genre + " " + info.description).includes(search);
    return matchesCategory && matchesSearch;
  });
  $("#catalog-counter").textContent = matching.length + (matching.length === 1 ? " evento encontrado" : " eventos encontrados");
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
    const events = await api("/eventos", {}, record);
    if (!Array.isArray(events) || !events.every(isEvent) || new Set(events.map((event) => event.id)).size !== events.length) throw new Error("O servidor retornou um formato de eventos inesperado.");
    state.events = events;
    state.connected = true;
    const select = $("#event-select");
    const previous = select.value;
    select.replaceChildren();
    events.forEach((event) => {
      const option = node("option", "", event.nome + " — " + money(event.preco) + " • " + event.disponivel + " disponíveis");
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