import * as React from "react";

interface GravadorAudioState {
  status: "idle" | "gravando" | "parado";
  duracaoSegundos: number;
  audioBlob: Blob | null;
  error: string | null;
}

export function useGravadorAudio() {
  const [state, setState] = React.useState<GravadorAudioState>({
    status: "idle",
    duracaoSegundos: 0,
    audioBlob: null,
    error: null,
  });
  const mediaRecorderRef = React.useRef<MediaRecorder | null>(null);
  const chunksRef = React.useRef<Blob[]>([]);
  const intervalRef = React.useRef<number | null>(null);
  const streamRef = React.useRef<MediaStream | null>(null);

  const cancelar = React.useCallback(() => {
    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state === "recording"
    ) {
      try {
        mediaRecorderRef.current.stop();
      } catch {
        /* noop */
      }
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    chunksRef.current = [];
    setState({
      status: "idle",
      duracaoSegundos: 0,
      audioBlob: null,
      error: null,
    });
  }, []);

  const iniciar = React.useCallback(async () => {
    try {
      setState((s) => ({ ...s, error: null }));
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : MediaRecorder.isTypeSupported("audio/mp4")
        ? "audio/mp4"
        : "";

      const recorder = new MediaRecorder(
        stream,
        mimeType ? { mimeType } : undefined,
      );
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType });
        setState((s) => ({ ...s, status: "parado", audioBlob: blob }));
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
        if (streamRef.current) {
          streamRef.current.getTracks().forEach((t) => t.stop());
          streamRef.current = null;
        }
      };

      recorder.start();
      setState({
        status: "gravando",
        duracaoSegundos: 0,
        audioBlob: null,
        error: null,
      });

      intervalRef.current = window.setInterval(() => {
        setState((s) => ({ ...s, duracaoSegundos: s.duracaoSegundos + 1 }));
      }, 1000);
    } catch (err: any) {
      setState((s) => ({
        ...s,
        status: "idle",
        error:
          err?.name === "NotAllowedError"
            ? "Permissão de microfone negada"
            : "Erro ao acessar microfone",
      }));
    }
  }, []);

  const parar = React.useCallback(() => {
    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state === "recording"
    ) {
      mediaRecorderRef.current.stop();
    }
  }, []);

  React.useEffect(() => {
    return () => {
      cancelar();
    };
  }, [cancelar]);

  return {
    ...state,
    iniciar,
    parar,
    cancelar,
  };
}

/** Converte Blob de áudio gravado em File pra upload. */
export function audioBlobParaFile(blob: Blob): File {
  const ext = blob.type.includes("webm")
    ? "webm"
    : blob.type.includes("mp4")
    ? "m4a"
    : "audio";
  return new File([blob], `audio-${Date.now()}.${ext}`, { type: blob.type });
}
