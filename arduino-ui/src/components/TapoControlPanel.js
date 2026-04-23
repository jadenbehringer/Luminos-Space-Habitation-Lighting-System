import { useTapoBridge } from '../hooks/useTapoBridge';
import styles from './TapoControlPanel.module.css';

export default function TapoControlPanel({ lux }) {
  const {
    bridge,
    bridgeReachable,
    targetInput,
    setTargetInput,
    applyTarget,
    setAutoEnabled,
    bridgeUrl,
  } = useTapoBridge(lux);

  const onSubmit = async (e) => {
    e.preventDefault();
    try {
      await applyTarget();
    } catch (_) {}
  };

  return (
    <div className={styles.section}>
      <div className={styles.label}>Tapo adaptive lux control</div>

      <div className={styles.row}>
        <span className={styles.k}>Bridge</span>
        <span className={bridgeReachable ? styles.ok : styles.bad}>
          {bridgeReachable ? 'ONLINE' : 'OFFLINE'}
        </span>
      </div>

      <div className={styles.row}>
        <span className={styles.k}>Bulb session</span>
        <span className={bridge.online ? styles.ok : styles.bad}>
          {bridge.online ? 'CONNECTED' : 'DISCONNECTED'}
        </span>
      </div>

      <form onSubmit={onSubmit} className={styles.form}>
        <label className={styles.inputLabel} htmlFor="target-lux">Desired lux</label>
        <div className={styles.inputWrap}>
          <input
            id="target-lux"
            className={styles.input}
            type="number"
            min="0"
            max="2000"
            value={targetInput}
            onChange={(e) => setTargetInput(e.target.value)}
          />
          <button className={styles.btn} type="submit">Set target</button>
        </div>
      </form>

      <div className={styles.row}>
        <span className={styles.k}>Auto control</span>
        <button
          className={`${styles.btn} ${bridge.autoEnabled ? styles.warn : ''}`}
          type="button"
          onClick={() => setAutoEnabled(!bridge.autoEnabled)}
          disabled={!bridgeReachable}
        >
          {bridge.autoEnabled ? 'Disable' : 'Enable'}
        </button>
      </div>

      <div className={styles.stats}>
        <div><span className={styles.k}>Current lux</span><span>{Number(lux).toFixed(1)}</span></div>
        <div><span className={styles.k}>Target lux</span><span>{Number(bridge.targetLux ?? 0).toFixed(1)}</span></div>
        <div><span className={styles.k}>Brightness</span><span>{bridge.brightness}%</span></div>
        <div><span className={styles.k}>Limits</span><span>{bridge.minBrightness}%–{bridge.maxBrightness}%</span></div>
        <div><span className={styles.k}>Tolerance</span><span>±{bridge.toleranceLux} lux</span></div>
      </div>

      <div className={styles.msg}>{bridge.lastAction || 'idle'}</div>
      {bridge.lastError && <div className={styles.err}>{bridge.lastError}</div>}
      <div className={styles.url}>{bridgeUrl}</div>
    </div>
  );
}
