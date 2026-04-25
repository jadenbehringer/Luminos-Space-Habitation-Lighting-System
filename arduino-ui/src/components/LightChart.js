/**
 * LightChart.js
 * -------------
 * Area chart showing a rolling 60-second lux history.
 *
 * Data:
 *   history – array of 60 lux values from useLiveData (oldest → newest, left → right).
 *   Each value is mapped to { i, v } where i is the array index (used as the X key)
 *   and v is the rounded lux value plotted on the Y axis.
 *
 * Chart config:
 *   • Y axis fixed to [0, 1023] to match the 12-bit sensor range so the scale
 *     never jumps when lux changes — operators can read trends at a glance.
 *   • X axis hidden (the window is always "last 60 seconds", no labels needed).
 *   • Animation disabled (isAnimationActive={false}) to prevent chart jitter
 *     at the 150 ms update rate used by useLiveData.
 *   • Custom tooltip styled to match the dashboard dark colour palette.
 *
 * Props:
 *   history – number[] of length 60 (rolling lux samples)
 */

import { AreaChart, Area, XAxis, YAxis, ResponsiveContainer, Tooltip } from 'recharts';
import styles from './LightChart.module.css';

/**
 * CustomTooltip
 * Recharts injects `active` and `payload` when the user hovers over the chart.
 * Renders a dark-themed bubble showing the lux value at the hovered position.
 */
const CustomTooltip = ({ active, payload }) => {
  if (active && payload && payload.length) {
    return (
      <div style={{
        background: 'rgba(0,20,50,0.95)',
        border: '0.5px solid rgba(0,200,255,0.3)',
        borderRadius: 6,
        padding: '6px 10px',
        fontFamily: 'Space Mono, monospace',
        fontSize: 15,
        color: '#00c8ff',
      }}>
        {Math.round(payload[0].value)}
      </div>
    );
  }
  return null;
};

export default function LightChart({ history }) {
  // Convert the raw lux array to the { i, v } shape expected by Recharts.
  // Math.round ensures the Y axis tooltip shows clean integers.
  const chartData = history.map((v, i) => ({ i, v: Math.round(v) }));

  return (
    <div className={styles.section}>
      <div className={styles.label}>Lux history — 60s window</div>
      <div className={styles.chartWrap}>
        <ResponsiveContainer width="100%" height={120}>
          <AreaChart data={chartData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
            <defs>
              {/* Gradient fill: opaque at top → fully transparent at bottom */}
              <linearGradient id="lightGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor="#00c8ff" stopOpacity={0.2} />
                <stop offset="95%" stopColor="#00c8ff" stopOpacity={0} />
              </linearGradient>
            </defs>

            {/* X axis: index-based, hidden — the label "60s window" provides context */}
            <XAxis dataKey="i" hide />

            {/* Y axis: fixed 0–1023 scale, minimal tick styling */}
            <YAxis
              domain={[0, 1023]}
              tick={{ fill: 'rgba(200,216,240, 0.95)', fontSize: 12, fontFamily: 'Space Mono' }}
              tickLine={false}
              axisLine={false}
            />

            {/* Custom tooltip rendered on hover */}
            <Tooltip content={<CustomTooltip />} />

            {/* Area series: cyan line + gradient fill, no dots, no animation */}
            <Area
              type="monotone"
              dataKey="v"
              stroke="#00c8ff"
              strokeWidth={1.5}
              fill="url(#lightGrad)"
              dot={false}
              isAnimationActive={false}   // prevent jitter at 150 ms update rate
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}