/**
 * LightGauge.js
 * -------------
 * Circular SVG gauge displaying the current lux level and supporting
 * light-sensor metrics.
 *
 * Visual elements:
 *   • Track ring         – full 360° background ring (dim, non-interactive)
 *   • Target zone arc    – green band spanning the 150–400 lux acceptable range
 *                          so operators can judge at a glance whether the level
 *                          is in the nominal operating window
 *   • Active level arc   – coloured arc from 0° to the current lux fraction;
 *                          colour changes to reinforce the status label:
 *                            cyan   = NOMINAL (150–400 lux)
 *                            amber  = ABOVE LIMIT (> 400 lux)
 *                            purple = BELOW LIMIT (< 150 lux)
 *   • Center readout     – numeric lux value + status label (text + colour for
 *                          redundant coding per NASA human-factors guidelines)
 *   • Stat boxes         – Raw sensor, Target lux (+delta), Circadian input, Fused output
 *
 * Constants:
 *   CIRCUMFERENCE  – arc length of the r=65 circle (2π × 65 ≈ 408 px)
 *   TARGET_LOW     – lower bound of the nominal lux operating range
 *   TARGET_HIGH    – upper bound of the nominal lux operating range
 *   FUSED_LOW/HIGH – corresponding thresholds in fused (0–1023) units
 *
 * Props:
 *   lux       – current illuminance in lux
 *   raw       – raw 12-bit ADC sensor reading (0–1023)
 *   circadian – circadian model output (0–320 range in simulation)
 *   fused     – data-fusion output blending raw + circadian
 */

import styles from './LightGauge.module.css';

// Circumference of the SVG arc circle (r = 65): 2π × 65 ≈ 408
const CIRCUMFERENCE = 408;

// Nominal illuminance operating range (lux) per mission lighting specification.
const TARGET_LOW  = 150;   // lux — minimum acceptable for general crew tasks
const TARGET_HIGH = 400;   // lux — maximum before glare / sleep disruption risk

// Convert lux thresholds to fused (0–1023 ADC) units using the inverse of the
// lux = fused × 0.48 approximation used in the simulation loop.
const FUSED_LOW  = TARGET_LOW  / 0.48;  // ≈ 312 ADC counts
const FUSED_HIGH = TARGET_HIGH / 0.48;  // ≈ 833 ADC counts

export default function LightGauge({ lux, raw, circadian, fused }) {
  // ---------------------------------------------------------------------------
  // Arc geometry
  // ---------------------------------------------------------------------------

  // Fraction of the full arc to fill (clamped to [0, 1]).
  const pct = Math.min(1, fused / 1023);
  // strokeDashoffset controls how much of the CIRCUMFERENCE is "invisible";
  // setting it to (CIRCUMFERENCE − drawn length) starts the arc at the top.
  const offset = CIRCUMFERENCE - pct * CIRCUMFERENCE;

  // ---------------------------------------------------------------------------
  // Colour + status label (redundant coding: colour AND text, not colour alone)
  // Follows NASA SSP_50005 ISS Human Integration Standard colour usage rules.
  // ---------------------------------------------------------------------------
  const color = lux > TARGET_HIGH ? '#ffc800' : lux > TARGET_LOW ? '#00c8ff' : '#a080ff';

  let luxStatus, statusColor;
  if (lux > TARGET_HIGH) {
    luxStatus = 'ABOVE LIMIT';
    statusColor = '#ffc800';  // amber — caution, too bright
  } else if (lux < TARGET_LOW) {
    luxStatus = 'BELOW LIMIT';
    statusColor = '#a080ff';  // purple — caution, too dim
  } else {
    luxStatus = 'NOMINAL';
    statusColor = 'rgba(0,255,136,0.75)';  // green — within acceptable range
  }

  // ---------------------------------------------------------------------------
  // Target zone arc geometry
  // Draws a semi-transparent green band over the 150–400 lux region of the ring
  // so operators can read nominal boundaries without looking at the numbers.
  // ---------------------------------------------------------------------------
  const pctLow  = Math.min(1, FUSED_LOW  / 1023);  // ≈ 0.305 of full arc
  const pctHigh = Math.min(1, FUSED_HIGH / 1023);  // ≈ 0.814 of full arc
  const zoneLen    = (pctHigh - pctLow) * CIRCUMFERENCE;   // length of green band
  const zoneStart  = pctLow * CIRCUMFERENCE;               // start offset from top
  const zoneOffset = CIRCUMFERENCE - zoneStart;             // SVG dashoffset value

  // ---------------------------------------------------------------------------
  // Delta from target lux (320 = midpoint of nominal range)
  // Displayed as "+42" or "−17" to give operators quick proximity feedback.
  // ---------------------------------------------------------------------------
  const delta = lux - 320;
  const deltaStr = `${delta >= 0 ? '+' : ''}${delta}`;

  return (
    <div className={styles.section}>
      <div className={styles.gaugeWrap}>

        {/* SVG circular gauge */}
        <svg width="160" height="160" viewBox="0 0 160 160"
          aria-label={`Light level gauge: ${lux} lux, ${luxStatus}`}>

          {/* Track ring — full 360° background so the arc has a visible rail */}
          <circle cx="80" cy="80" r="65" fill="none"
            stroke="rgba(0,180,255,0.07)" strokeWidth="10" />

          {/* Target zone arc — green band showing the 150–400 lux nominal range.
              Rendered below the active arc so it acts as a reference overlay. */}
          <circle cx="80" cy="80" r="65" fill="none"
            stroke="rgba(0,255,136,0.12)" strokeWidth="10"
            strokeDasharray={`${zoneLen} ${CIRCUMFERENCE - zoneLen}`}
            strokeDashoffset={zoneOffset}
            transform="rotate(-90 80 80)"
          />

          {/* Active level arc — fills clockwise from 12 o'clock to current lux %.
              Smooth CSS transition avoids jarring jumps on fast data updates. */}
          <circle cx="80" cy="80" r="65" fill="none"
            stroke={color} strokeWidth="10"
            strokeDasharray={CIRCUMFERENCE}
            strokeDashoffset={offset}
            strokeLinecap="round"
            transform="rotate(-90 80 80)"
            style={{ transition: 'stroke-dashoffset 0.8s ease, stroke 0.8s ease' }}
          />

          {/* Inner decorative ring — subtle depth effect */}
          <circle cx="80" cy="80" r="50" fill="none"
            stroke="rgba(0,180,255,0.05)" strokeWidth="1" />
        </svg>

        {/* Center text readout */}
        <div className={styles.center}>
          {/* Primary lux value — coloured to match the arc */}
          <div className={styles.value} style={{ color }}>{lux}</div>
          <div className={styles.unit}>LUX</div>
          {/* Redundant status label: text + colour, satisfying two-channel coding */}
          <div className={styles.statusLabel} style={{ color: statusColor }}>
            {luxStatus}
          </div>
        </div>
      </div>

      {/* Metric stat boxes below the gauge */}
      <div className={styles.stats}>

        {/* Raw sensor ADC value (0–1023) */}
        <div className={styles.statBox}>
          <div className={styles.statLabel}>Raw sensor</div>
          <div className={styles.statValue} style={{ color: '#00c8ff' }}>{raw}</div>
          <div className={styles.statSub}>/ 1023</div>
        </div>

        {/* Target lux + delta from the 320 lux nominal midpoint */}
        <div className={styles.statBox}>
          <div className={styles.statLabel}>Target lux</div>
          <div className={styles.statValue} style={{ color: '#00ff88' }}>320</div>
          {/* Delta colour: green = on target, amber = above, purple = below */}
          <div className={styles.statSub} style={{ color: delta === 0 ? 'rgba(0,255,136,0.85)' : delta > 0 ? '#ffc800' : '#a080ff' }}>
            {deltaStr} from target
          </div>
        </div>

        {/* Circadian rhythm model output */}
        <div className={styles.statBox}>
          <div className={styles.statLabel}>Circadian input</div>
          <div className={styles.statValue} style={{ color: '#a080ff' }}>{circadian}</div>
        </div>

        {/* Data-fusion output (weighted blend of raw + circadian) */}
        <div className={styles.statBox}>
          <div className={styles.statLabel}>Fused output</div>
          <div className={styles.statValue} style={{ color: '#ffc800' }}>{fused}</div>
        </div>
      </div>
    </div>
  );
}
