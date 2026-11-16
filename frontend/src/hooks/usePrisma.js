import { useCallback, useEffect, useRef, useState } from "react";

export default function usePrisma(onTranscript, onStatus) {
  const socketRef = useRef(null);
  const streamRef = useRef(null);
  const audioContextRef = useRef(null);
  const processorRef = useRef(null);
  const sourceRef = useRef(null);
  const silentGainRef = useRef(null);

  const connectedRef = useRef(false);
  const streamingRef = useRef(false);

  const transcriptCallbackRef = useRef(onTranscript);
  const statusCallbackRef = useRef(onStatus);

  const [listening, setListening] = useState(false);

  useEffect(() => {
    transcriptCallbackRef.current = onTranscript;
    statusCallbackRef.current = onStatus;
  }, [onTranscript, onStatus]);

  const pause = useCallback(() => {
    streamingRef.current = false;
    setListening(false);
  }, []);

  const stop = useCallback(async () => {
    streamingRef.current = false;
    connectedRef.current = false;
    setListening(false);

    if (socketRef.current) {
      const socket = socketRef.current;
      socketRef.current = null;

      socket.onopen = null;
      socket.onmessage = null;
      socket.onerror = null;
      socket.onclose = null;

      if (
        socket.readyState === WebSocket.OPEN ||
        socket.readyState === WebSocket.CONNECTING
      ) {
        try {
          socket.close();
        } catch {}
      }
    }

    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current.onaudioprocess = null;
      processorRef.current = null;
    }

    sourceRef.current?.disconnect();
    sourceRef.current = null;

    silentGainRef.current?.disconnect();
    silentGainRef.current = null;

    streamRef.current?.getTracks().forEach(track => track.stop());
    streamRef.current = null;

    if (audioContextRef.current) {
      await audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
  }, []);

  const start = useCallback(async () => {
    if (
      connectedRef.current &&
      socketRef.current?.readyState === WebSocket.OPEN
    ) {
      if (audioContextRef.current?.state === "suspended") {
        await audioContextRef.current.resume();
      }

      streamingRef.current = true;
      setListening(true);

      statusCallbackRef.current?.("Prisma is listening to you...");
      return;
    }

    if (
      socketRef.current ||
      streamRef.current ||
      audioContextRef.current
    ) {
      await stop();
    }

    try {
      statusCallbackRef.current?.("Starting microphone...");

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });

      streamRef.current = stream;

      const socket = new WebSocket(
        "ws://localhost:8000/api/voice/listen"
      );

      socket.binaryType = "arraybuffer";
      socketRef.current = socket;

      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error("Prisma connection timed out."));
        }, 12000);

        socket.onmessage = event => {
          if (typeof event.data !== "string") return;

          let message;

          try {
            message = JSON.parse(event.data);
          } catch {
            return;
          }

          if (message.type === "ready") {
            clearTimeout(timeout);
            resolve();
          }

          if (
            message.type === "transcript" &&
            message.text?.trim()
          ) {
            transcriptCallbackRef.current?.(
              message.text.trim()
            );
          }

          if (message.type === "error") {
            statusCallbackRef.current?.(
              `Prisma error: ${message.message}`
            );
          }
        };

        socket.onerror = () => {
          clearTimeout(timeout);
          reject(new Error("Unable to connect to Prisma."));
        };

        socket.onclose = () => {
          connectedRef.current = false;
          streamingRef.current = false;
          setListening(false);
        };
      });

      const audioContext = new AudioContext();
      audioContextRef.current = audioContext;

      if (audioContext.state === "suspended") {
        await audioContext.resume();
      }

      const source =
        audioContext.createMediaStreamSource(stream);

      sourceRef.current = source;

      const processor =
        audioContext.createScriptProcessor(1024, 1, 1);

      processorRef.current = processor;

      const inputRate = audioContext.sampleRate;
      const outputRate = 16000;

      processor.onaudioprocess = event => {
        const activeSocket = socketRef.current;

        if (
          !streamingRef.current ||
          !connectedRef.current ||
          activeSocket?.readyState !== WebSocket.OPEN
        ) {
          return;
        }

        const input =
          event.inputBuffer.getChannelData(0);

        const ratio = inputRate / outputRate;
        const outputLength = Math.floor(
          input.length / ratio
        );

        const pcm = new Int16Array(outputLength);

        for (let i = 0; i < outputLength; i++) {
          const position = i * ratio;
          const index = Math.floor(position);
          const fraction = position - index;

          const first = input[index] || 0;
          const second = input[index + 1] ?? first;

          const sample = Math.max(
            -1,
            Math.min(
              1,
              first + (second - first) * fraction
            )
          );

          pcm[i] =
            sample < 0
              ? sample * 32768
              : sample * 32767;
        }

        if (activeSocket.readyState === WebSocket.OPEN) {
          activeSocket.send(pcm.buffer);
        }
      };

      source.connect(processor);

      const silentGain = audioContext.createGain();
      silentGain.gain.value = 0;

      silentGainRef.current = silentGain;

      processor.connect(silentGain);
      silentGain.connect(audioContext.destination);

      connectedRef.current = true;
      streamingRef.current = true;

      setListening(true);

      statusCallbackRef.current?.(
        "Prisma is listening to you..."
      );

    } catch (error) {
      console.error("Prisma microphone error:", error);

      await stop();

      statusCallbackRef.current?.(
        error.message || "Unable to start the microphone."
      );
    }
  }, [stop]);

  useEffect(() => {
    return () => {
      stop();
    };
  }, [stop]);

  return {
    start,
    pause,
    stop,
    listening
  };
}
