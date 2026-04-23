import { SERVOS, FILTERS } from '../data/dummy';
import styles from './ServosPanel.module.css';

export default function ServosPanel({ servoPositions, solarDelta, solarAlert }) {
  return (
    <div className={styles.panel}>
      <div className={styles.topLabel}>Window servos</div>

      {SERVOS.map((servo, i) => {
        const pos = servoPositions[i] ?? 90;
        const pct = Math.round((pos / 180) * 100);
        return (
          <div key={servo.id} className={styles.servoBlock}>
            <div className={styles.servoHeader}>
              <span className={styles.servoName}>{servo.name}</span>
              <span className={`${styles.badge} ${servo.live ? styles.badgeLive : styles.badgeSim}`}>
                {servo.live ? 'LIVE' : 'SIM'}
              </span>
            </div>
            <div className={styles.servoLoc}>{servo.location}</div>
            <div className={styles.barWrap}>
              <div
                className={styles.bar}
                style={{
                  width: `${pct}%`,
                  background: servo.live ? '#00c8ff' : 'rgba(0,200,255,0.25)',
                }}
              />
            </div>
            <div className={styles.servoVals}>
              <span>0°</span>
              <span style={{
                fontFamily: 'Space Mono, monospace',
                color: servo.live ? '#00c8ff' : 'rgba(200,216,240,0.85)',
              }}>
                {pos}°
              </span>
              <span>180°</span>
            </div>
          </div>
        );
      })}

      <div className={styles.filterBlock}>
        <div className={styles.subLabel}>Filter status</div>
        {FILTERS.map(f => (
          <div key={f.id} className={styles.filterRow}>
            <span className={styles.filterName}>{f.label}</span>
            {/* Redundant coding: shape (■ / ○) + color — not color alone */}
            <span className={`${styles.filterState} ${f.engaged ? styles.filterEngaged : styles.filterStandby}`}>
              <span className={styles.filterIcon}>{f.engaged ? '■' : '○'}</span>
              {f.engaged ? 'ENGAGED' : 'STANDBY'}
            </span>
          </div>
        ))}
      </div>

      <div className={styles.flareBlock}>
        <div className={styles.subLabel}>Solar flare detect</div>
        {/* Redundant coding: shape changes (■ alert vs ● nominal) + color */}
        <div className={styles.flareStatus}>
          <span className={`${styles.flareIcon} ${solarAlert ? styles.flareIconAlert : styles.flareIconNominal}`}>
            {solarAlert ? '■' : '●'}
          </span>
          <span className={solarAlert ? styles.flareTextAlert : styles.flareTextNominal}>
            {solarAlert ? 'EMERGENCY — SOLAR FLARE' : 'NO ANOMALY'}
          </span>
        </div>
        <div className={styles.delta}>DELTA: {solarDelta > 0 ? '+' : ''}{solarDelta} / reading</div>
      </div>
    </div>
  );
}