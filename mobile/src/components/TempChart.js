import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, mono } from '../theme';
import { clock } from '../utils/time';

const LIMIT = 40; 
const HEIGHT = 90;

export default function TempChart({ readings }) {
  if (readings.length < 2) {
    return <Text style={styles.empty}>Not enough data for a chart yet.</Text>;
  }

  const step = Math.max(1, Math.ceil(readings.length / 48));
  const values = readings.filter((_, i) => i % step === 0).map((r) => r.temperature);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = Math.max(max - min, 1);

  return (
    <View>
      <View style={styles.row}>
        <View style={[styles.axis, { height: HEIGHT }]}>
          <Text style={styles.axisText}>{max.toFixed(1)}°</Text>
          <Text style={styles.axisText}>{min.toFixed(1)}°</Text>
        </View>
        <View style={[styles.bars, { height: HEIGHT }]}>
          {values.map((v, i) => (
            <View
              key={i}
              style={{
                flex: 1,
                marginHorizontal: 1,
                height: 6 + ((v - min) / range) * (HEIGHT - 6),
                backgroundColor: v > LIMIT ? colors.alert : colors.accent,
              }}
            />
          ))}
        </View>
      </View>
      <View style={styles.timeRow}>
        <Text style={styles.axisText}>{clock(readings[0].timestamp)}</Text>
        <Text style={styles.axisText}>{clock(readings[readings.length - 1].timestamp)}</Text>
      </View>
      <Text style={styles.legend}>Red bars are above {LIMIT} °C</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  empty: { color: colors.muted, fontSize: 13 },
  row: { flexDirection: 'row' },
  axis: { width: 48, justifyContent: 'space-between' },
  axisText: { fontFamily: mono, fontSize: 10, color: colors.muted },
  bars: { flex: 1, flexDirection: 'row', alignItems: 'flex-end' },
  timeRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6, marginLeft: 48 },
  legend: { fontFamily: mono, fontSize: 10, color: colors.muted, marginTop: 4, marginLeft: 48 },
});