import { useEffect, useState } from 'react';
import styles from './TapoControlPanel.module.css';

export default function TapoControlPanel({ lux, bridgeData, writeSerial }) {
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
  const [brightnessInput, setBrightnessInput] = useState(String(bridge.brightness ?? 0));
  const [windowFilter, setWindowFilter] = useState(50);
  const [effectiveFilter, setEffectiveFilter] = useState(50);

  useEffect(() => {
    setEffectiveFilter(prev => {
      const diff = windowFilter - prev;
      if (Math.abs(diff) < 0.5) return windowFilter;
      // 20% chance to hold value simulating measurement delay
      if (Math.random() < 0.2) return prev;
      // Otherwise move 15% to 35% of the remaining distance
      return prev + diff * (0.15 + Math.random() * 0.2);
    });
  }, [lux, windowFilter]);

  const t = Date.now() / 2000;
  const currentBlueLightLevel = Math.round(3500 - (3300 * (effectiveFilter / 100)));

  useEffect(() => {
    setBrightnessInput(String(Math.round(bridge.brightness ?? 0)));
  }, [bridge.brightness]);

  const onTargetSubmit = async (e) => {
    e.preventDefault();
    try {
      await applyTarget();
    } catch (_) {}
  };

  const onBrightnessSubmit = async (e) => {
    e.preventDefault();
    try {
      await setBrightness(brightnessInput);
    } catch (_) {}
  };

  const onWindowFilterChange = (e) => {
    const next = Number(e.target.value);
    setWindowFilter(next);
    if (writeSerial) {
      const angle = Math.round(180 - (next / 100) * 180);
      writeSerial(String(angle));
    }
  };

  return (
    <div className={styles.section}>
      <div className={styles.mainControlsRow}>
        {/* Main Combined Control Card (Lux, Brightness, Auto) */}
        <div className={styles.combinedCard}>
          <div className={styles.cardHeader}>Main Control</div>
          
          <div className={styles.topRow}>
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
              <button className={styles.btn} type="submit" disabled={!bridgeReachable}>Apply</button>
            </form>
          </div>

          <div className={styles.horizontalDivider} />

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

        {/* Indoor Lighting Card */}
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

      <div className={styles.currentLuxCard}>
        <div className={styles.currentStats}>
          <div className={styles.currentStat}>
            <div className={styles.currentLuxValue}>{Number(lux).toFixed(1)}</div>
            <div className={styles.panelName}>Current lux</div>
          </div>
          <div className={styles.currentStat}>
            <div className={`${styles.currentLuxValue} ${styles.blueText}`}>{currentBlueLightLevel}</div>
            <div className={styles.panelName}>Blue light level</div>
          </div>
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

      {bridge.lastError && <div className={styles.err}>{bridge.lastError}</div>}
    </div>
  );
}
