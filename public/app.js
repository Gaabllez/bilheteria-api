"use strict";

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const money = (value) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
const round = (value) => Math.round((value + Number.EPSILON) * 100) / 100;
const state = { events: [], filter: "todos", search: "", lastResponse: null, processing: false };
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
  let response;
  try {
    response = await fetch(path, { ...options, cache: "no-store" });
  } catch (error) {
    if (record) recordResponse(null, performance.now() - started, { mensagem: "Não foi possível conectar ao servidor." });
    setConnection(false, "API indisponível");
    throw new Error("Não foi possível acessar a API. Inicie o servidor usando npm start.");
  }
  const raw = await response.text();
  let data = null;
  try { data = raw ? JSON.parse(raw) : null; } catch { data = { mensagem: raw }; }
  if (record) recordResponse(response.status, performance.now() - started, data);
  if (!response.ok) {
    const error = new Error(data?.mensagem || "Erro HTTP " + response.status);
    error.status = response.status;
    throw error;
  }
  return data;
}

function selectedEvent() {
  return state.events.find((item) => String(item.id) === $("#event-select").value);
}

function currentTickets() {
  return $$(".ticket-card").map((row) => ({
    nome: $('[name="nome"]', row).value.trim(),
    idade: Number($('[name="idade"]', row).value),
    estudante: $('[name="estudante"]', row).checked,
    pcd: $('[name="pcd"]', row).checked,
    poltrona: Number($('[name="poltrona"]', row).value)
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
      left.append(node("span", "", ticket.nome || "Participante " + (index + 1)), node("small", "", "Poltrona " + ticket.poltrona + " • " + (ticketType(ticket) === "meia" ? "Meia-entrada" : "Inteira")));
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

function addTicket() {
  if ($$(".ticket-card").length >= 12) { toast("Você pode adicionar até 12 ingressos por reserva."); return; }
  const row = $("#ticket-template").content.firstElementChild.cloneNode(true);
  $("#ticket-list").append(row);
  if ($$(".ticket-card").length > 1) $('[name="poltrona"]', row).value = String($$(".ticket-card").length);
  row.addEventListener("input", calculateSummary);
  row.addEventListener("change", calculateSummary);
  $(".remove-ticket", row).addEventListener("click", () => {
    if ($$(".ticket-card").length === 1) { toast("A reserva precisa de pelo menos um participante."); return; }
    row.remove();
    renumberTickets();
    calculateSummary();
  });
  renumberTickets();
  renderSelectedEvent();
}

function renumberTickets() {
  $$(".ticket-card").forEach((row, index) => {
    $(".ticket-tag", row).textContent = "INGRESSO " + String(index + 1).padStart(2, "0");
    $(".remove-ticket", row).hidden = $$(".ticket-card").length === 1;
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
  price.append(node("small", "", "A PARTIR DE"), node("strong", "", money(round(event.preco / 2))));
  const action = node("button", "event-book", remaining > 0 ? "Escolher ingresso ↗" : "Esgotado");
  action.type = "button";
  action.disabled = remaining <= 0;
  action.addEventListener("click", () => {
    $("#event-select").value = String(event.id);
    renderSelectedEvent();
    $("#reserva").scrollIntoView({ behavior: "smooth" });
  });
  foot.append(price, action);
  info.append(foot);
  card.append(cover, info);
  return card;
}

function renderEvents() {
  const search = state.search.toLocaleLowerCase("pt-BR").trim();
  const matching = state.events.filter((event) => {
    const info = meta(event);
    const matchesCategory = state.filter === "todos" || info.category === state.filter;
    const matchesSearch = !search || (event.nome + " " + info.genre + " " + info.description).toLocaleLowerCase("pt-BR").includes(search);
    return matchesCategory && matchesSearch;
  });
  $("#catalog-counter").textContent = matching.length + (matching.length === 1 ? " evento encontrado" : " eventos encontrados");
  $("#events-grid").replaceChildren(...(matching.length ? matching.map(createEventCard) : [node("div", "empty-events", state.events.length ? "Nenhum evento corresponde à busca. Experimente outro filtro." : "Nenhum evento disponível. Verifique se a API está ligada.")]));
}

async function loadEvents(record = false) {
  const refresh = $("#refresh-events");
  refresh.disabled = true;
  try {
    const events = await api("/eventos", {}, record);
    if (!Array.isArray(events)) throw new Error("O servidor retornou um formato de eventos inesperado.");
    state.events = events;
    const select = $("#event-select");
    const previous = select.value;
    select.replaceChildren();
    events.forEach((event) => {
      const option = node("option", "", event.nome + " — " + money(event.preco) + " • " + event.disponivel + " disponíveis");
      option.value = String(event.id);
      select.append(option);
    });
    if (events.some((event) => String(event.id) === previous)) select.value = previous;
    else if (events.length) select.value = String(events[0].id);
    else select.append(node("option", "", "Nenhum evento disponível"));
    renderEvents();
    renderSelectedEvent();
    setConnection(true, "API conectada");
    return true;
  } catch (error) {
    setConnection(false, "API indisponível");
    $("#events-grid").replaceChildren(node("div", "empty-events", "Não foi possível carregar os eventos. Execute npm start e clique em Atualizar."));
    $("#catalog-counter").textContent = "Sem conexão";
    return false;
  } finally {
    refresh.disabled = false;
  }
}

function validateTickets(event, tickets) {
  if (!event) return "Escolha um evento antes de continuar.";
  if (!tickets.length) return "Adicione pelo menos um participante.";
  if (event.disponivel < tickets.length) return "Não há lugares disponíveis suficientes para esta reserva.";
  const seats = new Set();
  for (const ticket of tickets) {
    if (!ticket.nome) return "Preencha o nome completo de todos os participantes.";
    if (!Number.isInteger(ticket.idade) || ticket.idade < 0 || ticket.idade > 120) return "Informe uma idade válida (0 a 120 anos).";
    if (!Number.isInteger(ticket.poltrona) || ticket.poltrona < 1 || ticket.poltrona > event.capacidade) return "A poltrona deve estar entre 1 e " + event.capacidade + ".";
    if (seats.has(ticket.poltrona)) return "Há duas pessoas com a mesma poltrona. Escolha lugares diferentes.";
    seats.add(ticket.poltrona);
  }
  return null;
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
  if (state.processing) return;
  const selected = selectedEvent();
  const tickets = currentTickets();
  const invalid = validateTickets(selected, tickets);
  if (invalid) { toast(invalid); return; }
  state.processing = true;
  const submit = $("#submit-reservation");
  const original = submit.textContent;
  submit.disabled = true;
  submit.replaceChildren(node("span", "spinner"), document.createTextNode(" Processando reserva..."));
  try {
    const receipt = await api("/reservas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ eventoId: selected.id, ingressos: tickets })
    });
    if (!receipt || !Array.isArray(receipt.ingressos)) throw new Error("Comprovante inválido recebido da API.");
    showReceipt(receipt, selected);
    await loadEvents(false); // Não sobrescrever o comprovante com a resposta de /eventos.
  } catch (error) {
    if (error.status === 409) toast("Essa poltrona acabou de ser reservada. Tente outro número e envie novamente.");
    else if (error.status === 502) toast("O pagamento de demonstração não foi aprovado. As poltronas foram liberadas; você pode tentar novamente.");
    else if (error.status === 404) toast("Evento não encontrado. Atualize os eventos e tente novamente.");
    else toast(error.message || "Não foi possível concluir a reserva.");
    if (error.status) await loadEvents(false);
  } finally {
    state.processing = false;
    submit.disabled = false;
    submit.textContent = original;
    submit.append(node("span", "", "↗"));
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
$("#event-select").addEventListener("change", renderSelectedEvent);
$("#add-ticket").addEventListener("click", addTicket);
$("#reservation-form").addEventListener("submit", submitReservation);
$("#close-receipt").addEventListener("click", () => $("#receipt-dialog").close());
$("#print-receipt").addEventListener("click", () => window.print());
$("#copy-response").addEventListener("click", async () => {
  if (!state.lastResponse) { toast("Ainda não há nenhuma resposta para copiar."); return; }
  try { await navigator.clipboard.writeText(JSON.stringify(state.lastResponse, null, 2)); toast("Resposta copiada para a área de transferência.", "success"); }
  catch { toast("Não foi possível copiar automaticamente. Selecione o JSON para copiar."); }
});
$("#mobile-toggle").addEventListener("click", () => {
  const menu = $("#mobile-menu");
  menu.hidden = !menu.hidden;
  $("#mobile-toggle").setAttribute("aria-expanded", String(!menu.hidden));
});
$$("#mobile-menu a").forEach((a) => a.addEventListener("click", () => {
  $("#mobile-menu").hidden = true;
  $("#mobile-toggle").setAttribute("aria-expanded", "false");
}));
addTicket();
loadEvents();