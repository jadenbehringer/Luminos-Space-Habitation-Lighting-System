/**
 * ProfilesPanel.js
 * ----------------
 * Right sidebar panel listing all predefined lighting profiles.
 *
 * Profiles are sorted ascending by targetLux so cards are ordered from
 * darkest (SLEEP) to brightest (RESEARCH), giving the user an intuitive
 * brightness ramp to scan.
 *
 * Clicking a card calls onProfileClick(profile), which triggers Dashboard
 * to apply the profile's targetLux to the Tapo bulb using the same
 * adaptive-control logic as the crew panel.
 *
 * The active highlight is driven by the activeProfile prop, which is either:
 *   • selectedProfileId  – the id of the last explicitly clicked card, OR
 *   • data.activeProfile – the profile whose targetLux is closest to the
 *                          current sensor lux (auto-computed in useLiveData).
 *
 * Props:
 *   activeProfile          – id string of the profile card to highlight
 *   onProfileClick(profile) – callback fired when a card is clicked
 */

import { PROFILES } from '../data/dummy';
import styles from './ProfilesPanel.module.css';

export default function ProfilesPanel({ activeProfile, onProfileClick }) {
  // Sort a copy of PROFILES so the original array order is preserved elsewhere.
  const sortedProfiles = [...PROFILES].sort((a, b) => a.targetLux - b.targetLux);

  return (
    <div className={styles.section}>
      <div className={styles.label}>Lighting profiles</div>

      <div className={styles.grid}>
        {sortedProfiles.map((p) => (
          <div
            key={p.id}
            // Highlight the card whose id matches the current active/selected profile.
            className={`${styles.card} ${activeProfile === p.id ? styles.active : ''}`}
            onClick={() => onProfileClick && onProfileClick(p)}
          >
            {/* Active indicator dot — shown only on the highlighted card */}
            {activeProfile === p.id && <div className={styles.activeDot} />}

            {/* Card header: emoji icon + profile name */}
            <div className={styles.header}>
              <div className={styles.icon}>{p.icon}</div>
              <div className={styles.name}>{p.name}</div>
            </div>

            {/* Target lux value for this lighting scene */}
            <div className={styles.metricRow}>
              <span className={styles.metricLabel}>Lux</span>
              <span className={`${styles.metricValue} ${styles.luxValue}`}>{p.targetLux}</span>
            </div>

            {/* Expected blue-light level (raw TCS34725 counts) for this scene.
                Used as the generated fallback in TapoControlPanel when the
                physical blue-light sensor is not connected. */}
            <div className={styles.metricRow}>
              <span className={`${styles.metricLabel} ${styles.blueValue}`}>Blue</span>
              <span className={`${styles.metricValue} ${styles.blueValue}`}>{p.blueLightLevel}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}