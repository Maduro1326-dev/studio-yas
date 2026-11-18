
"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";

const SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

function hojeLocal() {
  const partes = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());

  const valor = (tipo) =>
    partes.find((p) => p.type === tipo)?.value;

  return `${valor("year")}-${valor("month")}-${valor("day")}`;
}

function dataLimite() {
  const [ano, mes, dia] = hojeLocal().split("-").map(Number);
  const data = new Date(Date.UTC(ano, mes - 1, dia + 90));
  return data.toISOString().slice(0, 10);
}

function formatarData(data) {
  if (!data) return "";
  const [ano, mes, dia] = data.split("-");
  return `${dia}/${mes}/${ano}`;
}

export default function RemarcarPage() {
  const [token, setToken] = useState("");
  const [reserva, setReserva] = useState(null);
  const [data, setData] = useState("");
  const [horarios, setHorarios] = useState([]);
  const [horario, setHorario] = useState("");
  const [carregando, setCarregando] = useState(true);
  const [buscando, setBuscando] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState("");
  const [sucesso, setSucesso] = useState(false);

  const widgetRef = useRef(null);
  const turnstileId = useRef(null);
  const turnstileToken = useRef("");
  const [turnstilePronto, setTurnstilePronto] = useState(false);

  useEffect(() => {
    const codigo = new URLSearchParams(
      window.location.search
    ).get("token");

    if (!codigo || !/^[0-9a-f]{64}$/.test(codigo)) {
      setErro("Este link de remarcação é inválido.");
      setCarregando(false);
      return;
    }

    setToken(codigo);

    async function carregar() {
      const { data: resultado, error } = await supabase.rpc(
        "get_reschedule_booking",
        { p_token: codigo }
      );

      if (error || !resultado?.length) {
        setErro("Este link expirou ou não está mais disponível.");
      } else {
        setReserva(resultado[0]);
      }

      setCarregando(false);
    }

    carregar();
  }, []);

  useEffect(() => {
    if (!reserva || !SITE_KEY || !widgetRef.current) return;

    let ativo = true;
    let intervalo;

    function iniciar() {
      if (!ativo || !window.turnstile || !widgetRef.current) {
        return;
      }

      if (turnstileId.current !== null) return;

      turnstileId.current = window.turnstile.render(
        widgetRef.current,
        {
          sitekey: SITE_KEY,
          callback: (valor) => {
            turnstileToken.current = valor;
            setTurnstilePronto(true);
          },
          "expired-callback": () => {
            turnstileToken.current = "";
            setTurnstilePronto(false);
          },
          "error-callback": () => {
            turnstileToken.current = "";
            setTurnstilePronto(false);
          },
        }
      );
    }

    if (window.turnstile) {
      iniciar();
    } else {
      const script = document.createElement("script");
      script.src =
        "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
      script.async = true;
      document.head.appendChild(script);

      intervalo = window.setInterval(() => {
        if (window.turnstile) {
          window.clearInterval(intervalo);
          iniciar();
        }
      }, 200);
    }

    return () => {
      ativo = false;
      if (intervalo) window.clearInterval(intervalo);

      if (turnstileId.current !== null && window.turnstile) {
        try {
          window.turnstile.remove(turnstileId.current);
        } catch {
          // Widget já removido
        }
        turnstileId.current = null;
      }
    };
  }, [reserva]);

  useEffect(() => {
    if (!data || !reserva) {
      setHorarios([]);
      setHorario("");
      return;
    }

    let ativo = true;

    async function carregarHorarios() {
      setBuscando(true);
      setErro("");
      setHorario("");
      setHorarios([]);

      const { data: resultado, error } = await supabase.rpc(
        "get_available_slots",
        {
          p_date: data,
          p_duration_minutes: reserva.service_duration,
        }
      );

      if (!ativo) return;

      if (error) {
        setErro("Não foi possível consultar os horários.");
      } else {
        const lista = Array.isArray(resultado)
          ? resultado.map((item) =>
              typeof item === "string"
                ? item
                : item.slot_time ??
                  item.available_time ??
                  item.time ??
                  item.slot
            ).filter(Boolean)
          : [];

        setHorarios(
          lista.map((h) => String(h).slice(0, 5))
        );
      }

      setBuscando(false);
    }

    carregarHorarios();

    return () => {
      ativo = false;
    };
  }, [data, reserva]);

  async function confirmar() {
    if (!token || !data || !horario || !turnstileToken.current) {
      setErro("Selecione um horário e conclua a verificação.");
      return;
    }

    setEnviando(true);
    setErro("");

    try {
      const { data: resultado, error } =
        await supabase.functions.invoke("reschedule-booking", {
          body: {
            token,
            date: data,
            time: horario,
            turnstile_token: turnstileToken.current,
          },
        });

      if (error || resultado?.success !== true) {
        throw new Error(
          resultado?.message ||
          "Não foi possível remarcar. Tente novamente."
        );
      }

      setSucesso(true);
    } catch (e) {
      setErro(e.message || "Erro ao remarcar.");

      turnstileToken.current = "";
      setTurnstilePronto(false);

      if (turnstileId.current !== null && window.turnstile) {
        window.turnstile.reset(turnstileId.current);
      }
    } finally {
      setEnviando(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#F4E5DC] px-4 py-12 text-[#3E2118]">
      <div className="mx-auto max-w-xl rounded-3xl bg-white p-6 shadow-lg sm:p-10">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-semibold text-[#673016]">
            Studio Yas
          </h1>
          <p className="mt-2 text-[#A97765]">
            A beleza mora nos detalhes
          </p>
        </div>

        {carregando ? (
          <p className="text-center">Carregando agendamento...</p>
        ) : sucesso ? (
          <div className="text-center">
            <h2 className="text-2xl font-semibold text-[#673016]">
              Remarcação confirmada! ✨
            </h2>
            <p className="mt-4">
              Seu novo atendimento está marcado para{" "}
              <strong>{formatarData(data)}</strong>, às{" "}
              <strong>{horario}</strong>.
            </p>
            <p className="mt-3 text-sm text-[#A97765]">
              Esperamos você no Studio Yas!
            </p>
          </div>
        ) : !reserva ? (
          <p className="text-center text-red-700">
            {erro || "Agendamento não encontrado."}
          </p>
        ) : (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-semibold text-[#673016]">
                Remarcar atendimento
              </h2>
              <p className="mt-2 text-sm">
                Escolha uma nova data e horário para seu atendimento.
              </p>
            </div>

            <div className="rounded-2xl bg-[#F4E5DC] p-4">
              <p className="font-semibold">{reserva.service_name}</p>
              <p className="mt-2 text-sm">
                Agendamento atual:{" "}
                {reserva.appointment_date} às{" "}
                {reserva.appointment_time}
              </p>
              <p className="mt-1 text-sm">
                Duração: {reserva.service_duration} minutos
              </p>
            </div>

            <div>
              <label
                htmlFor="data-remarcacao"
                className="mb-2 block font-medium"
              >
                Nova data
              </label>
              <input
                id="data-remarcacao"
                type="date"
                min={hojeLocal()}
                max={dataLimite()}
                value={data}
                onChange={(e) => setData(e.target.value)}
                className="w-full rounded-xl border border-[#EAD1BD] p-3"
              />
            </div>

            {buscando && (
              <p className="text-sm">Buscando horários disponíveis...</p>
            )}

            {data && !buscando && (
              <div>
                <p className="mb-3 font-medium">
                  Horários disponíveis
                </p>

                {horarios.length === 0 ? (
                  <p className="text-sm text-[#A97765]">
                    Nenhum horário disponível nesta data.
                  </p>
                ) : (
                  <div className="grid grid-cols-3 gap-3">
                    {horarios.map((h) => (
                      <button
                        key={h}
                        type="button"
                        onClick={() => setHorario(h)}
                        className={`rounded-xl border p-3 transition ${
                          horario === h
                            ? "border-[#673016] bg-[#673016] text-white"
                            : "border-[#EAD1BD] hover:bg-[#F4E5DC]"
                        }`}
                      >
                        {h}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {!SITE_KEY && (
              <p className="text-sm text-red-700">
                A verificação de segurança não está configurada.
              </p>
            )}

            <div ref={widgetRef} />

            {erro && (
              <p role="alert" className="text-sm text-red-700">
                {erro}
              </p>
            )}

            <button
              type="button"
              onClick={confirmar}
              disabled={
                !data ||
                !horario ||
                !turnstilePronto ||
                enviando
              }
              className="w-full rounded-xl bg-[#673016] px-5 py-4 font-semibold text-white transition hover:bg-[#A97765] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {enviando
                ? "Confirmando..."
                : "Confirmar remarcação"}
            </button>

            <p className="text-center text-xs text-[#A97765]">
              Seu horário atual permanece reservado até a confirmação.
            </p>
          </div>
        )}
      </div>
    </main>
  );
}
