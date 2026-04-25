/**
 * CrewPanel.js
 * ------------
 * Left sidebar panel displaying the astronaut crew roster.
 *
 * Each crew member card shows:
 *   • Designation + name callsign (e.g. "CDR CHEN, K.")
 *   • Current activity badge colour-coded by activity type
 *   • Target lux for that crew member's activity
 *
 * Clicking a card calls onCrewClick(member), which triggers Dashboard to
 * apply the member's targetLux to the Tapo bulb (same adaptive-control logic
 * used by ProfilesPanel).  The clicked card receives the `.active` highlight
 * class via the selectedCrewId prop.
 *
 * Props:
 *   onCrewClick(member)  – callback fired when a card is clicked
 *   selectedCrewId       – id string of the currently highlighted card (or null)
 */

import { CREW } from '../data/dummy';
import styles from './CrewPanel.module.css';

// Maps activityClass keys (from dummy.js) to background and text colours
// used to style each crew member's activity badge.
const activityColors = {
  work:     { bg: 'rgba(0,200,255,0.1)',   color: '#00c8ff' },  // cyan  — research/work
  sleep:    { bg: 'rgba(100,50,200,0.15)', color: '#a080ff' },  // purple — sleep
  eva:      { bg: 'rgba(255,200,0,0.1)',   color: '#ffc800' },  // amber  — EVA prep
  exercise: { bg: 'rgba(0,255,136,0.1)',   color: '#00ff88' },  // green  — exercise
};

export default function CrewPanel({ onCrewClick, selectedCrewId }) {
  return (
    <div className={styles.panel}>
      <div className={styles.label}>Astronaut profiles</div>

      {CREW.map(member => {
        // Resolve the activity colour palette for this crew member.
        const ac = activityColors[member.activityClass];

        return (
          <div
            key={member.id}
            // Apply the .active highlight when this card is the selected one.
            className={`${styles.card} ${selectedCrewId === member.id ? styles.active : ''}`}
            onClick={() => onCrewClick && onCrewClick(member)}
            style={{ cursor: 'pointer' }}
          >
            {/* Callsign: military-style "RANK LAST, F." */}
            <div className={styles.callsign}>{member.designation} {member.name}</div>

            {/* Activity badge — background and text colour driven by activityColors map */}
            <span className={styles.activity} style={{ background: ac.bg, color: ac.color }}>
              {member.activity}
            </span>

            {/* Target illuminance for this crew member's current task */}
            <div className={styles.meta}>
              Target lux: <span style={{ color: member.color, fontFamily: 'Space Mono, monospace' }}>{member.targetLux}</span>
            </div>

          </div>
        );
      })}
    </div>
  );
}