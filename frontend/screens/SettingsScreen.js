import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Switch,
  Alert,
  Platform,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { apiFetch } from "../api";

const COLORS = {
  bg: "#000000",
  card: "#121212",
  border: "#232323",
  divider: "#2E2E2E",
  primary: "#3B82F6",
  primarySoft: "#93C5FD",
  white: "#FFFFFF",
  muted: "#A1A1AA",
  red: "#EF4444",
};

const APPLE_HEALTH_KEY = "settings_apple_health_enabled";

function SettingRow({ label, value, onPress, danger, disabled = false }) {
  return (
    <TouchableOpacity
      style={[styles.settingRow, disabled && styles.settingRowDisabled]}
      activeOpacity={disabled ? 1 : 0.85}
      onPress={disabled ? undefined : onPress}
      disabled={disabled}
    >
      <Text style={[styles.settingLabel, danger && { color: COLORS.red }]}>
        {label}
      </Text>

      <View style={styles.settingRight}>
        {value ? <Text style={styles.settingValue}>{value}</Text> : null}
        {!disabled ? (
          <Ionicons
            name="chevron-forward"
            size={20}
            color={danger ? COLORS.red : COLORS.muted}
          />
        ) : null}
      </View>
    </TouchableOpacity>
  );
}

export default function SettingsScreen({ navigation }) {
  const [appleHealthEnabled, setAppleHealthEnabled] = useState(false);
  const [loadingAppleHealth, setLoadingAppleHealth] = useState(Platform.OS === "ios");
  const [deleteLoading, setDeleteLoading] = useState(false);
  const language = "English";
  const country = "United States";
  const showAppleHealth = Platform.OS === "ios";

  useEffect(() => {
    if (!showAppleHealth) {
      setLoadingAppleHealth(false);
      return;
    }

    let mounted = true;

    const loadAppleHealthSetting = async () => {
      try {
        const savedValue = await AsyncStorage.getItem(APPLE_HEALTH_KEY);

        if (mounted && savedValue !== null) {
          setAppleHealthEnabled(savedValue === "true");
        }
      } catch (e) {
        console.log("Failed to load Apple Health setting:", e?.message || e);
      } finally {
        if (mounted) {
          setLoadingAppleHealth(false);
        }
      }
    };

    loadAppleHealthSetting();

    return () => {
      mounted = false;
    };
  }, [showAppleHealth]);

  const onToggleAppleHealth = async (value) => {
    try {
      setAppleHealthEnabled(value);
      await AsyncStorage.setItem(APPLE_HEALTH_KEY, String(value));
    } catch (e) {
      setAppleHealthEnabled((prev) => !prev);
      Alert.alert("Error", "Failed to save Apple Health preference.");
    }
  };

  const onDeleteAccount = () => {
    if (deleteLoading) return;

    Alert.alert(
      "Delete Account",
      "This will permanently delete your account.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              setDeleteLoading(true);
              await apiFetch("/api/auth/delete-account", { method: "DELETE" });
              await AsyncStorage.removeItem("token");
              navigation.reset({ index: 0, routes: [{ name: "Login" }] });
            } catch (e) {
              Alert.alert("Error", e?.message || "Failed");
            } finally {
              setDeleteLoading(false);
            }
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      
      {/* HEADER */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backButton}
        >
          <Ionicons name="arrow-back" size={22} color={COLORS.white} />
        </TouchableOpacity>

        <Text style={styles.headerTitle}>Settings</Text>

        <View style={{ width: 42 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

        {/* WEARABLES */}
        {showAppleHealth ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Wearables</Text>

            <View style={styles.switchRow}>
              <Text style={styles.settingLabel}>Apple Health</Text>

              <View style={styles.switchRight}>
                {loadingAppleHealth ? (
                  <ActivityIndicator size="small" color={COLORS.primarySoft} />
                ) : (
                  <>
                    <Text style={styles.settingValue}>
                      {appleHealthEnabled ? "Enabled" : "Disabled"}
                    </Text>

                    <Switch
                      value={appleHealthEnabled}
                      onValueChange={onToggleAppleHealth}
                      trackColor={{ false: "#3A3A3A", true: COLORS.primary }}
                      thumbColor={appleHealthEnabled ? COLORS.primarySoft : "#E5E5E5"}
                    />
                  </>
                )}
              </View>
            </View>

            <Text style={styles.helperText}>
              Save your Apple Health sync preference on this device.
            </Text>
          </View>
        ) : null}

        {/* APP SETTINGS */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>App Settings</Text>

          <SettingRow label="Language" value={language} disabled />
          <View style={styles.divider} />
          <SettingRow label="Country / Region" value={country} disabled />
        </View>

        {/* ACCOUNT */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account</Text>

          <SettingRow
            label="Change Password"
            onPress={() => navigation.navigate("ChangePassword")}
          />

          <View style={styles.divider} />

          <SettingRow
            label={deleteLoading ? "Deleting Account..." : "Delete Account"}
            onPress={deleteLoading ? undefined : onDeleteAccount}
            danger
            disabled={deleteLoading}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },

  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 16,
  },

  backButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    justifyContent: "center",
    alignItems: "center",
  },

  headerTitle: {
    color: COLORS.white,
    fontSize: 20,
    fontWeight: "800",
  },

  content: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },

  section: {
    backgroundColor: COLORS.card,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 18,
    marginBottom: 18,
  },

  sectionTitle: {
    color: COLORS.primarySoft,
    fontSize: 18,
    fontWeight: "800",
    marginBottom: 16,
  },

  switchRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    minHeight: 60,
  },

  switchRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },

  settingRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    minHeight: 60,
  },

  settingRowDisabled: {
    opacity: 0.75,
  },

  settingLabel: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: "600",
  },

  settingRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },

  settingValue: {
    color: COLORS.muted,
    fontSize: 14,
  },

  helperText: {
    color: COLORS.muted,
    fontSize: 13,
    marginTop: 12,
  },

  divider: {
    height: 1,
    backgroundColor: COLORS.divider,
  },
});
