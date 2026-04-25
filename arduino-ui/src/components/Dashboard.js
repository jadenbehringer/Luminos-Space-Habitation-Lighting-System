/**
 * Dashboard.js
 * ------------
 * Root layout component for the AstroView adaptive window system UI.
 *
 * Composes all major panels into a three-column grid:
 *   Left  – CrewPanel      (astronaut profiles, clickable to set lux target)
 *   Center – TapoControlPanel + LightChart (bulb controls and lux history)
 *   Right – ProfilesPanel  (lighting scenes, clickable to set lux target)
 *
 * Data flows:
 *   useLiveData()    → simulation / serial sensor values → all panels
 *   useTapoBridge()  → bridge / bulb state and commands → TapoControlPanel
 *
 * Click handling strategy (same for both crew and lighting profiles):
 *   • If adaptive control is already ENABLED  → update the target lux only.
 *   • If adaptive control is DISABLED         → start a temporary auto session
 *     that enables adaptive control until the target is reached, then stops.
 *   • All bridge calls are fire-and-forget (errors silently swallowed) so the
 *     UI stays responsive even when the bulb / bridge is offline.
 *
 * Selection state:
 *   selectedCrewId    – id of the last-clicked crew member card
 *   selectedProfileId – id of the last-clicked lighting profile card
 *   Both start as null (no explicit selection); the profiles panel falls back
 *   to the auto-computed activeProfile from useLiveData when null.
 */

import { useState } from 'react';
import { useLiveData } from '../hooks/useLiveData';
import { useTapoBridge } from '../hooks/useTapoBridge';
import TopBar from './TopBar';
import CrewPanel from './CrewPanel';
import TapoControlPanel from './TapoControlPanel';
import LightChart from './LightChart';
import ProfilesPanel from './ProfilesPanel';
import styles from './Dashboard.module.css';

export default function Dashboard() {
  // Live sensor / simulation data (lux, history, serial status, etc.)
  const data = useLiveData();

  // Tapo bridge state and command helpers; receives current lux so the bridge
  // can run its closed-loop adaptive controller continuously.
  const bridgeData = useTapoBridge(data.lux);

  // --- Selection state ---
  // Tracks which crew / profile card was most recently clicked so the correct
  // card shows the active highlight.  Managed here (not inside the panels)
  // so both panels can share the same click-handler logic.
  const [selectedCrewId, setSelectedCrewId] = useState(null);
  const [selectedProfileId, setSelectedProfileId] = useState(null);

  // ---------------------------------------------------------------------------
  // handleProfileClick
  // Called when the user clicks a lighting profile card on the right panel.
  // Updates the visual selection and applies the profile's targetLux to the bulb.
  // ---------------------------------------------------------------------------
  const handleProfileClick = (profile) => {
    setSelectedProfileId(profile.id);          // update highlight immediately
    const target = profile.targetLux;
    try {
      if (bridgeData.bridge.autoEnabled) {
        // Adaptive control is already running — just shift the setpoint.
        bridgeData.setTargetLevel(target);
      } else {
        // Auto is off — run it temporarily until the target is reached.
        bridgeData.startTemporaryAuto(target);
      }
    } catch (_) {
      // Errors are also handled inside the bridge helpers; this outer catch is
      // a safety net for any synchronous exceptions.
    }
  };

  // ---------------------------------------------------------------------------
  // handleCrewClick
  // Called when the user clicks an astronaut profile card on the left panel.
  // Identical strategy to handleProfileClick but sources targetLux from the
  // crew member's activity-appropriate illuminance setting.
  // ---------------------------------------------------------------------------
  const handleCrewClick = (member) => {
    setSelectedCrewId(member.id);              // update highlight immediately
    const target = member.targetLux;
    try {
      if (bridgeData.bridge.autoEnabled) {
        bridgeData.setTargetLevel(target);
      } else {
        bridgeData.startTemporaryAuto(target);
      }
    } catch (_) {}
  };

  return (
    <div className={styles.dash}>
      {/* Top status bar: mission name, MET clock, serial/bridge/bulb status pills */}
      <TopBar
        missionTime={data.missionTime}
        serialSupported={data.serialSupported}
        serialConnected={data.serialConnected}
        serialError={data.serialError}
        onConnectSerial={data.connectSerial}
        bridgeReachable={bridgeData.bridgeReachable}
        bulbOnline={bridgeData.bridge.online}
      />

      {/* Three-column grid layout */}
      <div className={styles.grid}>

        {/* LEFT: Astronaut profiles — click to apply that crew member's lux target */}
        <CrewPanel onCrewClick={handleCrewClick} selectedCrewId={selectedCrewId} />

        {/* CENTER: Bulb controls and rolling lux history chart */}
        <div className={styles.center}>
          <TapoControlPanel
            lux={data.lux}
            bridgeData={bridgeData}
            writeSerial={data.writeSerial}
            detectedBlueLight={data.blue}   // live TCS34725 reading (null = sim mode)
          />
          <LightChart history={data.history} />
        </div>

        {/* RIGHT: Lighting profiles — click to apply the scene's lux target.
            selectedProfileId takes precedence; falls back to the auto-computed
            activeProfile (closest profile to current lux) when no card has
            been explicitly clicked yet. */}
        <ProfilesPanel
          activeProfile={selectedProfileId ?? data.activeProfile}
          onProfileClick={handleProfileClick}
        />
      </div>
    </div>
  );
}