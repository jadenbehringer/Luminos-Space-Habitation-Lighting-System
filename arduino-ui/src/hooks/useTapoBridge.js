import { useCallback, useEffect, useState } from 'react';

const BASE_URL = process.env.REACT_APP_TAPO_BRIDGE_URL || 'http://127.0.0.1:8765';

export function useTapoBridge(currentLux) {
  const [bridge, setBridge] = useState({
    online: false,
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
    bridgeUrl: BASE_URL,
  };
}
