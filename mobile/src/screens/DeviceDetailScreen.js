import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, ScrollView, RefreshControl, Pressable, ActivityIndicator, Alert, StyleSheet,
} from 'react-native';
import { api } from '../api';
import TempChart from '../components/TempChart';
import { colors, mono } from '../theme';
import { clock, timeAgo } from '../utils/time';

const ALERT_NAMES = {
  OVER_TEMPERATURE: 'Over-temperature',
  OFFLINE: 'Device offline',
  INACTIVE: 'Not moving',
};

function Section({ title, children }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.panel}>{children}</View>
    </View>
  );
}

function Row({ label, value, valueStyle }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={[styles.rowValue, valueStyle]}>{value}</Text>
    </View>
  );
}

export default function DeviceDetailScreen({ route }) {
  const { deviceId, refTime } = route.params;
  const [device, setDevice] = useState(null);
  const [readings, setReadings] = useState([]); // oldest first
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(async () => {
    try {
      const d = await api.getDevice(deviceId);
      const rs = d.latestReading ? await api.getHourReadings(deviceId, d.latestReading.timestamp) : [];
      setDevice(d);
      setReadings(rs.slice().reverse()); // API gives newest first, the chart wants oldest first
      setError(null);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [deviceId]);

  useEffect(() => { load(); }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const acknowledge = async (alertId) => {
    setBusyId(alertId);
    try {
      await api.acknowledge(alertId);
      await load(); // the alert disappears from "open alerts"
    } catch (e) {
      Alert.alert('Could not acknowledge', e.message);
    } finally {
      setBusyId(null);
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.accent} />
        <Text style={styles.muted}>Loading device…</Text>
      </View>
    );
  }

  if (error && !device) {
    return (
      <View style={styles.center}>
        <Text style={styles.errTitle}>CONNECTION PROBLEM</Text>
        <Text style={styles.errText}>{error}</Text>
        <Pressable style={styles.retry} onPress={() => { setLoading(true); load(); }}>
          <Text style={styles.retryText}>RETRY</Text>
        </Pressable>
      </View>
    );
  }

  const latest = device.latestReading;
  const ref = refTime || (latest ? latest.timestamp : 0);
  const recent = readings.slice(-6).reverse();

  return (
    <ScrollView
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.accent]} />}
    >
      {error && <Text style={styles.banner}>Could not refresh: {error}</Text>}

      <Section title="DEVICE">
        <Row label="ID" value={String(device.device_id)} />
        <Row label="Label" value={device.label || '—'} />
        <Row label="Location" value={device.location || 'Not set'} />
        <Row label="Installed" value={device.install_date || 'Not set'} />
        <Row
          label="Status"
          value={device.is_registered ? 'Registered' : 'Unregistered'}
          valueStyle={!device.is_registered && { color: colors.alert }}
        />
      </Section>

      <Section title="LATEST READING">
        {latest ? (
          <>
            <Text style={styles.bigTemp}>{latest.temperature.toFixed(2)} °C</Text>
            <Row label="Seen" value={`${timeAgo(latest.timestamp, ref)}  (${clock(latest.timestamp)})`} />
            <Row label="Battery" value={`${latest.battery}%`} />
            <Row label="Activity score" value={latest.activity_score.toFixed(1)} />
            <Row label="Sequence" value={String(latest.sequence)} />
          </>
        ) : (
          <Text style={styles.muted}>No readings received yet.</Text>
        )}
      </Section>

      <Section title="TEMPERATURE · LAST HOUR">
        <TempChart readings={readings} />
        {recent.length > 0 && <View style={styles.divider} />}
        {recent.map((r) => (
          <Row key={r.id} label={clock(r.timestamp)} value={`${r.temperature.toFixed(2)} °C`} />
        ))}
      </Section>

      <Section title={`OPEN ALERTS (${device.openAlerts.length})`}>
        {device.openAlerts.length === 0 && <Text style={styles.muted}>No open alerts.</Text>}
        {device.openAlerts.map((a) => (
          <View key={a.id} style={styles.alertBox}>
            <Text style={styles.alertType}>{ALERT_NAMES[a.type] || a.type}</Text>
            <Text style={styles.alertMsg}>{a.message}</Text>
            <Text style={styles.alertTime}>Raised {clock(a.raised_at)}</Text>
            <Pressable
              style={[styles.ackBtn, busyId === a.id && { opacity: 0.6 }]}
              onPress={() => acknowledge(a.id)}
              disabled={busyId === a.id}
            >
              {busyId === a.id ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.ackText}>ACKNOWLEDGE</Text>
              )}
            </Pressable>
          </View>
        ))}
      </Section>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, paddingBottom: 40 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28, backgroundColor: colors.bg },
  muted: { color: colors.muted },
  banner: { backgroundColor: '#F6E3C8', color: '#7A4A00', padding: 10, borderRadius: 4, marginBottom: 12, fontSize: 13 },

  section: { marginBottom: 18 },
  sectionTitle: { fontFamily: mono, fontSize: 11, letterSpacing: 2, color: colors.muted, marginBottom: 6 },
  panel: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line, borderRadius: 6, padding: 14 },

  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 5 },
  rowLabel: { color: colors.muted, fontSize: 14 },
  rowValue: { fontFamily: mono, color: colors.ink, fontSize: 13, flexShrink: 1, textAlign: 'right', marginLeft: 12 },
  bigTemp: { fontFamily: mono, fontSize: 38, fontWeight: '700', color: colors.ink, marginBottom: 8 },
  divider: { height: 1, backgroundColor: colors.line, marginVertical: 12 },

  alertBox: { borderLeftWidth: 4, borderLeftColor: colors.alert, paddingLeft: 12, marginBottom: 14 },
  alertType: { fontSize: 16, fontWeight: '700', color: colors.alert },
  alertMsg: { color: colors.ink, marginTop: 2 },
  alertTime: { fontFamily: mono, fontSize: 11, color: colors.muted, marginTop: 2, marginBottom: 10 },
  ackBtn: { backgroundColor: colors.header, borderRadius: 4, paddingVertical: 11, alignItems: 'center' },
  ackText: { fontFamily: mono, color: '#fff', letterSpacing: 2, fontWeight: '700' },

  errTitle: { fontFamily: mono, color: colors.alert, letterSpacing: 2, marginBottom: 8 },
  errText: { color: colors.ink, textAlign: 'center', marginBottom: 18 },
  retry: { backgroundColor: colors.header, paddingHorizontal: 26, paddingVertical: 12, borderRadius: 4 },
  retryText: { fontFamily: mono, color: '#fff', letterSpacing: 2 },
});