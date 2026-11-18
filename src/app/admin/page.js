
"use client";

import { useEffect, useState } from "react";
import {
  CalendarDays,
  Clock,
  Wallet,
  LockKeyhole,
  LogOut,
} from "lucide-react";
import { supabase } from "@/lib/supabase";

const ZONE = "America/Sao_Paulo";

const inputStyle =
  "w-full rounded-xl border border-[#EAD1BD] bg-white p-3 text-[#3E2118]";

const buttonStyle =
  "rounded-xl bg-[#673016] px-4 py-3 font-semibold text-white transition hover:bg-[#A97765] disabled:opacity-50";

function localDateTime(date, time) {
  return new Date(`${date}T${time}:00-03:00`).toISOString();
}

function nextDate(date) {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

function formatDate(value) {
  return new Date(value).toLocaleDateString("pt-BR", {
    timeZone: ZONE,
  });
}

function formatTime(value) {
  return new Date(value).toLocaleTimeString("pt-BR", {
    timeZone: ZONE,
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatPrice(price) {
  if (price == null) return "Não informado";

  return Number(price).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function whatsappNumber(phone) {
  const digits = String(phone || "").replace(/\D/g, "");
  return digits.startsWith("55") ? digits : `55${digits}`;
}

export default function AdminPage() {
  const [session, setSession] = useState(null);
  const [checking, setChecking] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const [activeTab, setActiveTab] = useState("agenda");

  const [appointments, setAppointments] = useState([]);
  const [agendaLimpa, setAgendaLimpa] = useState(false);
  const [loadingAgenda, setLoadingAgenda] = useState(false);
  const [agendaError, setAgendaError] = useState("");

  const [blocks, setBlocks] = useState([]);
  const [loadingBlocks, setLoadingBlocks] = useState(false);
  const [blockError, setBlockError] = useState("");
  const [blockMessage, setBlockMessage] = useState("");
  const [savingBlock, setSavingBlock] = useState(false);

  const [blockDate, setBlockDate] = useState("");
  const [blockType, setBlockType] = useState("hours");
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("18:00");
  const [reason, setReason] = useState("");

  useEffect(() => {
    let active = true;

    supabase.auth.getSession().then(({ data }) => {
      if (active) {
        setSession(data.session);
        setChecking(false);
      }
    });

    const { data: listener } =
      supabase.auth.onAuthStateChange((_event, nextSession) => {
        setSession(nextSession);
      });

    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    let active = true;

    if (!session) {
      setIsAdmin(false);
      setAppointments([]);
      setBlocks([]);
      return;
    }

    setChecking(true);

    supabase.rpc("is_studio_admin").then(
      ({ data, error: adminError }) => {
        if (!active) return;

        setIsAdmin(!adminError && data === true);
        setChecking(false);
      }
    );

    return () => {
      active = false;
    };
  }, [session?.user?.id]);

  useEffect(() => {
    if (session && isAdmin) {
      carregarAgendamentos();
      carregarBloqueios();
    }
  }, [session?.user?.id, isAdmin]);

  async function handleLogin(event) {
    event.preventDefault();
    setError("");
    setLoading(true);

    const { error: loginError } =
      await supabase.auth.signInWithPassword({
        email,
        password,
      });

    if (loginError) {
      setError(
        "Não foi possível entrar. Confira e-mail e senha."
      );
    }

    setLoading(false);
  }

  async function handleLogout() {
    await supabase.auth.signOut();
  }

  async function carregarAgendamentos() {
    setLoadingAgenda(true);
    setAgendaError("");

    const { data, error: queryError } = await supabase
      .from("appointments")
      .select(`
        id,
        client_name,
        client_phone,
        starts_at,
        ends_at,
        status,
        services (
          name,
          price
        )
      `)
      .order("starts_at", { ascending: true });

    if (queryError) {
      console.error(queryError);
      setAgendaError(
        "Não foi possível carregar os agendamentos."
      );
    } else {
      setAppointments(data ?? []);
    }

    setLoadingAgenda(false);
  }

  async function gerarLinkRemarcacao(appointment) {
    const { data: token, error: rpcError } =
      await supabase.rpc("generate_reschedule_token", {
        p_appointment_id: appointment.id,
      });

    if (rpcError || !token) {
      alert("Não foi possível gerar o link de remarcação.");
      return;
    }

    const link =
      `https://studio-yas.pages.dev/remarcar?token=${encodeURIComponent(token)}`;

    const nome = appointment.client_name.split(" ")[0];

    const mensagem = `Olá, ${nome}! 💕

Precisamos ajustar o horário do seu atendimento no Studio Yas.

Para sua comodidade, preparamos um link exclusivo para você escolher uma nova data e horário:

${link}

Seu horário atual permanece reservado até você confirmar a alteração.

O link é válido por 48 horas.

Studio Yas — A beleza mora nos detalhes. ✨`;

    const numero = whatsappNumber(appointment.client_phone);

    window.location.href =
      `https://wa.me/${numero}?text=${encodeURIComponent(mensagem)}`;
  }

  async function cancelarAgendamento(appointment) {
    if (appointment.status !== "confirmed") return;

    const confirmar = window.confirm(
      `Deseja cancelar o agendamento de ${appointment.client_name}?`
    );

    if (!confirmar) return;

    const { data, error: rpcError } = await supabase.rpc(
      "cancel_studio_appointment",
      {
        p_appointment_id: appointment.id,
      }
    );

    if (rpcError) {
      alert("Erro ao cancelar: " + rpcError.message);
      return;
    }

    if (data !== true) {
      alert(
        "Esse agendamento já foi alterado ou cancelado."
      );
      await carregarAgendamentos();
      return;
    }

    await carregarAgendamentos();

    const mensagem = `Olá, ${appointment.client_name}! 💗

Aqui é do Studio Yas.

Seu agendamento precisou ser cancelado.

Pedimos desculpas pelo inconveniente!

Você pode escolher uma nova data e horário pelo nosso site:

https://studio-yas.pages.dev/agendar

✨ A beleza mora nos detalhes.`;

    const numero = whatsappNumber(appointment.client_phone);

    const abrirWhatsApp = window.confirm(
      "Agendamento cancelado com sucesso!\n\nDeseja abrir o WhatsApp para avisar a cliente?"
    );

    if (abrirWhatsApp) {
      window.location.href =
        `https://wa.me/${numero}?text=${encodeURIComponent(mensagem)}`;
    }
  }

  async function carregarBloqueios() {
    setLoadingBlocks(true);
    setBlockError("");

    const { data, error: queryError } = await supabase
      .from("blocked_times")
      .select("id, starts_at, ends_at, reason")
      .order("starts_at", { ascending: true });

    if (queryError) {
      console.error(queryError);
      setBlockError(
        "Não foi possível carregar os bloqueios."
      );
    } else {
      setBlocks(data ?? []);
    }

    setLoadingBlocks(false);
  }

  async function criarBloqueio(event) {
    event.preventDefault();
    setBlockError("");
    setBlockMessage("");

    if (!blockDate) {
      setBlockError("Escolha uma data.");
      return;
    }

    if (
      blockType === "hours" &&
      (!startTime || !endTime || endTime <= startTime)
    ) {
      setBlockError(
        "O horário final deve ser posterior ao inicial."
      );
      return;
    }

    setSavingBlock(true);

    try {
      const starts_at = localDateTime(
        blockDate,
        blockType === "day" ? "00:00" : startTime
      );

      const ends_at =
        blockType === "day"
          ? localDateTime(nextDate(blockDate), "00:00")
          : localDateTime(blockDate, endTime);

      const { error: insertError } = await supabase
        .from("blocked_times")
        .insert({
          starts_at,
          ends_at,
          reason: reason.trim() || null,
        });

      if (insertError) {
        setBlockError(
          insertError.code === "23P01"
            ? "Esse período já possui um bloqueio."
            : `Não foi possível salvar: ${insertError.message}`
        );
      } else {
        setBlockMessage("Bloqueio salvo com sucesso!");
        setReason("");
        await carregarBloqueios();
      }
    } catch {
      setBlockError("Data ou horário inválido.");
    } finally {
      setSavingBlock(false);
    }
  }

  async function removerBloqueio(block) {
    const confirmar = window.confirm(
      `Remover bloqueio de ${formatDate(block.starts_at)} às ${formatTime(block.starts_at)}?`
    );

    if (!confirmar) return;

    setBlockError("");
    setBlockMessage("");

    const { error: deleteError } = await supabase
      .from("blocked_times")
      .delete()
      .eq("id", block.id);

    if (deleteError) {
      setBlockError(
        "Não foi possível remover o bloqueio."
      );
    } else {
      setBlockMessage("Bloqueio removido.");
      await carregarBloqueios();
    }
  }

  const agora = Date.now();

  const agendamentosVisiveis = agendaLimpa
    ? appointments.filter(
        (appointment) =>
          appointment.status !== "cancelled" &&
          new Date(appointment.ends_at).getTime() >= agora
      )
    : appointments;

  const ocultados =
    appointments.length - agendamentosVisiveis.length;

  const tabs = [
    { id: "agenda", label: "Agenda", icon: CalendarDays },
    { id: "bloqueios", label: "Bloqueios", icon: Clock },
    { id: "financeiro", label: "Financeiro", icon: Wallet },
  ];

  if (checking) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#F4E5DC]">
        <p className="text-[#673016]">Carregando...</p>
      </main>
    );
  }

  if (!session) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#F4E5DC] px-4">
        <form
          onSubmit={handleLogin}
          className="w-full max-w-md rounded-3xl bg-white p-8 shadow-lg"
        >
          <div className="mb-8 text-center">
            <LockKeyhole
              size={30}
              className="mx-auto mb-4 text-[#673016]"
            />

            <h1 className="font-serif text-4xl text-[#673016]">
              Studio Yas
            </h1>

            <p className="mt-2 text-[#A97765]">
              Acesso administrativo
            </p>
          </div>

          <input
            type="email"
            placeholder="E-mail"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
            className={`${inputStyle} mb-4`}
          />

          <input
            type="password"
            placeholder="Senha"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
            className={`${inputStyle} mb-4`}
          />

          {error && (
            <p className="mb-4 text-sm text-red-600">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className={`${buttonStyle} w-full`}
          >
            {loading ? "Entrando..." : "Entrar"}
          </button>
        </form>
      </main>
    );
  }

  if (!isAdmin) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[#F4E5DC] px-4 text-center">
        <h1 className="font-serif text-3xl text-[#673016]">
          Acesso não autorizado
        </h1>

        <p className="text-[#3E2118]">
          Esta conta não tem permissão para administrar
          o Studio Yas.
        </p>

        <button
          onClick={handleLogout}
          className={buttonStyle}
        >
          Sair
        </button>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#F4E5DC] px-4 py-10">
      <div className="mx-auto max-w-5xl">
        <header className="mb-8 flex items-center justify-between gap-3">
          <div>
            <h1 className="font-serif text-4xl text-[#673016]">
              Studio Yas
            </h1>

            <p className="mt-2 text-[#A97765]">
              Painel Administrativo
            </p>
          </div>

          <button
            onClick={handleLogout}
            className="flex items-center gap-2 rounded-xl border border-[#673016] px-4 py-2 text-[#673016]"
          >
            <LogOut size={18} />
            Sair
          </button>
        </header>

        <div className="rounded-3xl bg-white p-6 shadow-lg">
          <div className="mb-8 flex flex-wrap gap-3">
            {tabs.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setActiveTab(id)}
                className={`flex items-center gap-2 rounded-xl px-5 py-3 ${
                  activeTab === id
                    ? "bg-[#673016] text-white"
                    : "bg-[#F4E5DC] text-[#673016]"
                }`}
              >
                <Icon size={18} />
                {label}
              </button>
            ))}
          </div>

          {activeTab === "agenda" && (
            <section>
              <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-2xl font-semibold text-[#3E2118]">
                  Agenda de clientes
                </h2>

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      setAgendaLimpa((previous) => !previous)
                    }
                    className="rounded-xl border border-[#673016] px-4 py-3 font-semibold text-[#673016] hover:bg-[#F4E5DC]"
                  >
                    {agendaLimpa
                      ? "Mostrar histórico"
                      : "Limpar agenda"}
                  </button>

                  <button
                    type="button"
                    onClick={carregarAgendamentos}
                    disabled={loadingAgenda}
                    className={buttonStyle}
                  >
                    Atualizar
                  </button>
                </div>
              </div>

              {agendaLimpa && (
                <p className="mb-5 text-sm text-[#A97765]">
                  Agenda limpa: {ocultados} registro(s)
                  ocultado(s). Nenhum agendamento foi apagado.
                </p>
              )}

              {loadingAgenda && (
                <p className="mb-4 text-[#A97765]">
                  Carregando agenda...
                </p>
              )}

              {agendaError && (
                <p className="mb-4 text-red-600">
                  {agendaError}
                </p>
              )}

              {!loadingAgenda &&
                !agendaError &&
                agendamentosVisiveis.length === 0 && (
                  <p className="text-[#A97765]">
                    {agendaLimpa
                      ? "Nenhum agendamento ativo para exibir."
                      : "Nenhum agendamento encontrado."}
                  </p>
                )}

              <div className="space-y-4">
                {agendamentosVisiveis.map((appointment) => (
                  <div
                    key={appointment.id}
                    className="rounded-2xl border border-[#EAD1BD] bg-[#F4E5DC] p-5"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h3 className="text-lg font-semibold text-[#673016]">
                        {appointment.client_name}
                      </h3>

                      <span className="rounded-full bg-white px-3 py-1 text-sm text-[#673016]">
                        {appointment.status}
                      </span>
                    </div>

                    <p className="mt-3 text-[#3E2118]">
                      Serviço:{" "}
                      {appointment.services?.name ??
                        "Não informado"}
                    </p>

                    <p className="mt-1 text-[#3E2118]">
                      WhatsApp: {appointment.client_phone}
                    </p>

                    <p className="mt-1 text-[#3E2118]">
                      Data: {formatDate(appointment.starts_at)}
                    </p>

                    <p className="mt-1 text-[#3E2118]">
                      Horário: {formatTime(appointment.starts_at)}
                    </p>

                    <p className="mt-2 font-semibold text-[#673016]">
                      Valor:{" "}
                      {formatPrice(appointment.services?.price)}
                    </p>

                    {appointment.status === "confirmed" && (
                      <div className="mt-4 flex flex-wrap gap-3">
                        <button
                          type="button"
                          onClick={() =>
                            cancelarAgendamento(appointment)
                          }
                          className="rounded-xl border border-red-300 px-4 py-2 text-red-700 hover:bg-red-50"
                        >
                          Cancelar agendamento
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            gerarLinkRemarcacao(appointment)
                          }
                          className="rounded-xl bg-[#673016] px-4 py-2 text-white hover:bg-[#A97765]"
                        >
                          Solicitar remarcação
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}

          {activeTab === "bloqueios" && (
            <section>
              <h2 className="mb-2 text-2xl font-semibold text-[#3E2118]">
                Bloqueio de horários
              </h2>

              <p className="mb-6 text-[#A97765]">
                Selecione um dia inteiro ou um intervalo
                para deixar indisponível.
              </p>

              <form
                onSubmit={criarBloqueio}
                className="space-y-4 rounded-2xl bg-[#F4E5DC] p-5"
              >
                <div>
                  <label
                    htmlFor="block-date"
                    className="mb-1 block font-medium text-[#3E2118]"
                  >
                    Data
                  </label>

                  <input
                    id="block-date"
                    type="date"
                    required
                    value={blockDate}
                    onChange={(event) =>
                      setBlockDate(event.target.value)
                    }
                    className={inputStyle}
                  />
                </div>

                <div>
                  <label
                    htmlFor="block-type"
                    className="mb-1 block font-medium text-[#3E2118]"
                  >
                    Tipo de bloqueio
                  </label>

                  <select
                    id="block-type"
                    value={blockType}
                    onChange={(event) =>
                      setBlockType(event.target.value)
                    }
                    className={inputStyle}
                  >
                    <option value="hours">
                      Intervalo de horas
                    </option>
                    <option value="day">
                      Dia inteiro
                    </option>
                  </select>
                </div>

                {blockType === "hours" && (
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <label
                        htmlFor="block-start"
                        className="mb-1 block font-medium text-[#3E2118]"
                      >
                        Início
                      </label>

                      <input
                        id="block-start"
                        type="time"
                        required
                        value={startTime}
                        onChange={(event) =>
                          setStartTime(event.target.value)
                        }
                        className={inputStyle}
                      />
                    </div>

                    <div>
                      <label
                        htmlFor="block-end"
                        className="mb-1 block font-medium text-[#3E2118]"
                      >
                        Fim
                      </label>

                      <input
                        id="block-end"
                        type="time"
                        required
                        value={endTime}
                        onChange={(event) =>
                          setEndTime(event.target.value)
                        }
                        className={inputStyle}
                      />
                    </div>
                  </div>
                )}

                <div>
                  <label
                    htmlFor="block-reason"
                    className="mb-1 block font-medium text-[#3E2118]"
                  >
                    Motivo (opcional)
                  </label>

                  <input
                    id="block-reason"
                    value={reason}
                    onChange={(event) =>
                      setReason(event.target.value)
                    }
                    placeholder="Ex.: folga, compromisso, férias"
                    className={inputStyle}
                  />
                </div>

                <button
                  type="submit"
                  disabled={savingBlock}
                  className={buttonStyle}
                >
                  {savingBlock
                    ? "Salvando..."
                    : "Bloquear período"}
                </button>
              </form>

              {blockError && (
                <p role="alert" className="mt-4 text-red-600">
                  {blockError}
                </p>
              )}

              {blockMessage && (
                <p
                  role="status"
                  className="mt-4 text-[#673016]"
                >
                  {blockMessage}
                </p>
              )}

              <div className="mb-4 mt-8 flex flex-wrap items-center justify-between gap-3">
                <h3 className="text-xl font-semibold text-[#3E2118]">
                  Bloqueios cadastrados
                </h3>

                <button
                  type="button"
                  onClick={carregarBloqueios}
                  disabled={loadingBlocks}
                  className="rounded-xl border border-[#673016] px-4 py-2 text-[#673016] disabled:opacity-50"
                >
                  Atualizar
                </button>
              </div>

              {loadingBlocks && (
                <p className="text-[#A97765]">
                  Carregando bloqueios...
                </p>
              )}

              {!loadingBlocks &&
                !blockError &&
                blocks.length === 0 && (
                  <p className="text-[#A97765]">
                    Nenhum bloqueio cadastrado.
                  </p>
                )}

              <div className="space-y-3">
                {blocks.map((block) => (
                  <div
                    key={block.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#EAD1BD] p-4"
                  >
                    <div>
                      <p className="font-semibold text-[#673016]">
                        {formatDate(block.starts_at)}
                        {" — "}
                        {formatTime(block.starts_at)}
                        {" até "}
                        {formatDate(block.ends_at)}
                        {" às "}
                        {formatTime(block.ends_at)}
                      </p>

                      {block.reason && (
                        <p className="mt-1 text-sm text-[#A97765]">
                          {block.reason}
                        </p>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => removerBloqueio(block)}
                      className="rounded-xl border border-red-300 px-4 py-2 text-red-700 hover:bg-red-50"
                    >
                      Desbloquear
                    </button>
                  </div>
                ))}
              </div>

              <p className="mt-6 text-sm text-[#A97765]">
                Atenção: criar um bloqueio não cancela
                agendamentos já confirmados nesse período.
              </p>
            </section>
          )}

          {activeTab === "financeiro" && (
            <section>
              <h2 className="text-2xl font-semibold text-[#3E2118]">
                Financeiro
              </h2>

              <p className="mt-3 text-[#A97765]">
                Em breve: faturamento diário e mensal.
              </p>
            </section>
          )}
        </div>
      </div>
    </main>
  );
}
