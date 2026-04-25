/**
 * useLiveData.js
 * --------------
 * Central data hook for the AstroView dashboard.
 *
 * Responsibilities:
 *  1. Manage a 60-sample rolling lux history used by LightChart.
 *  2. Open and maintain a Web Serial connection to the Arduino running
 *     blue_light_test.ino (TCS34725 sensor).
 *     – Parses "Blue: <value>" lines → exposes `blue` (raw TCS34725 counts).
 *     – Parses "RAW: <n>, VOLTAGE: <v>, LUX: <l>" lines → exposes raw/lux.
 *     – Auto-reconnects to any previously-paired port on mount.
 *  3. Run a 150 ms simulation loop that generates plausible values for every
 *     dashboard metric while no live serial data is present.  When the sensor
 *     IS connected the simulated lux/raw values are replaced by real readings.
 *
 * Returned object surface:
 *   raw, circadian, fused, lux   – current light-level values
 *   blue                         – TCS34725 blue channel (null when not connected)
 *   history                      – rolling 60-point lux array for LightChart
 *   servoPositions               – [s1,s2,s3,s4] simulated servo angles
 *   mlWeights                    – [w1,w2,w3] simulated ML weighting factors
 *   orbitPct / orbitPhase        – orbital position within a 9-min orbit cycle
 *   missionTime                  – elapsed HH:MM:SS since app load
 *   episode / reward             – simulated RL training telemetry
 *   solarDelta / solarAlert      – lux delta from last tick; flare threshold flag
 *   alertLevel                   – null | 'caution' | 'emergency'
 *   activeProfile                – id of the PROFILE closest to current lux
 *   serialSupported              – boolean; false on browsers without Web Serial API
 *   serialConnected              – true while an Arduino port is open
 *   serialError                  – last serial error message (string | null)
 *   connectSerial()              – opens browser serial port picker dialog
 *   writeSerial(text)            – sends a text line to the connected Arduino
 */

import { useState, useEffect, useRef } from 'react';
import { PROFILES } from '../data/dummy';

export function useLiveData() {
  // Timestamp of hook mount — used to compute elapsed mission time and drive
  // all time-varying simulation functions.
  const startRef = useRef(Date.now());

  // Rolling 60-point lux history pre-filled with plausible values so the
  // chart is not empty on first render.
  const histRef = useRef(Array.from({ length: 60 }, () => 300 + Math.random() * 100));

  // Live sensor readings from the Arduino serial stream.
  //   hasData     – true once the first RAW/VOLTAGE/LUX line is received
  //   hasBlueData – true once the first "Blue:" line is received
  const sensorRef = useRef({ raw: null, voltage: null, lux: null, blue: null, hasData: false, hasBlueData: false });

  // Web Serial API handles kept in refs so they persist across renders without
  // triggering re-renders and can be safely cancelled during cleanup.
  const readerRef = useRef(null);  // ReadableStreamDefaultReader
  const writerRef = useRef(null);  // WritableStreamDefaultWriter
  const portRef = useRef(null);    // SerialPort

  // Stable ref wrapping the async connectSerial implementation so Dashboard
  // can call it via a non-stale closure returned from this hook.
  const connectSerialRef = useRef(async () => {});

  // ---------------------------------------------------------------------------
  // Initial state — all values are plausible defaults shown until the
  // simulation loop or serial data overwrites them on the first tick.
  // ---------------------------------------------------------------------------
  const [data, setData] = useState({
    raw: 647,
    circadian: 280,
    fused: 312,
    lux: 150,
    blue: null,             // null until the TCS34725 sensor sends its first reading
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

  // ---------------------------------------------------------------------------
  // Effect 1 – Web Serial management
  // Runs once on mount.  Skipped entirely on browsers that lack the API
  // (Firefox, Safari) — the app gracefully degrades to simulation mode.
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (typeof navigator === 'undefined' || !('serial' in navigator)) return undefined;

    let cancelled = false;

    /**
     * connectToPort
     * Opens a serial port at 9600 baud (matching blue_light_test.ino) and
     * starts reading lines asynchronously.  Two line formats are parsed:
     *
     *   "RAW: <n>, VOLTAGE: <v>, LUX: <l>"  — full lux sensor reading
     *   "Blue: <n>"                           — TCS34725 raw blue channel
     *
     * Both formats can coexist in the serial stream; each updates its own
     * slice of sensorRef so the simulation loop can blend them with generated
     * data on the next tick.
     */
    const connectToPort = async (port) => {
      // Cancel and release any previously active reader to avoid lock conflicts.
      if (readerRef.current) {
        try {
          await readerRef.current.cancel();
          readerRef.current.releaseLock();
        } catch (_) {}
      }
      // Close the old port if we're switching to a different one.
      if (portRef.current && portRef.current !== port) {
        try {
          await portRef.current.close();
        } catch (_) {}
      }

      // Open at 9600 baud — must match Serial.begin(9600) in the Arduino sketch.
      await port.open({ baudRate: 9600 });
      portRef.current = port;

      // Prefer TextDecoderStream (available in Chrome 98+) for zero-copy UTF-8
      // decoding; fall back to a plain Uint8Array reader with manual decoding.
      let reader;
      if (port.readable.pipeThrough && typeof TextDecoderStream !== 'undefined') {
        const textDecoder = new TextDecoderStream();
        port.readable.pipeTo(textDecoder.writable).catch(() => {});
        reader = textDecoder.readable.getReader();
      } else {
        reader = port.readable.getReader();
      }
      readerRef.current = reader;

      // Grab a writer handle so Dashboard can send servo-angle commands back
      // to the Arduino via writeSerial().
      if (port.writable) {
        writerRef.current = port.writable.getWriter();
      }

      setData((prev) => ({ ...prev, serialConnected: true, serialError: null }));

      // Line-oriented buffering — serial chunks may split across line boundaries.
      let buffer = '';
      try {
        while (!cancelled) {
          const { value, done } = await reader.read();
          if (done) break;

          // Normalise to string regardless of whether we got a Uint8Array or
          // a pre-decoded string from TextDecoderStream.
          const chunk = typeof value === 'string' ? value : new TextDecoder().decode(value);
          buffer += chunk;

          // Split on CR, LF, or CRLF; keep the incomplete trailing fragment.
          const lines = buffer.split(/\r?\n/);
          buffer = lines.pop() || '';

          for (const line of lines) {
            // Full lux sensor line: RAW: 512, VOLTAGE: 2.48, LUX: 245.7
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

            // TCS34725 blue channel line: "Blue: 1234"
            // (emitted by blue_light_test.ino every ~1 s)
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
        // Transient read errors during disconnect/reconnect are expected and
        // harmless — polling will re-establish the connection automatically.
      } finally {
        setData((prev) => ({ ...prev, serialConnected: false }));
        try { reader.releaseLock(); } catch (_) {}
        try {
          if (writerRef.current) {
            writerRef.current.releaseLock();
            writerRef.current = null;
          }
        } catch (_) {}
      }
    };

    /**
     * autoReconnect
     * If the browser already has a permission grant for a previously-used port
     * (persisted across page loads), connect to it immediately without a user
     * gesture.  This keeps the dashboard live-data-ready on refresh.
     */
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

    /**
     * connectSerialRef.current
     * Exposed to callers as connectSerial().  Opens the browser's native port
     * picker so the user can authorise access to a new Arduino device.
     */
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

    // Cleanup: cancel the ongoing read loop and close the port when the
    // component unmounts (e.g. during hot-reload or navigation).
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

  // ---------------------------------------------------------------------------
  // Effect 2 – Simulation / data-fusion loop (150 ms interval)
  // Produces all dashboard metrics each tick.  When live serial data is
  // available it takes precedence over the generated values.
  // ---------------------------------------------------------------------------
  useEffect(() => {
    const interval = setInterval(() => {
      // Elapsed seconds since the hook mounted — drives all oscillating values.
      const t = (Date.now() - startRef.current) / 1000;

      // --- Raw lux simulation (used when no Arduino is connected) ---
      // Combines a slow 15 s sinusoidal orbit cycle, a faster 5 s ripple, and
      // small random noise to mimic realistic illuminance variation.
      const simulatedRaw = Math.round(Math.min(1023, Math.max(0,
        600 + Math.sin(t / 15) * 150 + Math.sin(t / 5) * 30 + Math.random() * 15
      )));

      // Use the live sensor value when available; otherwise fall back to simulation.
      const hasSerialLux = sensorRef.current.hasData;
      const raw = hasSerialLux ? sensorRef.current.raw : simulatedRaw;

      // Circadian rhythm model: slow 30 s sine centred at 200, ±120 units.
      const circadian = Math.round(200 + Math.sin(t / 30) * 120);

      // Fused output: live sensor bypasses the fusion model; simulation blends
      // raw sensor and circadian input (70 / 30 split).
      const fused = hasSerialLux ? raw : Math.round(raw * 0.7 + circadian * 0.3);

      // Lux: live Arduino lux reading if available; otherwise scale fused value.
      const lux = hasSerialLux
        ? sensorRef.current.lux
        : Math.round(fused * 0.48);

      // --- Solar flare alert (NASA SSP_50005 §9.4.4.3) ---
      // If lux jumps more than 80 units in one tick, flag a class-1 emergency.
      const prevValue = histRef.current[histRef.current.length - 1];
      const delta = Math.round(lux - prevValue);
      const solarAlert = delta > 80;

      // Advance rolling history — drop oldest sample, append new lux value.
      histRef.current = [...histRef.current.slice(1), lux];

      // --- Orbital position ---
      // Simulate a 9-minute (540 000 ms) ISS-style orbit cycle with a
      // day/night terminator at the midpoint.
      const orbitMs = (t * 1000) % 540000;
      const orbitPct = Math.round((orbitMs / 540000) * 100);
      const orbitPhase = orbitMs < 270000 ? 'DAY' : 'NIGHT';

      // --- Mission elapsed time (MET) HH:MM:SS ---
      const elapsed = Math.floor(t);
      const h = String(Math.floor(elapsed / 3600)).padStart(2, '0');
      const m = String(Math.floor((elapsed % 3600) / 60)).padStart(2, '0');
      const s = String(elapsed % 60).padStart(2, '0');

      // --- Servo position simulation ---
      // Four servo axes oscillate independently with different periods and
      // amplitudes to simulate realistic filter-panel movement.
      const s1 = Math.round(90 + Math.sin(t / 20) * 50);
      const s2 = Math.round(80 + Math.cos(t / 25) * 40);
      const s3 = Math.round(110 + Math.sin(t / 18) * 60);
      const s4 = Math.round(40 + Math.cos(t / 22) * 30);

      // --- ML weight simulation ---
      // Three weighting factors oscillate around 1.0 to mimic a reinforcement
      // learning policy that is converging but not yet settled.
      const w1 = parseFloat((1.0 + Math.sin(t / 40) * 0.5).toFixed(2));
      const w2 = parseFloat((1.0 + Math.cos(t / 35) * 0.4).toFixed(2));
      const w3 = parseFloat((0.8 + Math.sin(t / 50) * 0.3).toFixed(2));

      // --- Active lighting profile ---
      // Find whichever PROFILE has a targetLux closest to the current lux value.
      let activeProfile = PROFILES[0].id;
      let minDist = Infinity;
      for (const p of PROFILES) {
        const dist = Math.abs(lux - p.targetLux);
        if (dist < minDist) {
          minDist = dist;
          activeProfile = p.id;
        }
      }

      // --- Three-level alert classification (NASA SSP_50005 §9.4.4.3) ---
      //   Emergency (class 1) – solar flare detected (sudden large lux spike)
      //   Caution   (class 3) – lux outside the 50–450 nominal operating range
      //   null                – nominal, no alert
      const alertLevel = solarAlert ? 'emergency' : (lux > 450 || lux < 50) ? 'caution' : null;

      setData((prev) => ({
        ...prev,
        raw,
        // blue: prefer live TCS34725 sensor data; null triggers "SIM" badge in UI
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
    }, 150); // 150 ms ≈ 6.7 Hz — fast enough for fluid gauge/chart updates

    return () => clearInterval(interval);
  }, []);

  // ---------------------------------------------------------------------------
  // Public API returned to consumers
  // ---------------------------------------------------------------------------
  return {
    ...data,

    /**
     * connectSerial()
     * Opens the browser serial port picker.  Call this from a user-gesture
     * handler (e.g. a button onClick) to satisfy browser security requirements.
     */
    connectSerial: () => connectSerialRef.current(),

    /**
     * writeSerial(text)
     * Sends a UTF-8 text line to the connected Arduino (newline appended).
     * Used by TapoControlPanel to transmit servo filter angles.
     * Safe to call even when no port is open — silently does nothing.
     */
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