/**
 * TapoControlPanel.js
 * -------------------
 * Center-panel control surface for the Tapo smart bulb and window filter servo.
 *
 * Three control areas:
 *
 * 1. Main Control card (top)
 *    • Desired lux input + Apply button  → sends target to bridge via applyTarget()
 *    • Brightness input + Apply button   → directly sets bulb brightness %
 *    • Adaptive light control toggle     → enables / disables bridge PID controller
 *
 * 2. Indoor lighting card (top-right)
 *    • Power on / off toggle for the bulb
 *
 * 3. Current stats card (bottom)
 *    • Current lux reading (from useLiveData)
 *    • Blue light level (see below)
 *    • Window filter slider (0–100 %) → maps to servo angle and sends via writeSerial
 *
 * Blue light level display:
 *    Priority 1 — detectedBlueLight prop (live TCS34725 raw counts from the Arduino)
 *    Priority 2 — generatedBlueLightLevel (mathematical estimate based on slider %)
 *    The generated fallback formula:  3500 − (3300 × filterPct/100)
 *      At 0 % filter → 3500 counts (maximum blue light)
 *      At 100 % filter → 200 counts (heavily attenuated)
 *
 * Props:
 *   lux                – current ambient illuminance (number) from useLiveData
 *   bridgeData         – full object returned by useTapoBridge
 *   writeSerial(text)  – sends a string to the Arduino over Web Serial
 *   detectedBlueLight  – live TCS34725 blue channel count (null if not connected)
 */

import { useEffect, useState } from 'react';
import styles from './TapoControlPanel.module.css';

export default function TapoControlPanel({ lux, bridgeData, writeSerial, detectedBlueLight }) {
  // Destructure the bridge API surface from the bridgeData object so this
  // component doesn't need to know about the hook's internal structure.
  const {
    bridge,
    bridgeReachable,
    targetInput,
    setTargetInput,
    applyTarget,
    setBrightness,
    setAutoEnabled,
    setPower,
  } = bridgeData;

  // Local controlled input for the brightness field (string to allow partial entry).
  const [brightnessInput, setBrightnessInput] = useState(String(bridge.brightness ?? 0));

  // Slider-driven filter percentage (0 = no filter, 100 = fully attenuated).
  // This is the *intended* position set by the user.
  const [windowFilter, setWindowFilter] = useState(50);

  // Simulated "effective" filter position that lags behind windowFilter to mimic
  // mechanical delay in the servo / filter assembly.
  const [effectiveFilter, setEffectiveFilter] = useState(50);

  // ---------------------------------------------------------------------------
  // Simulate servo lag / measurement delay
  // Each time lux or windowFilter changes we stochastically move effectiveFilter
  // 15–35 % closer to the target, with a 20 % chance of holding still (mimicking
  // mechanical inertia and sensor jitter).
  // ---------------------------------------------------------------------------
  useEffect(() => {
    setEffectiveFilter(prev => {
      const diff = windowFilter - prev;
      if (Math.abs(diff) < 0.5) return windowFilter;  // close enough — snap to target
      if (Math.random() < 0.2) return prev;             // 20 % chance of no movement
      return prev + diff * (0.15 + Math.random() * 0.2);
    });
  }, [lux, windowFilter]);

  // ---------------------------------------------------------------------------
  // Blue light level
  // generatedBlueLightLevel: linear model mapping filter position → blue counts.
  //   At 0 %   filter: 3500 (unfiltered, maximum blue light)
  //   At 100 % filter: 200  (maximum attenuation)
  // currentBlueLightLevel: uses the live sensor reading when available; falls
  //   back to the generated value in simulation / disconnected mode.
  // ---------------------------------------------------------------------------
  const generatedBlueLightLevel = Math.round(3500 - (3300 * (effectiveFilter / 100)));
  const currentBlueLightLevel = detectedBlueLight !== null ? detectedBlueLight : generatedBlueLightLevel;

  // Keep the brightness input in sync with bridge state updates from polling.
  // Only fires when bridge.brightness changes (not on every render).
  useEffect(() => {
    setBrightnessInput(String(Math.round(bridge.brightness ?? 0)));
  }, [bridge.brightness]);

  // ---------------------------------------------------------------------------
  // Form submit handlers
  // ---------------------------------------------------------------------------

  /** Submits the desired-lux form → sends new target to bridge. */
  const onTargetSubmit = async (e) => {
    e.preventDefault();
    try {
      await applyTarget();
    } catch (_) {}
  };

  /** Submits the brightness form → directly sets bulb brightness %. */
  const onBrightnessSubmit = async (e) => {
    e.preventDefault();
    try {
      await setBrightness(brightnessInput);
    } catch (_) {}
  };

  // ---------------------------------------------------------------------------
  // Window filter slider handler
  // Maps the 0–100 % slider value to a servo angle and transmits it over Serial.
  // Angle formula: 0 % filter → 180° (fully open), 100 % filter → 0° (fully closed).
  // ---------------------------------------------------------------------------
  const onWindowFilterChange = (e) => {
    const next = Number(e.target.value);
    setWindowFilter(next);
    if (writeSerial) {
      // Invert the percentage: more filter = lower servo angle.
      const angle = Math.round(180 - (next / 100) * 180);
      writeSerial(String(angle));
    }
  };

  return (
    <div className={styles.section}>
      <div className={styles.mainControlsRow}>

        {/* ----------------------------------------------------------------- */}
        {/* Main Combined Control Card                                         */}
        {/* ----------------------------------------------------------------- */}
        <div className={styles.combinedCard}>
          <div className={styles.cardHeader}>Main Control</div>

          <div className={styles.topRow}>
            {/* Desired lux input — sets the adaptive controller's lux setpoint */}
            <form onSubmit={onTargetSubmit} className={styles.subControl}>
              <div className={styles.panelName}>Desired lux</div>
              <input
                id="target-lux"
                className={styles.bigInput}
                type="number"
                min="0"
                max="2000"
                value={targetInput}
                onChange={(e) => setTargetInput(e.target.value)}
                aria-label="Desired lux"
              />
              <button className={styles.btn} type="submit">Apply</button>
            </form>

            <div className={styles.divider} />

            {/* Brightness input — bypasses adaptive control for manual override */}
            <form onSubmit={onBrightnessSubmit} className={styles.subControl}>
              <div className={styles.panelName}>Brightness</div>
              <input
                id="brightness"
                className={styles.bigInput}
                type="number"
                min="0"
                max="100"
                value={brightnessInput}
                onChange={(e) => setBrightnessInput(e.target.value)}
                aria-label="Brightness"
              />
              {/* Disabled when bridge is unreachable to prevent misleading feedback */}
              <button className={styles.btn} type="submit" disabled={!bridgeReachable}>Apply</button>
            </form>
          </div>

          <div className={styles.horizontalDivider} />

          {/* Adaptive light control toggle */}
          <div className={styles.bottomRow}>
            <div className={styles.adaptiveInfo}>
              <div className={styles.panelName}>Adaptive light control</div>
              <div className={`${styles.autoState} ${!bridge.autoEnabled ? styles.disabledText : ''}`}>
                {bridge.autoEnabled ? 'ENABLED' : 'DISABLED'}
              </div>
            </div>
            <button
              className={`${styles.toggleBtn} ${bridge.autoEnabled ? styles.negativeBtn : styles.enabledBtn}`}
              type="button"
              onClick={() => setAutoEnabled(!bridge.autoEnabled)}
              disabled={!bridgeReachable}
            >
              {bridge.autoEnabled ? 'Disable' : 'Enable'}
            </button>
          </div>
        </div>

        {/* ----------------------------------------------------------------- */}
        {/* Indoor Lighting Power Card                                          */}
        {/* ----------------------------------------------------------------- */}
        <div className={styles.controlCard}>
          <div className={styles.panelName}>Indoor lighting</div>
          <div className={`${styles.autoState} ${!bridge.powerOn ? styles.disabledText : ''}`}>
            {bridge.powerOn ? 'ON' : 'OFF'}
          </div>
          <button
            className={`${styles.toggleBtn} ${bridge.powerOn ? styles.negativeBtn : styles.powerOnBtn}`}
            type="button"
            onClick={() => setPower(!bridge.powerOn)}
            disabled={!bridgeReachable}
          >
            Turn {bridge.powerOn ? 'Off' : 'On'}
          </button>
        </div>
      </div>

      {/* ------------------------------------------------------------------- */}
      {/* Current Stats Card (lux, blue light level, filter slider)            */}
      {/* ------------------------------------------------------------------- */}
      <div className={styles.currentLuxCard}>
        <div className={styles.currentStats}>

          {/* Current lux — sourced from useLiveData (live sensor or simulation) */}
          <div className={styles.currentStat}>
            <div className={styles.currentLuxValue}>{Number(lux).toFixed(1)}</div>
            <div className={styles.panelName}>Current lux</div>
          </div>

          {/* Blue light level — live TCS34725 reading or generated estimate */}
          <div className={styles.currentStat}>
            <div className={`${styles.currentLuxValue} ${styles.blueText}`}>{currentBlueLightLevel}</div>
            <div className={styles.panelName}>Blue light level</div>
          </div>

          {/* Window filter slider — dragging sends a servo angle over Serial */}
          <div className={styles.currentStat}>
            <div className={styles.sliderContainer}>
              <div className={styles.sliderValue}>{windowFilter}%</div>
              <input
                className={styles.slider}
                type="range"
                min="0"
                max="100"
                value={windowFilter}
                onChange={onWindowFilterChange}
                aria-label="Window filter status"
              />
            </div>
            <div className={styles.panelName}>Blue light filter slider</div>
          </div>
        </div>
      </div>

      {/* Bridge error display — only shown when the bridge reports an error */}
      {bridge.lastError && <div className={styles.err}>{bridge.lastError}</div>}
    </div>
  );
}
