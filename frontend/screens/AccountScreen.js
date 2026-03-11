import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { apiFetch } from "../api";

const YELLOW = "#FFD700";
const BLACK = "#0B0B0B";
const BLACK_SOFT = "#121212";
const BORDER = "rgba(255,255,255,0.08)";
const TEXT_MUTED = "rgba(255,255,255,0.65)";
const DANGER = "#DC2626";

function getInitials(name) {
  const clean = (name || "").trim();
  if (!clean) return "GP";
  const parts = clean.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function MenuRow({ icon, label, onPress, right, danger }) {
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.85} style={styles.row}>
      <View style={styles.rowLeft}>
        <View style={[styles.iconWrap, danger && { backgroundColor: "#2A0F0F" }]}>
          <Ionicons name={icon} size={18} color={danger ? DANGER : YELLOW} />
        </View>
        <Text style={[styles.rowLabel, danger && { color: DANGER }]}>{label}</Text>
      </View>

      <View style={styles.rowRight}>
        {right ? right : <Ionicons name="chevron-forward" size={18} color={TEXT_MUTED} />}
      </View>
    </TouchableOpacity>
  );
}

export default function AccountScreen({ navigation }) {
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [profileName, setProfileName] = useState("GymPro Member");

  const initials = useMemo(() => getInitials(profileName), [profileName]);

  useEffect(() => {
    const unsubscribe = navigation.addListener("focus", async () => {
      try {
        setLoadingProfile(true);
        const res = await apiFetch("/api/auth/profile");
        setProfileName(res.profile?.name || "GymPro Member");
      } catch (e) {
        console.log(e.message);
      } finally {
        setLoadingProfile(false);
      }
    });

    return unsubscribe;
  }, [navigation]);

  const onLogout = async () => {
    await AsyncStorage.removeItem("token");
    navigation.reset({ index: 0, routes: [{ name: "Login" }] });
  };

  const onDeleteAccount = () => {
    Alert.alert(
      "Delete Account",
      "This will delete your account and log you out. This cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await apiFetch("/api/auth/delete-account", { method: "DELETE" });
              await AsyncStorage.removeItem("token");
              navigation.reset({ index: 0, routes: [{ name: "Login" }] });
            } catch (e) {
              Alert.alert("Error", e?.message || "Failed to delete account");
            }
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={22} color={YELLOW} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>My Account</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.topArea}>
        <TouchableOpacity
          style={styles.profileCard}
          activeOpacity={0.9}
          onPress={() => navigation.navigate("EditProfile")}
        >
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>

          <View style={{ flex: 1 }}>
            <Text style={styles.nameText}>{loadingProfile ? "Loading..." : profileName}</Text>
            <Text style={styles.subText}>Manage your account & preferences</Text>
          </View>

          {loadingProfile ? (
            <ActivityIndicator size="small" color={YELLOW} />
          ) : (
            <Ionicons name="sparkles-outline" size={20} color={YELLOW} />
          )}
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.sheet} contentContainerStyle={{ paddingBottom: 30 }}>
        <View style={styles.sectionCard}>
          <MenuRow
            icon="person-outline"
            label="My Information"
            onPress={() => navigation.navigate("EditProfile")}
          />
          <View style={styles.divider} />
          <MenuRow
            icon="mail-outline"
            label="Change Email"
            onPress={() => navigation.navigate("ChangeEmail")}
          />
          <View style={styles.divider} />
          <MenuRow
            icon="key-outline"
            label="Change Password"
            onPress={() => navigation.navigate("ChangePassword")}
          />
          <View style={styles.divider} />
          <MenuRow
            icon="location-outline"
            label="Clubs"
            onPress={() => navigation.navigate("Branches")}
          />
        </View>

        <View style={styles.sectionCard}>
          <MenuRow icon="trash-outline" label="Delete Account" danger onPress={onDeleteAccount} />
          <View style={styles.divider} />
          <MenuRow icon="log-out-outline" label="Log Out" danger onPress={onLogout} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: BLACK },

  header: {
    height: 56,
    backgroundColor: BLACK_SOFT,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
  },
  backBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  headerTitle: { color: YELLOW, fontWeight: "900", fontSize: 16 },

  topArea: { paddingHorizontal: 16, paddingTop: 14 },

  profileCard: {
    backgroundColor: BLACK_SOFT,
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: BORDER,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },

  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#1F1F1F",
    borderWidth: 1,
    borderColor: BORDER,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { color: YELLOW, fontWeight: "900", fontSize: 16 },

  nameText: { color: "#fff", fontSize: 15, fontWeight: "900" },
  subText: { color: TEXT_MUTED, fontSize: 12, marginTop: 4 },

  sheet: { flex: 1, paddingHorizontal: 16 },

  sectionCard: {
    backgroundColor: BLACK_SOFT,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: BORDER,
    marginTop: 14,
    overflow: "hidden",
  },

  row: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  rowLeft: { flexDirection: "row", alignItems: "center", gap: 14 },

  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#1A1A1A",
    alignItems: "center",
    justifyContent: "center",
  },

  rowLabel: { color: "#fff", fontSize: 14, fontWeight: "800" },
  rowRight: { alignItems: "center", justifyContent: "center" },

  divider: { height: 1, backgroundColor: BORDER, marginLeft: 64 },
});