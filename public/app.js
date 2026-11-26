const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));
const state = { events: [], lastResponse: null };

const money = (value) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
const setConnection = (online, message) => {
  $("#sidebar-dot").classList.toggle("offline", !online);
  $("#sidebar-status-text").textContent = online ? "API conectada" : "API indisponível";
  $("#hero-status").textContent = message;
};
const showResponse = (status, duration, data, isError = false) => {
  state.lastResponse = data;
  $("#response-status").textContent = status === null ? "—" : String(status);
  $("#response-time").textContent = duration === null ? "—" : duration + " ms";
  $("#response-state").textContent = status === null ? "SEM RESPOSTA" : (isError ? "ERRO" : "CONCLUÍDO");
  $("#response-state").className = "response-live " + (status === null ? "" : (isError ? "error" : "success"));
  $("#response-body").textContent = data === null ? "// Nenhuma resposta recebida." : JSON.stringify(data, null, 2);
};
const request = async (path, options = {}, displayResponse = true) => {
  const started = performance.now();
  try {
    const response = await fetch(path, options);
    const text = await response.text();
    let data;
    try { data = text ? JSON.parse(text) : null; } catch { data = text; }
    const duration = Math.round(performance.now() - started);
    if (displayResponse) showResponse(response.status, duration, data, !response.ok);
    if (!response.ok) throw new Error(data && data.mensagem ? data.mensagem : "A requisição retornou HTTP " + response.status);
    return data;
  } catch (error) {
    if (error instanceof TypeError) {
      setConnection(false, "Não foi possível conectar ao servidor.");
      if (displayResponse) showResponse(null, Math.round(performance.now() - started), { erro: "Não foi possível conectar à API. Verifique se o servidor está ativo em localhost:3000." }, true);
    }
    throw error;
  }
};

const addTicket = () => {
  const row = $("#ticket-template").content.firstElementChild.cloneNode(true);
  $("#ticket-list").appendChild(row);
  updateTicketIndexes();
  row.querySelector(".remove-ticket").addEventListener("click", () => {
    if ($$(".ticket-row").length > 1) {
      row.remove();
      updateTicketIndexes();
    }
  });
};
const updateTicketIndexes = () => {
  $$(".ticket-row").forEach((row, index) => {
    row.querySelector(".ticket-index").textContent = "INGRESSO " + String(index + 1).padStart(2, "0");
    const seat = row.querySelector('[name="poltrona"]');
    if (index > 0 && Number(seat.value) === 1) seat.value = String(index + 1);
    seat.max = String(selectedEvent()?.capacidade || 999);
  });
};
const selectedEvent = () => state.events.find((event) => event.id === Number($("#event-select").value));
const renderEvents = () => {
  $("#stat-events").textContent = String(state.events.length).padStart(2, "0");
  const grid = $("#events-grid");
  grid.replaceChildren();
  if (!state.events.length) {
    const empty = document.createElement("div");
    empty.className = "loading-card";
    empty.textContent = "Nenhum evento foi retornado pela API.";
    grid.appendChild(empty);
  }
  state.events.forEach((event) => {
    const sold = Math.max(0, event.capacidade - event.disponivel);
    const percent = event.capacidade ? Math.min(100, Math.max(0, sold / event.capacidade * 100)) : 0;
    const card = document.createElement("article");
    card.className = "event-card";
    const top = document.createElement("div");
    top.className = "event-card-top";
    const tag = document.createElement("span");
    tag.className = "event-tag";
    tag.textContent = "EVENTO DISPONÍVEL";
    const number = document.createElement("span");
    number.className = "event-index";
    number.textContent = "#" + String(event.id).padStart(3, "0");
    top.append(tag, number);
    const title = document.createElement("h3");
    title.textContent = event.nome;
    const price = document.createElement("div");
    price.className = "event-price";
    price.textContent = money(event.preco);
    const each = document.createElement("small");
    each.textContent = " / ingresso";
    price.appendChild(each);
    const stats = document.createElement("div");
    stats.className = "event-stats";
    const soldLabel = document.createElement("span");
    soldLabel.textContent = "Ocupação";
    const soldValue = document.createElement("strong");
    soldValue.textContent = sold + " / " + event.capacidade;
    stats.append(soldLabel, soldValue);
    const track = document.createElement("div");
    track.className = "progress-track";
    const fill = document.createElement("div");
    fill.className = "progress-fill";
    fill.style.width = percent + "%";
    track.appendChild(fill);
    const bottom = document.createElement("div");
    bottom.className = "event-card-bottom";
    const availability = document.createElement("span");
    availability.className = "availability-label";
    availability.append("Disponíveis: ");
    const availableValue = document.createElement("strong");
    availableValue.textContent = String(event.disponivel);
    availability.appendChild(availableValue);
    const action = document.createElement("a");
    action.className = "event-action";
    action.href = "#playground";
    action.textContent = "Reservar ingresso ↗";
    action.addEventListener("click", () => { $("#event-select").value = String(event.id); });
    bottom.append(availability, action);
    card.append(top, title, price, stats, track, bottom);
    grid.appendChild(card);
  });

  const select = $("#event-select");
  const previous = select.value;
  select.replaceChildren();
  if (!state.events.length) {
    const option = document.createElement("option");
    option.value = "";
    option.textContent = "Nenhum evento disponível";
    select.appendChild(option);
  }
  state.events.forEach((event) => {
    const option = document.createElement("option");
    option.value = String(event.id);
    option.textContent = event.nome + " · " + money(event.preco) + " · " + event.disponivel + " disponíveis";
    select.appendChild(option);
  });
  if (state.events.some((event) => String(event.id) === previous)) select.value = previous;
  updateTicketIndexes();
};
const loadEvents = async (displayResponse = true) => {
  $("#refresh-events").disabled = true;
  try {
    const data = await request("/eventos", {}, displayResponse);
    if (!Array.isArray(data)) throw new Error("Formato inesperado na resposta de /eventos");
    state.events = data;
    renderEvents();
    setConnection(true, "Servidor conectado e respondendo.");
  } catch {
    setConnection(false, "API offline ou inacessível.");
  } finally {
    $("#refresh-events").disabled = false;
  }
};

$("#add-ticket").addEventListener("click", addTicket);
$("#refresh-events").addEventListener("click", loadEvents);
$$('[data-action="get-events"]').forEach((button) => {
  button.addEventListener("click", () => {
    document.querySelector("#playground").scrollIntoView({ behavior: "smooth" });
    loadEvents();
  });
});
$("#event-select").addEventListener("change", updateTicketIndexes);

$("#reservation-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const selected = selectedEvent();
  if (!selected) {
    window.alert("Selecione um evento antes de enviar a reserva.");
    return;
  }
  const tickets = $$(".ticket-row").map((row) => ({
    nome: row.querySelector('[name="nome"]').value.trim(),
    idade: Number(row.querySelector('[name="idade"]').value),
    estudante: row.querySelector('[name="estudante"]').checked,
    pcd: row.querySelector('[name="pcd"]').checked,
    poltrona: Number(row.querySelector('[name="poltrona"]').value)
  }));
  if (tickets.some((ticket) => !ticket.nome || !Number.isInteger(ticket.idade) || !Number.isInteger(ticket.poltrona))) {
    window.alert("Confira nome, idade e poltrona de cada ingresso.");
    return;
  }
  const button = $(".submit-button");
  button.disabled = true;
  button.innerHTML = "<span class='loader'></span> Enviando requisição...";
  try {
    await request("/reservas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ eventoId: selected.id, ingressos: tickets })
    });
    await loadEvents(false);
  } catch {
    // O painel de resposta contém o status HTTP e a mensagem devolvida pelo servidor.
  } finally {
    button.disabled = false;
    button.innerHTML = "<span>⚡</span> Enviar requisição <span class='button-arrow'>→</span>";
  }
});

$("#copy-response").addEventListener("click", async () => {
  if (state.lastResponse === null) return;
  const value = JSON.stringify(state.lastResponse, null, 2);
  try {
    await navigator.clipboard.writeText(value);
    $("#copy-response").textContent = "Copiado ✓";
    window.setTimeout(() => { $("#copy-response").innerHTML = "Copiar <span>⧉</span>"; }, 1500);
  } catch {
    window.alert("Não foi possível copiar automaticamente. Selecione e copie a resposta.");
  }
});

addTicket();
loadEvents();
