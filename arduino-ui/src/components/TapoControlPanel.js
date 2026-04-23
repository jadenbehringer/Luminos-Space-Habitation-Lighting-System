import { useEffect, useState } from 'react';
import styles from './TapoControlPanel.module.css';

export default function TapoControlPanel({ lux, bridgeData }) {
  const {
    bridge,
    bridgeReachable,
    targetInput,
    setTargetInput,
    applyTarget,
    setBrightness,
    setAutoEnabled,
  } = bridgeData;
  const [brightnessInput, setBrightnessInput] = useState(String(bridge.brightness ?? 0));
  const [windowFilter, setWindowFilter] = useState(50);
  const currentBlueLightLevel = Math.max(0, Math.min(100, Math.round((Number(lux) || 0) * 0.18)));

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
  };

  return (
    <div className={styles.section}>
      <div className={styles.controlsGrid}>
        <form onSubmit={onTargetSubmit} className={styles.controlCard}>
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
          <div className={styles.panelName}>Desired lux</div>
        </form>

        <form onSubmit={onBrightnessSubmit} className={styles.controlCard}>
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
          <div className={styles.panelName}>Brightness</div>
        </form>

        <div className={styles.controlCard}>
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
          <div className={styles.panelName}>Window filter status</div>
        </div>

        <div className={styles.controlCard}>
          <div className={styles.autoState}>
            {bridge.autoEnabled ? 'Enabled' : 'Disabled'}
          </div>
          <button
            className={`${styles.btn} ${bridge.autoEnabled ? styles.enabledBtn : ''}`}
            type="button"
            onClick={() => setAutoEnabled(!bridge.autoEnabled)}
            disabled={!bridgeReachable}
          >
            {bridge.autoEnabled ? 'Disable' : 'Enable'}
          </button>
          <div className={styles.panelName}>Adaptive light control</div>
        </div>
      </div>

      <div className={styles.currentLuxCard}>
        <div className={styles.currentStats}>
          <div className={styles.currentStat}>
            <div className={styles.currentLuxValue}>{Number(lux).toFixed(1)}</div>
            <div className={styles.panelName}>Current lux</div>
          </div>
          <div className={styles.currentStat}>
            <div className={styles.currentLuxValue}>{currentBlueLightLevel}</div>
            <div className={styles.panelName}>Blue light level</div>
          </div>
        </div>
      </div>

      {bridge.lastError && <div className={styles.err}>{bridge.lastError}</div>}
    </div>
  );
}
