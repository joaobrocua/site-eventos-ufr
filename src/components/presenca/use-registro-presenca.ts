"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { registrarPresenca } from "@/app/painel/eventos/[id]/presenca/actions";
import { lerCodigo, leituraRepetida, normalizarCodigo, type UltimaLeitura } from "@/lib/presenca/codigo";
import { duracaoDoResultado, type ResultadoTela } from "@/lib/presenca/tipos";

function vibrar(padrao: number | number[]) {
  if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
    navigator.vibrate(padrao);
  }
}

/**
 * Fluxo único de registro (câmera e digitação): valida o código, chama a action,
 * guarda o resultado para o painel e o apaga sozinho quando faz sentido.
 */
export function useRegistroPresenca(atividadeId: string) {
  const [resultado, setResultado] = useState<ResultadoTela | null>(null);
  const [enviando, setEnviando] = useState(false);
  const ultimaLeitura = useRef<UltimaLeitura>(null);
  const emAndamento = useRef(false);

  useEffect(() => {
    if (!resultado) return;
    const ms = duracaoDoResultado(resultado);
    if (ms === null) return;
    const t = setTimeout(() => setResultado(null), ms);
    return () => clearTimeout(t);
  }, [resultado]);

  const enviar = useCallback(
    async (bruto: string, incluir = false) => {
      if (emAndamento.current) return;
      const codigo = lerCodigo(bruto);
      if (!codigo) {
        vibrar([120, 60, 120]);
        setResultado({ tipo: "qr_invalido" });
        return;
      }

      emAndamento.current = true;
      setEnviando(true);
      try {
        const r = await registrarPresenca({ codigo, atividadeId, incluir });
        if (!r.ok) {
          vibrar([120, 60, 120]);
          setResultado({ tipo: "erro", mensagem: r.erro });
          return;
        }
        vibrar(r.dados.resultado === "registrado" ? 80 : [120, 60, 120]);
        setResultado({ tipo: r.dados.resultado, dados: r.dados, codigo });
      } catch {
        setResultado({ tipo: "erro", mensagem: "Sem conexão. Confira a internet e tente de novo." });
      } finally {
        emAndamento.current = false;
        setEnviando(false);
      }
    },
    [atividadeId],
  );

  /** Chamada a cada leitura da câmera; descarta o mesmo código lido de novo em até 3s. */
  const aoLerQr = useCallback(
    (bruto: string) => {
      if (emAndamento.current) return;
      const codigo = normalizarCodigo(bruto);
      const agora = Date.now();
      const repetida = leituraRepetida(ultimaLeitura.current, codigo, agora);
      // Renova o relógio mesmo quando ignora: QR parado na frente da câmera não dispara de novo.
      ultimaLeitura.current = { codigo, em: agora };
      if (!repetida) void enviar(bruto);
    },
    [enviar],
  );

  const incluirEregistrar = useCallback(() => {
    if (resultado?.tipo === "nao_inscrito") void enviar(resultado.codigo, true);
  }, [resultado, enviar]);

  const limpar = useCallback(() => setResultado(null), []);

  return { resultado, enviando, enviar, aoLerQr, incluirEregistrar, limpar };
}
