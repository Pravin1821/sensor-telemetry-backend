import React, { useCallback, useLayoutEffect, useState } from 'react';
import {
  View, Text, FlatList, RefreshControl, Pressable, ActivityIndicator, StyleSheet,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { api } from '../api';
import { useAuth } from '../auth';
import { colors, mono } from '../theme';
import { clock, timeAgo } from '../utils/time';

const POLL_MS = 5000; // auto-refresh so alerts appear live during the replay

function DeviceCard({ device, refTime, onPress }) {
  const hasAlerts = device.open_alerts > 0;
  const temp = device.latest_temperature;
  const hot = temp !== null && temp > 40;

  return (
    <Pressable onPress={onPress} style={styles.card}>
      <View style={[styles.stripe, { backgroundColor: hasAlerts ? colors.alert : colors.ok }]} />
      <View style={styles.cardBody}>
        <View style={styles.topRow}>
          <Text style={styles.label} numberOfLines={1}>
            {device.label || `Device ${device.device_id}`}
          </Text>
          {hasAlerts && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>
                {device.open_alerts} ALERT{device.open_alerts > 1 ? 'S' : ''}
              </Text>
            </View>
          )}
        </View>
        <Text style={styles.meta}>
          ID {device.device_id}
          {device.is_registered ? '' : '  ·  UNREGISTERED'}
        </Text>

        <View style={styles.bottomRow}>
          <Text style={[styles.temp, hot && { color: colors.alert }]}>
            {temp !== null ? `${temp.toFixed(1)}°C` : '—'}
          </Text>
          <View style={styles.right}>
            <Text style={styles.ago}>{timeAgo(device.last_seen, refTime)}</Text>
            {device.latest_battery !== null && (
              <Text style={styles.meta}>BAT {device.latest_battery}%</Text>
            )}
          </View>
        </View>
      </View>
    </Pressable>
  );
}

export default function DeviceListScreen({ navigation }) {
  const { signOut } = useAuth();
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <Pressable onPress={signOut} hitSlop={12}>
          <Text style={styles.signOut}>SIGN OUT</Text>
        </Pressable>
      ),
    });
  }, [navigation, signOut]);

  const load = useCallback(async () => {
    try {
      setDevices(await api.getDevices());
      setError(null);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  // Runs when the screen is shown, repeats every 5 s, stops when we leave the screen
  useFocusEffect(
    useCallback(() => {
      load();
      const timer = setInterval(load, POLL_MS);
      return () => clearInterval(timer);
    }, [load])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  // "Now" = newest packet time on the server (see utils/time.js)
  const refTime = Math.max(0, ...devices.map((d) => d.last_seen || 0));
  const alertTotal = devices.reduce((sum, d) => sum + d.open_alerts, 0);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.accent} />
        <Text style={styles.muted}>Loading devices…</Text>
      </View>
    );
  }

  if (error && devices.length === 0) {
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

  return (
    <FlatList
      data={devices}
      keyExtractor={(d) => String(d.device_id)}
      contentContainerStyle={styles.list}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.accent]} />
      }
      ListHeaderComponent={
        <View style={styles.summary}>
          {error && <Text style={styles.banner}>Connection lost. Showing the last data received.</Text>}
          <Text style={styles.summaryText}>
            {devices.length} DEVICES  ·  {alertTotal} OPEN ALERT{alertTotal === 1 ? '' : 'S'}
          </Text>
          {refTime > 0 && <Text style={styles.summarySub}>DATA AS OF {clock(refTime)}</Text>}
        </View>
      }
      ListEmptyComponent={<Text style={styles.muted}>No devices yet. Start the replay script.</Text>}
      renderItem={({ item }) => (
        <DeviceCard
          device={item}
          refTime={refTime}
          onPress={() =>
            navigation.navigate('Device', {
              deviceId: item.device_id,
              label: item.label,
              refTime,
            })
          }
        />
      )}
    />
  );
}

const styles = StyleSheet.create({
  list: { padding: 16 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28, backgroundColor: colors.bg },
  muted: { color: colors.muted, marginTop: 10 },
  signOut: { fontFamily: mono, color: colors.accent, fontSize: 12, letterSpacing: 1 },

  summary: { marginBottom: 14 },
  summaryText: { fontFamily: mono, fontSize: 12, color: colors.ink, letterSpacing: 1 },
  summarySub: { fontFamily: mono, fontSize: 10, color: colors.muted, marginTop: 3 },
  banner: {
    backgroundColor: '#F6E3C8', color: '#7A4A00', padding: 10, borderRadius: 4,
    marginBottom: 10, fontSize: 13,
  },

  card: {
    flexDirection: 'row', backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line,
    borderRadius: 6, marginBottom: 10, overflow: 'hidden',
  },
  stripe: { width: 6 },
  cardBody: { flex: 1, padding: 14 },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  label: { flex: 1, fontSize: 17, fontWeight: '700', color: colors.ink },
  meta: { fontFamily: mono, fontSize: 11, color: colors.muted, marginTop: 2 },
  badge: { backgroundColor: colors.alert, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 3, marginLeft: 8 },
  badgeText: { fontFamily: mono, color: '#fff', fontSize: 11, fontWeight: '700' },
  bottomRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: 12 },
  temp: { fontFamily: mono, fontSize: 30, fontWeight: '700', color: colors.ink },
  right: { alignItems: 'flex-end' },
  ago: { fontFamily: mono, fontSize: 13, color: colors.ink },

  errTitle: { fontFamily: mono, color: colors.alert, letterSpacing: 2, marginBottom: 8 },
  errText: { color: colors.ink, textAlign: 'center', marginBottom: 18 },
  retry: { backgroundColor: colors.header, paddingHorizontal: 26, paddingVertical: 12, borderRadius: 4 },
  retryText: { fontFamily: mono, color: '#fff', letterSpacing: 2 },
});