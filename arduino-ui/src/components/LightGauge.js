import styles from './LightGauge.module.css';

const CIRCUMFERENCE = 408;
const TARGET_LOW = 150;   // lux
const TARGET_HIGH = 400;  // lux
// lux = fused * 0.48, so threshold in fused units:
const FUSED_LOW  = TARGET_LOW  / 0.48;  // ~312
const FUSED_HIGH = TARGET_HIGH / 0.48;  // ~833

export default function LightGauge({ lux, raw, circadian, fused }) {
  const pct = Math.min(1, fused / 1023);
  const offset = CIRCUMFERENCE - pct * CIRCUMFERENCE;

  // Primary arc color — amber = above limit, cyan = nominal, purple = below limit
  const color = lux > TARGET_HIGH ? '#ffc800' : lux > TARGET_LOW ? '#00c8ff' : '#a080ff';

  // Status text + color for redundant coding (shape/text alongside color)
  let luxStatus, statusColor;
  if (lux > TARGET_HIGH) {
    luxStatus = 'ABOVE LIMIT';
    statusColor = '#ffc800';
  } else if (lux < TARGET_LOW) {
    luxStatus = 'BELOW LIMIT';
    statusColor = '#a080ff';
  } else {
    luxStatus = 'NOMINAL';
    statusColor = 'rgba(0,255,136,0.75)';
  }

  // Target zone arc: green band showing the 150–400 lux acceptable range
  const pctLow  = Math.min(1, FUSED_LOW  / 1023);  // 0.305
  const pctHigh = Math.min(1, FUSED_HIGH / 1023);  // 0.814
  const zoneLen    = (pctHigh - pctLow) * CIRCUMFERENCE;
  const zoneStart  = pctLow * CIRCUMFERENCE;
  const zoneOffset = CIRCUMFERENCE - zoneStart;

  // Delta from target (320 lux) for proximity-compatible display
  const delta = lux - 320;
  const deltaStr = `${delta >= 0 ? '+' : ''}${delta}`;

  return (
    <div className={styles.section}>
      <div className={styles.gaugeWrap}>
        <svg width="160" height="160" viewBox="0 0 160 160"
          aria-label={`Light level gauge: ${lux} lux, ${luxStatus}`}>

          {/* Track ring */}
          <circle cx="80" cy="80" r="65" fill="none"
            stroke="rgba(0,180,255,0.07)" strokeWidth="10" />

          {/* Target zone arc — memory aid: shows acceptable 150–400 lux range */}
          <circle cx="80" cy="80" r="65" fill="none"
            stroke="rgba(0,255,136,0.12)" strokeWidth="10"
            strokeDasharray={`${zoneLen} ${CIRCUMFERENCE - zoneLen}`}
            strokeDashoffset={zoneOffset}
            transform="rotate(-90 80 80)"
          />

          {/* Active level arc */}
          <circle cx="80" cy="80" r="65" fill="none"
            stroke={color} strokeWidth="10"
            strokeDasharray={CIRCUMFERENCE}
            strokeDashoffset={offset}
            strokeLinecap="round"
            transform="rotate(-90 80 80)"
            style={{ transition: 'stroke-dashoffset 0.8s ease, stroke 0.8s ease' }}
          />

          <circle cx="80" cy="80" r="50" fill="none"
            stroke="rgba(0,180,255,0.05)" strokeWidth="1" />
        </svg>

        <div className={styles.center}>
          <div className={styles.value} style={{ color }}>{lux}</div>
          <div className={styles.unit}>LUX</div>
          {/* Redundant status label: text + color, not color alone */}
          <div className={styles.statusLabel} style={{ color: statusColor }}>
            {luxStatus}
          </div>
        </div>
      </div>

      <div className={styles.stats}>
        <div className={styles.statBox}>
          <div className={styles.statLabel}>Raw sensor</div>
          <div className={styles.statValue} style={{ color: '#00c8ff' }}>{raw}</div>
          <div className={styles.statSub}>/ 1023</div>
        </div>
        <div className={styles.statBox}>
          <div className={styles.statLabel}>Target lux</div>
          <div className={styles.statValue} style={{ color: '#00ff88' }}>320</div>
          {/* Delta from target — proximity-compatible: related values grouped */}
          <div className={styles.statSub} style={{ color: delta === 0 ? 'rgba(0,255,136,0.5)' : delta > 0 ? '#ffc800' : '#a080ff' }}>
            {deltaStr} from target
          </div>
        </div>
        <div className={styles.statBox}>
          <div className={styles.statLabel}>Circadian input</div>
          <div className={styles.statValue} style={{ color: '#a080ff' }}>{circadian}</div>
        </div>
        <div className={styles.statBox}>
          <div className={styles.statLabel}>Fused output</div>
          <div className={styles.statValue} style={{ color: '#ffc800' }}>{fused}</div>
        </div>
      </div>
    </div>
  );
}
