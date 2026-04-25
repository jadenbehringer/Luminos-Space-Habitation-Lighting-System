/**
 * useTapoBridge.js
 * ----------------
 * React hook that wraps all communication with the local Tapo Bridge server.
 *
 * The Tapo Bridge is a small Python HTTP server (default: http://127.0.0.1:8765)
 * that translates REST calls into Tapo smart-bulb API commands.  This hook:
 *
 *  • Polls /state every 120 ms to keep bridge and bulb status in sync.
 *  • Pushes the current sensor lux to /sensor every 70 ms so the bridge can
 *    run its closed-loop adaptive brightness controller.
 *  • Exposes imperative helpers (applyTarget, setAutoEnabled, etc.) for UI
 *    controls to issue one-off commands.
 *  • Implements "temporary auto" — enables adaptive control just long enough
 *    to reach a target lux, then automatically disables it again.
 *
 * All network calls are wrapped in try/catch so the dashboard remains fully
 * functional when the bridge is offline (simulation / disconnected mode).
 *
 * Environment variable:
 *   REACT_APP_TAPO_BRIDGE_URL  – override the default bridge URL
 *                                (useful for running bridge on a remote host)
 */

import { useCallback, useEffect, useState } from 'react';

// Base URL for the Tapo Bridge REST API.
// Override with REACT_APP_TAPO_BRIDGE_URL in a .env file if needed.
const BASE_URL = process.env.REACT_APP_TAPO_BRIDGE_URL || 'http://127.0.0.1:8765';

export function useTapoBridge(currentLux) {
  // ---------------------------------------------------------------------------
  // Bridge state — mirrors the JSON returned by GET /state on the bridge server.
  // Displayed in TapoControlPanel and used to gate UI controls.
  // ---------------------------------------------------------------------------
  const [bridge, setBridge] = useState({
    online: false,           // true when the physical bulb is reachable over Wi-Fi
    powerOn: true,           // whether the bulb is currently switched on
    autoEnabled: false,      // whether the closed-loop lux controller is running
    targetLux: 120,          // lux setpoint used by the adaptive controller
    currentLux: null,        // last lux reading acknowledged by the bridge
    brightness: 50,          // bulb brightness 0–100 %
    minBrightness: 1,        // hardware minimum (below this the bulb turns off)
    maxBrightness: 100,
    toleranceLux: 5,         // ±tolerance band considered "at target"
    lastAction: 'idle',      // last action taken by the bridge controller
    lastError: null,         // last error string reported by the bridge
  });

  // Whether the HTTP connection to the bridge server itself is up.
  // Distinct from bridge.online (which reflects the bulb's Wi-Fi reachability).
  const [bridgeReachable, setBridgeReachable] = useState(false);

  // Controlled input value for the target-lux text field (kept as a string
  // to allow partial entry such as "15" before the user types "150").
  const [targetInput, setTargetInput] = useState('120');

  // Tracks whether the user is actively editing the target-lux field so the
  // polling loop does not silently overwrite their in-progress input.
  const [editingTarget, setEditingTarget] = useState(false);

  // Non-null while a "temporary auto" session is active; holds the lux target
  // that triggered the session so we know when to stop.
  const [tempAutoTarget, setTempAutoTarget] = useState(null);

  // ---------------------------------------------------------------------------
  // fetchState
  // GET /state → update bridge state and targetInput (unless user is editing).
  // useCallback with editingTarget in deps so it re-captures the flag on change.
  // ---------------------------------------------------------------------------
  const fetchState = useCallback(async () => {
    const res = await fetch(`${BASE_URL}/state`);
    if (!res.ok) throw new Error(`Bridge HTTP ${res.status}`);
    const json = await res.json();
    if (json?.state) {
      setBridge(json.state);
      // Don't clobber the input while the user is typing a new target.
      if (!editingTarget) {
        setTargetInput(String(Math.round(json.state.targetLux ?? 120)));
      }
    }
  }, [editingTarget]);

  // ---------------------------------------------------------------------------
  // postJson
  // Generic helper for all POST commands sent to the bridge.
  // Throws on non-2xx responses so callers can decide how to handle failures.
  // ---------------------------------------------------------------------------
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
    // Bridge responses include the updated state — apply it immediately so the
    // UI reflects the command result without waiting for the next poll tick.
    if (json?.state) setBridge(json.state);
  }, []);

  // ---------------------------------------------------------------------------
  // Effect 1 – 120 ms polling loop
  // Keeps bridgeReachable and the bridge state object fresh.
  // On failure the bridge is marked offline but no error is surfaced to the
  // user — the "BRIDGE OFFLINE" pill in TopBar provides the status indication.
  // ---------------------------------------------------------------------------
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

    tick(); // immediate first check on mount
    const id = setInterval(tick, 120);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [fetchState]);

  // ---------------------------------------------------------------------------
  // Effect 2 – 70 ms lux push loop
  // Streams the current sensor lux to the bridge so its PID / on-off controller
  // can adjust brightness in near-real-time.  Failures are silently swallowed
  // since the polling loop already handles bridge-offline state.
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (!Number.isFinite(currentLux)) return undefined;

    const send = async () => {
      try {
        await postJson('/sensor', { lux: currentLux });
      } catch (_) {
        // Bridge may be offline; the polling effect handles status updates.
      }
    };

    send();
    const id = setInterval(send, 70);
    return () => clearInterval(id);
  }, [currentLux, postJson]);

  // ---------------------------------------------------------------------------
  // Command helpers
  // All are wrapped in try/catch internally so callers (e.g. click handlers)
  // never receive an uncaught rejection even if the bridge is unreachable.
  // ---------------------------------------------------------------------------

  /**
   * applyTarget()
   * Sends the current targetInput value to the bridge as the new lux setpoint.
   * Called when the user submits the "Desired lux" form.
   */
  const applyTarget = useCallback(async () => {
    const target = Number(targetInput);
    if (!Number.isFinite(target)) return;
    try {
      await postJson('/target', { targetLux: target });
    } catch (_) {}
    setEditingTarget(false);
  }, [postJson, targetInput]);

  /**
   * setAutoEnabled(enabled)
   * Enables or disables the bridge's closed-loop adaptive controller.
   * Also called internally by startTemporaryAuto / tempAutoTarget effect.
   */
  const setAutoEnabled = useCallback(async (enabled) => {
    try {
      await postJson('/auto', { enabled });
    } catch (_) {}
  }, [postJson]);

  /**
   * setBrightness(brightness)
   * Directly sets bulb brightness (0–100) bypassing the adaptive controller.
   */
  const setBrightness = useCallback(async (brightness) => {
    try {
      await postJson('/brightness', { brightness: Number(brightness) });
    } catch (_) {}
  }, [postJson]);

  /**
   * setPower(on)
   * Turns the bulb on or off.
   */
  const setPower = useCallback(async (on) => {
    try {
      await postJson('/power', { on: Boolean(on) });
    } catch (_) {}
  }, [postJson]);

  /**
   * setTargetLevel(lux)
   * Updates the target lux both locally (targetInput) and on the bridge.
   * Used when a lighting profile or crew profile card is clicked while
   * adaptive control is already running.
   */
  const setTargetLevel = useCallback(async (lux) => {
    if (!Number.isFinite(lux)) return;
    setTargetInput(String(lux));
    try {
      await postJson('/target', { targetLux: Number(lux) });
    } catch (_) {}
    setEditingTarget(false);
  }, [postJson]);

  /**
   * startTemporaryAuto(lux)
   * Sets the lux target, enables adaptive control, and marks this as a
   * "temporary" session by storing the target in tempAutoTarget.
   * The effect below watches currentLux and automatically disables auto
   * once the bulb reaches the target (within toleranceLux).
   *
   * Used when a profile / crew card is clicked while auto is DISABLED —
   * the system briefly enables auto just to reach the requested level,
   * then hands control back to the user.
   */
  const startTemporaryAuto = useCallback(async (lux) => {
    await setTargetLevel(lux);
    await setAutoEnabled(true);
    setTempAutoTarget(Number(lux));
  }, [setTargetLevel, setAutoEnabled]);

  // ---------------------------------------------------------------------------
  // Effect 3 – Temporary auto termination
  // Watches bridge state to detect when the bulb has reached the temporary
  // target and automatically disables adaptive control.
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (tempAutoTarget !== null) {
      if (!bridge.autoEnabled) {
        // Auto was externally disabled — cancel the temporary session.
        setTempAutoTarget(null);
      } else if (bridge.currentLux !== null) {
        // Check if we're within the tolerance band (+1 for rounding margin).
        if (Math.abs(bridge.currentLux - tempAutoTarget) <= (bridge.toleranceLux || 5) + 1) {
          setAutoEnabled(false);   // target reached — return to manual mode
          setTempAutoTarget(null);
        }
      }
    }
  }, [bridge.currentLux, bridge.autoEnabled, bridge.toleranceLux, tempAutoTarget, setAutoEnabled]);

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------
  return {
    bridge,                 // full bridge state object
    bridgeReachable,        // HTTP reachability (not the same as bulb online)
    targetInput,            // controlled string for the target-lux input
    setTargetInput: (value) => {
      // Mark the field as being actively edited so polling doesn't overwrite it.
      setEditingTarget(true);
      setTargetInput(value);
    },
    applyTarget,
    setAutoEnabled,
    setBrightness,
    setPower,
    setTargetLevel,
    startTemporaryAuto,
    bridgeUrl: BASE_URL,    // exposed for debugging / display purposes
  };
}
