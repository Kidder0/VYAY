import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  ScrollView,
  ActivityIndicator,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { apiFetch } from "../api";
import * as Haptics from "expo-haptics";

const COLORS = {
  bg: "#000000",
  bgDeep: "#050505",
  card: "#121212",
  cardSoft: "#171717",
  border: "#232323",
  borderSoft: "#2E2E2E",
  primary: "#3B82F6",
  primarySoft: "#93C5FD",
  white: "#FFFFFF",
  softWhite: "#E5E7EB",
  muted: "#A1A1AA",
  muted2: "#71717A",
  success: "#22C55E",
  danger: "#EF4444",
};

function normalizeMembership(value, hasMembership) {
  const raw = String(value || "").trim().toLowerCase();

  if (!hasMembership) return "JOIN";
  if (raw === "basic") return "BUILD";
  if (raw === "pro") return "DOMINATE";
  if (raw.includes("build")) return "BUILD";
  if (raw.includes("dominate")) return "DOMINATE";

  return "MEMBER";
}

function getInitials(name) {
  const cleaned = String(name || "").trim();
  if (!cleaned) return "V";

  const parts = cleaned.split(" ").filter(Boolean);
  if (parts.length === 1) return parts[0][0]?.toUpperCase() || "V";

  return `${parts[0][0] || ""}${parts[1][0] || ""}`.toUpperCase();
}

function MenuItem({ icon, label, subLabel, onPress, danger = false }) {
  const scale = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.timing(scale, {
      toValue: 0.98,
      duration: 90,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    Animated.timing(scale, {
      toValue: 1,
      duration: 90,
      useNativeDriver: true,
    }).start();
  };

  const handlePress = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress?.();
  };

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <TouchableOpacity
        style={styles.item}
        activeOpacity={1}
        onPress={handlePress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
      >
        <View style={styles.itemLeft}>
          <View
            style={[
              styles.itemIconWrap,
              danger && styles.itemIconWrapDanger,
            ]}
          >
            <MaterialCommunityIcons
              name={icon}
              size={20}
              color={danger ? COLORS.danger : COLORS.primary}
            />
          </View>

          <View style={styles.itemTextWrap}>
            <Text style={[styles.itemText, danger && styles.itemTextDanger]}>
              {label}
            </Text>
            {subLabel ? <Text style={styles.itemSubText}>{subLabel}</Text> : null}
          </View>
        </View>

        <Ionicons
          name="chevron-forward"
          size={18}
          color={danger ? COLORS.danger : COLORS.muted2}
        />
      </TouchableOpacity>
    </Animated.View>
  );
}

export default function AccountScreen({ navigation }) {
  const [name, setName] = useState("VYAY Member");
  const [email, setEmail] = useState("");
  const [membership, setMembership] = useState("JOIN");
  const [hasMembership, setHasMembership] = useState(false);
  const [loading, setLoading] = useState(true);

  const fade = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(18)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fade, {
        toValue: 1,
        duration: 350,
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration: 350,
        useNativeDriver: true,
      }),
    ]).start();

    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      setLoading(true);

      const [profileRes, membershipRes] = await Promise.all([
        apiFetch("/api/auth/profile"),
        apiFetch("/api/checkin/code"),
      ]);

      const profile = profileRes?.profile || {};
      const has =
        !membershipRes?.show_plans && !!membershipRes?.membership_code;

      setName(profile?.name || "VYAY Member");
      setEmail(profile?.email || "");
      setHasMembership(has);
      setMembership(
        normalizeMembership(
          membershipRes?.membership_plan_name || membershipRes?.membership_type,
          has
        )
      );
    } catch (err) {
      console.log("Account load error:", err?.message || err);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    Alert.alert("Logout", "Are you sure you want to logout?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Logout",
        style: "destructive",
        onPress: async () => {
          await AsyncStorage.removeItem("token");
          navigation.reset({
            index: 0,
            routes: [{ name: "Login" }],
          });
        },
      },
    ]);
  };

  const handleStore = () => {
    Alert.alert("VYAY Store", "Store screen coming next.");
  };

  const handleHelp = () => {
    Alert.alert("Help", "Help screen coming next.");
  };

  const handleMembershipTap = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    if (hasMembership) {
      navigation.navigate("Checkin");
    } else {
      navigation.navigate("Checkin");
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      <Animated.ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.container}
        style={{
          opacity: fade,
          transform: [{ translateY }],
        }}
      >
        <View style={styles.headerRow}>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => navigation.goBack()}
            activeOpacity={0.85}
          >
            <Ionicons name="arrow-back" size={22} color={COLORS.white} />
          </TouchableOpacity>

          <Text style={styles.headerTitle}>Account</Text>

          <View style={styles.headerSpacer} />
        </View>

        {loading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="large" color={COLORS.primary} />
            <Text style={styles.loadingText}>Loading account...</Text>
          </View>
        ) : (
          <>
            <View style={styles.profileBlock}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{getInitials(name)}</Text>
              </View>

              <Text style={styles.name}>{name}</Text>
              {email ? <Text style={styles.email}>{email}</Text> : null}

              <TouchableOpacity
                style={[
                  styles.membershipBadge,
                  hasMembership
                    ? styles.membershipBadgeActive
                    : styles.membershipBadgeInactive,
                ]}
                onPress={handleMembershipTap}
                activeOpacity={0.9}
              >
                <View
                  style={[
                    styles.membershipDot,
                    {
                      backgroundColor: hasMembership
                        ? COLORS.success
                        : COLORS.primary,
                    },
                  ]}
                />
                <Text
                  style={[
                    styles.membershipBadgeText,
                    hasMembership
                      ? styles.membershipBadgeTextActive
                      : styles.membershipBadgeTextInactive,
                  ]}
                >
                  {membership}
                </Text>
              </TouchableOpacity>
            </View>

            <View style={styles.section}>
              <MenuItem
                icon="dumbbell"
                label="My Club"
                subLabel="View your available club access"
                onPress={() => navigation.navigate("Branches")}
              />
              <MenuItem
                icon="history"
                label="Check-in History"
                subLabel="See your recent visits"
                onPress={() => navigation.navigate("CheckinHistory")}
              />
              <MenuItem
                icon="shopping-outline"
                label="VYAY Store"
                subLabel="Browse products and essentials"
                onPress={handleStore}
              />
            </View>

            <View style={styles.section}>
              <MenuItem
                icon="email-outline"
                label="Change Email"
                subLabel="Update your email address"
                onPress={() => navigation.navigate("ChangeEmail")}
              />
              <MenuItem
                icon="cog-outline"
                label="Settings"
                subLabel="Language, country and app options"
                onPress={() => navigation.navigate("Settings")}
              />
            </View>

            <View style={styles.section}>
              <MenuItem
                icon="help-circle-outline"
                label="Help"
                subLabel="Support and assistance"
                onPress={handleHelp}
              />
              <MenuItem
                icon="logout"
                label="Logout"
                subLabel="Sign out from your account"
                onPress={handleLogout}
                danger
              />
            </View>
          </>
        )}
      </Animated.ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },

  container: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 40,
  },

  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 26,
  },

  backBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: "center",
    justifyContent: "center",
  },

  headerTitle: {
    color: COLORS.white,
    fontSize: 22,
    fontWeight: "800",
  },

  headerSpacer: {
    width: 42,
  },

  loadingWrap: {
    paddingTop: 100,
    alignItems: "center",
    justifyContent: "center",
  },

  loadingText: {
    marginTop: 14,
    color: COLORS.muted,
    fontSize: 14,
    fontWeight: "600",
  },

  profileBlock: {
    alignItems: "center",
    marginBottom: 28,
  },

  avatar: {
    width: 94,
    height: 94,
    borderRadius: 47,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },

  avatarText: {
    color: COLORS.primarySoft,
    fontSize: 28,
    fontWeight: "900",
    letterSpacing: 1,
  },

  name: {
    color: COLORS.white,
    fontSize: 24,
    fontWeight: "800",
    textAlign: "center",
  },

  email: {
    color: COLORS.muted,
    fontSize: 14,
    marginTop: 6,
    textAlign: "center",
  },

  membershipBadge: {
    marginTop: 16,
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderWidth: 1,
  },

  membershipBadgeActive: {
    backgroundColor: "rgba(59,130,246,0.12)",
    borderColor: "rgba(59,130,246,0.30)",
  },

  membershipBadgeInactive: {
    backgroundColor: COLORS.card,
    borderColor: COLORS.borderSoft,
  },

  membershipDot: {
    width: 8,
    height: 8,
    borderRadius: 999,
    marginRight: 8,
  },

  membershipBadgeText: {
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 1,
  },

  membershipBadgeTextActive: {
    color: COLORS.primarySoft,
  },

  membershipBadgeTextInactive: {
    color: COLORS.white,
  },

  section: {
    backgroundColor: COLORS.card,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingVertical: 8,
    marginBottom: 16,
  },

  item: {
    minHeight: 74,
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  itemLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    paddingRight: 10,
  },

  itemIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: "rgba(59,130,246,0.14)",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 14,
  },

  itemIconWrapDanger: {
    backgroundColor: "rgba(239,68,68,0.12)",
  },

  itemTextWrap: {
    flex: 1,
  },

  itemText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: "700",
  },

  itemTextDanger: {
    color: COLORS.danger,
  },

  itemSubText: {
    color: COLORS.muted,
    fontSize: 12,
    marginTop: 4,
    lineHeight: 17,
  },
});