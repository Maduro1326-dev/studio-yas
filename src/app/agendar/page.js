
"use client";

import { useEffect, useMemo, useState } from "react";
import { Turnstile } from "@marsidev/react-turnstile";
import { supabase } from "@/lib/supabase";

const turnstileSiteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

function getTodayInBrazil() {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());

  const values = Object.fromEntries(
    parts.map((part) => [part.type, part.value])
  );

  return `${values.year}-${values.month}-${values.day}`;
}

function formatPrice(price) {
  return Number(price).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function formatDate(date) {
  if (!date) return "";
  const [year, month, day] = date.split("-");
  return `${day}/${month}/${year}`;
}

export default function AgendarPage() {
  const [services, setServices] = useState([]);
  const [serviceId, setServiceId] = useState("");
  const [date, setDate] = useState("");
  const [slots, setSlots] = useState([]);
  const [selectedTime, setSelectedTime] = useState("");
  const [clientName, setClientName] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [turnstileToken, setTurnstileToken] = useState("");
  const [turnstileKey, setTurnstileKey] = useState(0);
  const [loading, setLoading] = useState(false);
  const [confirmado, setConfirmado] = useState(null);
  const [error, setError] = useState("");

  const today = getTodayInBrazil();

  const selectedService = useMemo(
    () => services.find((service) => service.id === serviceId),
    [services, serviceId]
  );

  useEffect(() => {
    let cancelled = false;

    async function loadServices() {
      const { data, error: serviceError } = await supabase
        .from("services")
        .select("id, name, price, duration_minutes")
        .eq("active", true)
        .order("name");

      if (cancelled) return;

      if (serviceError) {
        setError(serviceError.message);
      } else {
        setServices(data ?? []);
      }
    }

    loadServices();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!selectedService || !date) {
      setSlots([]);
      setSelectedTime("");
      return;
    }

    let cancelled = false;

    async function loadSlots() {
      setLoading(true);
      setError("");
      setSlots([]);
      setSelectedTime("");

      const { data, error: slotsError } = await supabase.rpc(
        "get_available_slots",
        {
          p_date: date,
          p_duration_minutes: selectedService.duration_minutes,
        }
      );

      if (cancelled) return;

      if (slotsError) {
        setError(slotsError.message);
      } else {
        setSlots(data ?? []);
      }

      setLoading(false);
    }

    loadSlots();

    return () => {
      cancelled = true;
    };
  }, [date, selectedService]);

  function handlePhoneChange(value) {
    setClientPhone(value.replace(/\D/g, "").slice(0, 13));
  }

  const nameValid =
    clientName.trim().length >= 2 &&
    clientName.trim().length <= 100;

  const phoneValid = /^\d{10,13}$/.test(clientPhone);

  const formReady =
    Boolean(selectedService) &&
    Boolean(date) &&
    Boolean(selectedTime) &&
    nameValid &&
    phoneValid &&
    Boolean(turnstileToken);

  async function confirmarAgendamento() {
    if (!formReady || loading) return;

    setLoading(true);
    setError("");

    try {
      const { data, error: bookingError } =
        await supabase.functions.invoke("create-booking", {
          body: {
            service_id: serviceId,
            date,
            time: selectedTime,
            client_name: clientName.trim(),
            client_phone: clientPhone,
            turnstile_token: turnstileToken,
          },
        });

      if (
        bookingError ||
        data?.booking_created !== true ||
        !data?.booking_id
      ) {
        let message =
          data?.message ||
          bookingError?.message ||
          "Não foi possível confirmar.";

        if (bookingError?.context?.json) {
          try {
            const detail = await bookingError.context.json();
            message = detail.message || message;
          } catch {
            // Mantém a mensagem original.
          }
        }

        throw new Error(message);
      }

      setConfirmado({
        nome: clientName.trim(),
        servico: selectedService.name,
        data: date,
        horario: selectedTime,
        valor: selectedService.price,
      });
    } catch (err) {
      setError(
        err.message || "Não foi possível concluir o agendamento."
      );
      setTurnstileToken("");
      setTurnstileKey((previous) => previous + 1);
    } finally {
      setLoading(false);
    }
  }

  function abrirWhatsAppConfirmacao() {
    if (!confirmado) return;

    const mensagem = `Olá! 💕

Meu agendamento no *Studio Yas* foi confirmado! ✨

💅 Serviço: ${confirmado.servico}
📅 Data: ${formatDate(confirmado.data)}
🕒 Horário: ${confirmado.horario}

A beleza mora nos detalhes. 🤎`;

    window.location.href =
      `https://wa.me/?text=${encodeURIComponent(mensagem)}`;
  }

  function novoAgendamento() {
    setConfirmado(null);
    setServiceId("");
    setDate("");
    setSlots([]);
    setSelectedTime("");
    setClientName("");
    setClientPhone("");
    setTurnstileToken("");
    setTurnstileKey((previous) => previous + 1);
    setError("");
  }

  return (
    <main className="min-h-screen bg-[#F4E5DC] px-5 py-12">
      <div className="mx-auto max-w-xl rounded-3xl bg-white p-8 shadow-lg">
        <header className="mb-8 text-center">
          <h1 className="font-serif text-4xl text-[#673016]">
            Studio Yas
          </h1>
          <p className="mt-2 text-[#A97765]">
            A beleza mora nos detalhes
          </p>
        </header>

        {confirmado ? (
          <section className="space-y-5 text-center">
            <h2 className="text-2xl font-semibold text-[#673016]">
              Agendamento confirmado! ✨
            </h2>

            <div className="rounded-xl bg-[#F4E5DC] p-5 text-left">
              <p className="font-semibold text-[#673016]">
                {confirmado.nome}
              </p>
              <p className="mt-2">
                Serviço: {confirmado.servico}
              </p>
              <p>
                Data: {formatDate(confirmado.data)}
              </p>
              <p>
                Horário: {confirmado.horario}
              </p>
              <p className="mt-2 font-semibold text-[#673016]">
                Valor: {formatPrice(confirmado.valor)}
              </p>
            </div>

            <p className="text-sm text-[#A97765]">
              Sua reserva já está salva. Você pode compartilhar
              a confirmação pelo WhatsApp.
            </p>

            <button
              type="button"
              onClick={abrirWhatsAppConfirmacao}
              className="w-full rounded-xl bg-[#673016] px-5 py-4 font-semibold text-white transition hover:bg-[#A97765]"
            >
              Abrir WhatsApp com confirmação
            </button>

            <button
              type="button"
              onClick={novoAgendamento}
              className="w-full rounded-xl border border-[#EAD1BD] px-5 py-3 text-[#673016]"
            >
              Fazer outro agendamento
            </button>
          </section>
        ) : (
          <>
            <h2 className="mb-6 text-2xl font-semibold text-[#3E2118]">
              Agende seu momento
            </h2>

            <label
              htmlFor="service"
              className="mb-2 block font-medium text-[#3E2118]"
            >
              1. Escolha seu serviço
            </label>

            <select
              id="service"
              value={serviceId}
              onChange={(event) => {
                setServiceId(event.target.value);
                setSlots([]);
                setSelectedTime("");
                setTurnstileToken("");
              }}
              className="mb-6 w-full rounded-xl border border-[#EAD1BD] bg-white p-3 text-[#3E2118]"
            >
              <option value="">Selecione um serviço</option>

              {services.map((service) => (
                <option key={service.id} value={service.id}>
                  {service.name} — {formatPrice(service.price)}
                </option>
              ))}
            </select>

            {selectedService && (
              <>
                <label
                  htmlFor="booking-date"
                  className="mb-2 block font-medium text-[#3E2118]"
                >
                  2. Escolha a data
                </label>

                <input
                  id="booking-date"
                  type="date"
                  min={today}
                  value={date}
                  onChange={(event) => {
                    setDate(event.target.value);
                    setSlots([]);
                    setSelectedTime("");
                    setTurnstileToken("");
                  }}
                  className="mb-6 w-full rounded-xl border border-[#EAD1BD] bg-white p-3 text-[#3E2118]"
                />
              </>
            )}

            {selectedService && date && (
              <>
                <p className="mb-3 font-medium text-[#3E2118]">
                  3. Escolha o horário
                </p>

                {loading && (
                  <p className="mb-4 text-[#A97765]">
                    Buscando horários disponíveis...
                  </p>
                )}

                {!loading && !error && slots.length === 0 && (
                  <p className="mb-4 text-[#A97765]">
                    Nenhum horário disponível nesta data.
                  </p>
                )}

                <div className="grid grid-cols-3 gap-3">
                  {slots.map((slot) => (
                    <button
                      key={slot.slot_time}
                      type="button"
                      onClick={() => {
                        setSelectedTime(slot.slot_time);
                        setTurnstileToken("");
                      }}
                      className={`rounded-xl border p-3 transition ${
                        selectedTime === slot.slot_time
                          ? "border-[#673016] bg-[#673016] text-white"
                          : "border-[#EAD1BD] text-[#3E2118] hover:bg-[#F4E5DC]"
                      }`}
                    >
                      {slot.slot_time}
                    </button>
                  ))}
                </div>
              </>
            )}

            {error && (
              <p role="alert" className="mt-4 text-red-600">
                Erro: {error}
              </p>
            )}

            {selectedService && selectedTime && (
              <div className="mt-8">
                <div className="rounded-xl bg-[#F4E5DC] p-5">
                  <h3 className="mb-3 font-semibold text-[#673016]">
                    Seu agendamento
                  </h3>

                  <p className="text-[#3E2118]">
                    Serviço: {selectedService.name}
                  </p>
                  <p className="text-[#3E2118]">
                    Data: {formatDate(date)}
                  </p>
                  <p className="text-[#3E2118]">
                    Horário: {selectedTime}
                  </p>
                  <p className="mt-2 font-semibold text-[#673016]">
                    Valor: {formatPrice(selectedService.price)}
                  </p>
                </div>

                <div className="mt-8">
                  <h3 className="mb-5 text-xl font-semibold text-[#3E2118]">
                    4. Seus dados
                  </h3>

                  <label
                    htmlFor="client-name"
                    className="mb-2 block font-medium text-[#3E2118]"
                  >
                    Nome completo
                  </label>

                  <input
                    id="client-name"
                    type="text"
                    autoComplete="name"
                    maxLength={100}
                    value={clientName}
                    onChange={(event) =>
                      setClientName(event.target.value)
                    }
                    placeholder="Digite seu nome completo"
                    className="mb-5 w-full rounded-xl border border-[#EAD1BD] bg-white p-3 text-[#3E2118]"
                  />

                  <label
                    htmlFor="client-phone"
                    className="mb-2 block font-medium text-[#3E2118]"
                  >
                    WhatsApp com DDD
                  </label>

                  <input
                    id="client-phone"
                    type="tel"
                    autoComplete="tel"
                    inputMode="numeric"
                    maxLength={13}
                    value={clientPhone}
                    onChange={(event) =>
                      handlePhoneChange(event.target.value)
                    }
                    placeholder="47999999999"
                    className="mb-2 w-full rounded-xl border border-[#EAD1BD] bg-white p-3 text-[#3E2118]"
                  />

                  <p className="mb-6 text-xs text-[#A97765]">
                    Digite somente números, incluindo o DDD.
                  </p>

                  <div className="mb-6">
                    <p className="mb-3 font-medium text-[#3E2118]">
                      5. Verificação de segurança
                    </p>

                    {turnstileSiteKey ? (
                      <Turnstile
                        key={`${serviceId}-${date}-${selectedTime}-${turnstileKey}`}
                        siteKey={turnstileSiteKey}
                        options={{
                          theme: "light",
                          language: "pt-br",
                        }}
                        onSuccess={(token) =>
                          setTurnstileToken(token)
                        }
                        onExpire={() => {
                          setTurnstileToken("");
                          setTurnstileKey(
                            (previous) => previous + 1
                          );
                        }}
                        onError={() => {
                          setTurnstileToken("");
                        }}
                      />
                    ) : (
                      <p className="text-sm text-red-600">
                        Turnstile não configurado.
                      </p>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={confirmarAgendamento}
                    disabled={!formReady || loading}
                    className="w-full rounded-xl bg-[#673016] px-5 py-4 font-semibold text-white transition hover:bg-[#A97765] disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {loading
                      ? "Confirmando..."
                      : "Confirmar agendamento"}
                  </button>

                  {formReady && !loading && (
                    <p className="mt-2 text-center text-sm text-green-700">
                      Formulário preenchido e verificação concluída.
                    </p>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
}
