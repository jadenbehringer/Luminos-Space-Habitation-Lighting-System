import { useState, useEffect, useRef } from 'react';

export function useLiveData() {
  const startRef = useRef(Date.now());
  const histRef = useRef(Array.from({ length: 60 }, () => 300 + Math.random() * 100));

  const [data, setData] = useState({
    raw: 647,
    circadian: 280,
    fused: 312,
    lux: 150,
    history: histRef.current,
    servoPositions: [117, 81, 144, 36],
    mlWeights: [1.44, 1.1, 0.6],
    orbitPct: 47,
    orbitPhase: 'DAY',
    missionTime: '00:00:00',
    episode: 47,
    reward: 0.82,
    solarDelta: 2,
    solarAlert: false,
    alertLevel: null,
    activeProfile: 'circadian',
  });

  useEffect(() => {
    const interval = setInterval(() => {
      const t = (Date.now() - startRef.current) / 1000;

      const raw = Math.round(Math.min(1023, Math.max(0,
        600 + Math.sin(t / 15) * 150 + Math.sin(t / 5) * 30 + Math.random() * 15
      )));
      const circadian = Math.round(200 + Math.sin(t / 30) * 120);
      const fused = Math.round(raw * 0.7 + circadian * 0.3);
      const lux = Math.round(fused * 0.48);

      const prevFused = histRef.current[histRef.current.length - 1];
      const delta = fused - prevFused;
      const solarAlert = delta > 80;

      histRef.current = [...histRef.current.slice(1), fused];

      const orbitMs = (t * 1000) % 540000;
      const orbitPct = Math.round((orbitMs / 540000) * 100);
      const orbitPhase = orbitMs < 270000 ? 'DAY' : 'NIGHT';

      const elapsed = Math.floor(t);
      const h = String(Math.floor(elapsed / 3600)).padStart(2, '0');
      const m = String(Math.floor((elapsed % 3600) / 60)).padStart(2, '0');
      const s = String(elapsed % 60).padStart(2, '0');

      const s1 = Math.round(90 + Math.sin(t / 20) * 50);
      const s2 = Math.round(80 + Math.cos(t / 25) * 40);
      const s3 = Math.round(110 + Math.sin(t / 18) * 60);
      const s4 = Math.round(40 + Math.cos(t / 22) * 30);

      const w1 = parseFloat((1.0 + Math.sin(t / 40) * 0.5).toFixed(2));
      const w2 = parseFloat((1.0 + Math.cos(t / 35) * 0.4).toFixed(2));
      const w3 = parseFloat((0.8 + Math.sin(t / 50) * 0.3).toFixed(2));

      let activeProfile = 'circadian';
      if (lux >= 300) activeProfile = 'work';
      else if (lux < 30) activeProfile = 'sleep';

      // Three-level alert per NASA SSP_50005 ISS Human Integration Standard §9.4.4.3
      // Emergency (class 1) = solar flare; Caution (class 3) = lux out of tolerance
      const alertLevel = solarAlert ? 'emergency' : (lux > 450 || lux < 50) ? 'caution' : null;

      setData({
        raw,
        circadian,
        fused,
        lux,
        history: histRef.current,
        servoPositions: [s1, s2, s3, s4],
        mlWeights: [w1, w2, w3],
        orbitPct,
        orbitPhase,
        missionTime: `${h}:${m}:${s}`,
        episode: Math.floor(47 + t / 10),
        reward: parseFloat((0.7 + Math.sin(t / 12) * 0.25).toFixed(2)),
        solarDelta: Math.round(delta),
        solarAlert,
        alertLevel,
        activeProfile,
      });
    }, 150);

    return () => clearInterval(interval);
  }, []);

  return data;
}