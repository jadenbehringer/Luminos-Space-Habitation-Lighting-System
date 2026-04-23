import { useCallback, useEffect, useState } from 'react';

const BASE_URL = process.env.REACT_APP_TAPO_BRIDGE_URL || 'http://127.0.0.1:8765';

export function useTapoBridge(currentLux) {
  const [bridge, setBridge] = useState({
    online: false,
    powerOn: true,
    autoEnabled: false,
    targetLux: 120,
    currentLux: null,
    brightness: 50,
    minBrightness: 1,
    maxBrightness: 100,
    toleranceLux: 5,
    lastAction: 'idle',
    lastError: null,
  });
  const [bridgeReachable, setBridgeReachable] = useState(false);
  const [targetInput, setTargetInput] = useState('120');
  const [editingTarget, setEditingTarget] = useState(false);
  const [tempAutoTarget, setTempAutoTarget] = useState(null);

  const fetchState = useCallback(async () => {
    const res = await fetch(`${BASE_URL}/state`);
    if (!res.ok) throw new Error(`Bridge HTTP ${res.status}`);
    const json = await res.json();
    if (json?.state) {
      setBridge(json.state);
      if (!editingTarget) {
        setTargetInput(String(Math.round(json.state.targetLux ?? 120)));
      }
    }
  }, [editingTarget]);

  const postJson = useCallback(async (path, payload) => {
    const res = await fetch(`${BASE_URL}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(text || `Bridge HTTP ${res.status}`);
    }
    const json = await res.json();
    if (json?.state) setBridge(json.state);
  }, []);

  useEffect(() => {
    let cancelled = false;

    const tick = async () => {
      try {
        await fetchState();
        if (!cancelled) setBridgeReachable(true);
      } catch (_) {
        if (!cancelled) setBridgeReachable(false);
      }
    };

    tick();
    const id = setInterval(tick, 120);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [fetchState]);

  useEffect(() => {
    if (!Number.isFinite(currentLux)) return undefined;

    const send = async () => {
      try {
        await postJson('/sensor', { lux: currentLux });
      } catch (_) {
        // Bridge may be offline; polling handles status.
      }
    };

    send();
    const id = setInterval(send, 70);
    return () => clearInterval(id);
  }, [currentLux, postJson]);

  const applyTarget = useCallback(async () => {
    const target = Number(targetInput);
    if (!Number.isFinite(target)) return;
    await postJson('/target', { targetLux: target });
    setEditingTarget(false);
  }, [postJson, targetInput]);

  const setAutoEnabled = useCallback(async (enabled) => {
    await postJson('/auto', { enabled });
  }, [postJson]);

  const setBrightness = useCallback(async (brightness) => {
    await postJson('/brightness', { brightness: Number(brightness) });
  }, [postJson]);

  const setPower = useCallback(async (on) => {
    await postJson('/power', { on: Boolean(on) });
  }, [postJson]);

  const setTargetLevel = useCallback(async (lux) => {
    if (!Number.isFinite(lux)) return;
    setTargetInput(String(lux));
    await postJson('/target', { targetLux: Number(lux) });
    setEditingTarget(false);
  }, [postJson]);

  const startTemporaryAuto = useCallback(async (lux) => {
    await setTargetLevel(lux);
    await setAutoEnabled(true);
    setTempAutoTarget(Number(lux));
  }, [setTargetLevel, setAutoEnabled]);

  useEffect(() => {
    if (tempAutoTarget !== null) {
      if (!bridge.autoEnabled) {
        setTempAutoTarget(null);
      } else if (bridge.currentLux !== null) {
        if (Math.abs(bridge.currentLux - tempAutoTarget) <= (bridge.toleranceLux || 5) + 1) {
          setAutoEnabled(false);
          setTempAutoTarget(null);
        }
      }
    }
  }, [bridge.currentLux, bridge.autoEnabled, bridge.toleranceLux, tempAutoTarget, setAutoEnabled]);

  return {
    bridge,
    bridgeReachable,
    targetInput,
    setTargetInput: (value) => {
      setEditingTarget(true);
      setTargetInput(value);
    },
    applyTarget,
    setAutoEnabled,
    setBrightness,
    setPower,
    setTargetLevel,
    startTemporaryAuto,
    bridgeUrl: BASE_URL,
  };
}
