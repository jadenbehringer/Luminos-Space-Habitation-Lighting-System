import { useState, useEffect, useRef } from 'react';
import { PROFILES } from '../data/dummy';

export function useLiveData() {
  const startRef = useRef(Date.now());
  const histRef = useRef(Array.from({ length: 60 }, () => 300 + Math.random() * 100));
  const sensorRef = useRef({ raw: null, voltage: null, lux: null, blue: null, hasData: false, hasBlueData: false });
  const readerRef = useRef(null);
  const writerRef = useRef(null);
  const portRef = useRef(null);
  const connectSerialRef = useRef(async () => {});

  const [data, setData] = useState({
    raw: 647,
    circadian: 280,
    fused: 312,
    lux: 150,
    blue: null,
    history: histRef.current,
    servoPositions: [117, 81, 144, 36],
    mlWeights: [1.44, 1.1, 0.6],
    orbitPct: 47,
    orbitPhase: 'DAY',
    missionTime: '00:00:00',
    episode: 47,
    reward: 0.82,
    solarDelta: 2,
    solarAlert: false,
    alertLevel: null,
    activeProfile: 'dawn',
    serialSupported: typeof navigator !== 'undefined' && 'serial' in navigator,
    serialConnected: false,
    serialError: null,
  });

  useEffect(() => {
    if (typeof navigator === 'undefined' || !('serial' in navigator)) return undefined;

    let cancelled = false;

    const connectToPort = async (port) => {
      if (readerRef.current) {
        try {
          await readerRef.current.cancel();
          readerRef.current.releaseLock();
        } catch (_) {}
      }
      if (portRef.current && portRef.current !== port) {
        try {
          await portRef.current.close();
        } catch (_) {}
      }

      await port.open({ baudRate: 9600 });
      portRef.current = port;

      let reader;
      if (port.readable.pipeThrough && typeof TextDecoderStream !== 'undefined') {
        const textDecoder = new TextDecoderStream();
        port.readable.pipeTo(textDecoder.writable).catch(() => {});
        reader = textDecoder.readable.getReader();
      } else {
        reader = port.readable.getReader();
      }
      readerRef.current = reader;
      if (port.writable) {
        writerRef.current = port.writable.getWriter();
      }

      setData((prev) => ({ ...prev, serialConnected: true, serialError: null }));

      let buffer = '';
      try {
        while (!cancelled) {
          const { value, done } = await reader.read();
          if (done) break;

          const chunk = typeof value === 'string' ? value : new TextDecoder().decode(value);
          buffer += chunk;

          const lines = buffer.split(/\r?\n/);
          buffer = lines.pop() || '';

          for (const line of lines) {
            const m = line.match(/RAW:\s*(\d+)\s*,\s*VOLTAGE:\s*([\d.]+)\s*,\s*LUX:\s*([\d.]+)/i);
            if (m) {
              sensorRef.current = {
                ...sensorRef.current,
                raw: Number(m[1]),
                voltage: Number(m[2]),
                lux: Number(m[3]),
                hasData: true,
              };
            }

            const bMatch = line.match(/Blue:\s*(\d+)/i);
            if (bMatch) {
              sensorRef.current = {
                ...sensorRef.current,
                blue: Number(bMatch[1]),
                hasBlueData: true,
              };
            }
          }
        }
      } catch (_) {
        // Ignore transient serial read errors during disconnect/reconnect.
      } finally {
        setData((prev) => ({ ...prev, serialConnected: false }));
        try {
          reader.releaseLock();
        } catch (_) {}
        try {
          if (writerRef.current) {
            writerRef.current.releaseLock();
            writerRef.current = null;
          }
        } catch (_) {}
      }
    };

    const autoReconnect = async () => {
      try {
        const ports = await navigator.serial.getPorts();
        if (!ports.length || cancelled) return;
        await connectToPort(ports[0]);
      } catch (err) {
        if (cancelled) return;
        setData((prev) => ({ ...prev, serialError: err?.message || 'Serial connection failed' }));
      }
    };

    connectSerialRef.current = async () => {
      try {
        const port = await navigator.serial.requestPort();
        if (cancelled) return;
        await connectToPort(port);
      } catch (err) {
        if (cancelled) return;
        setData((prev) => ({
          ...prev,
          serialConnected: false,
          serialError: err?.message || 'Serial connection failed',
        }));
      }
    };

    autoReconnect();

    return () => {
      cancelled = true;
      setData((prev) => ({ ...prev, serialConnected: false }));

      const cleanup = async () => {
        try {
          if (readerRef.current) {
            await readerRef.current.cancel();
            readerRef.current.releaseLock();
          }
        } catch (_) {}
        try {
          if (writerRef.current) {
            writerRef.current.releaseLock();
            writerRef.current = null;
          }
        } catch (_) {}
        try {
          if (portRef.current) await portRef.current.close();
        } catch (_) {}
      };

      cleanup();
    };
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      const t = (Date.now() - startRef.current) / 1000;

      const simulatedRaw = Math.round(Math.min(1023, Math.max(0,
        600 + Math.sin(t / 15) * 150 + Math.sin(t / 5) * 30 + Math.random() * 15
      )));
      const hasSerialLux = sensorRef.current.hasData;
      const raw = hasSerialLux ? sensorRef.current.raw : simulatedRaw;
      const circadian = Math.round(200 + Math.sin(t / 30) * 120);
      const fused = hasSerialLux ? raw : Math.round(raw * 0.7 + circadian * 0.3);
      const lux = hasSerialLux
        ? sensorRef.current.lux
        : Math.round(fused * 0.48);

      const prevValue = histRef.current[histRef.current.length - 1];
      const delta = Math.round(lux - prevValue);
      const solarAlert = delta > 80;

      histRef.current = [...histRef.current.slice(1), lux];

      const orbitMs = (t * 1000) % 540000;
      const orbitPct = Math.round((orbitMs / 540000) * 100);
      const orbitPhase = orbitMs < 270000 ? 'DAY' : 'NIGHT';

      const elapsed = Math.floor(t);
      const h = String(Math.floor(elapsed / 3600)).padStart(2, '0');
      const m = String(Math.floor((elapsed % 3600) / 60)).padStart(2, '0');
      const s = String(elapsed % 60).padStart(2, '0');

      const s1 = Math.round(90 + Math.sin(t / 20) * 50);
      const s2 = Math.round(80 + Math.cos(t / 25) * 40);
      const s3 = Math.round(110 + Math.sin(t / 18) * 60);
      const s4 = Math.round(40 + Math.cos(t / 22) * 30);

      const w1 = parseFloat((1.0 + Math.sin(t / 40) * 0.5).toFixed(2));
      const w2 = parseFloat((1.0 + Math.cos(t / 35) * 0.4).toFixed(2));
      const w3 = parseFloat((0.8 + Math.sin(t / 50) * 0.3).toFixed(2));

      let activeProfile = PROFILES[0].id;
      let minDist = Infinity;
      for (const p of PROFILES) {
        const dist = Math.abs(lux - p.targetLux);
        if (dist < minDist) {
          minDist = dist;
          activeProfile = p.id;
        }
      }

      // Three-level alert per NASA SSP_50005 ISS Human Integration Standard §9.4.4.3
      // Emergency (class 1) = solar flare; Caution (class 3) = lux out of tolerance
      const alertLevel = solarAlert ? 'emergency' : (lux > 450 || lux < 50) ? 'caution' : null;

      setData((prev) => ({
        ...prev,
        raw,
        blue: sensorRef.current.hasBlueData ? sensorRef.current.blue : null,
        circadian,
        fused,
        lux,
        history: histRef.current,
        servoPositions: [s1, s2, s3, s4],
        mlWeights: [w1, w2, w3],
        orbitPct,
        orbitPhase,
        missionTime: `${h}:${m}:${s}`,
        episode: Math.floor(47 + t / 10),
        reward: parseFloat((0.7 + Math.sin(t / 12) * 0.25).toFixed(2)),
        solarDelta: Math.round(delta),
        solarAlert,
        alertLevel,
        activeProfile,
      }));
    }, 150);

    return () => clearInterval(interval);
  }, []);

  return {
    ...data,
    connectSerial: () => connectSerialRef.current(),
    writeSerial: async (text) => {
      if (!writerRef.current) return;
      try {
        await writerRef.current.write(new TextEncoder().encode(text + '\n'));
      } catch (err) {
        console.error('Serial write error:', err);
      }
    },
  };
}