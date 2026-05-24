import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";

import {
  APP_MODE_MEMBER,
  adminApiFetch,
  clearAppMode,
  getSessionSnapshot,
  setActiveAppMode,
  setAdminSession,
} from "../api";
import PasswordField from "../components/PasswordField";
import COLORS from "../theme/colors";
import { useI18n } from "../i18n";

function InfoPill({ icon, label }) {
  return (
    <View style={styles.infoPill}>
      <MaterialCommunityIcons name={icon} size={16} color={COLORS.primarySoft} />
      <Text style={styles.infoPillText}>{label}</Text>
    </View>
  );
}

export default function AdminLoginScreen({ navigation }) {
  const { t } = useI18n();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleAdminLogin = async () => {
    const cleanEmail = email.trim().toLowerCase();
    const cleanPassword = password.trim();

    if (!cleanEmail || !cleanPassword) {
      return Alert.alert(t("common_error"), t("fill_all_fields"));
    }

    try {
      setLoading(true);

      const data = await adminApiFetch("/api/admin-auth/login", {
        method: "POST",
        skipAuth: true,
        body: JSON.stringify({
          email: cleanEmail,
          password: cleanPassword,
        }),
      });

      await setAdminSession(data.token);
    } catch (error) {
      Alert.alert(t("common_error"), error.message || t("admin_login_failed"));
    } finally {
      setLoading(false);
    }
  };

  const handleExitStaffAccess = async () => {
    const session = await getSessionSnapshot();

    if (session.memberToken) {
      await setActiveAppMode(APP_MODE_MEMBER);

      if (navigation?.canGoBack?.()) {
        navigation.goBack();
        return;
      }

      if (navigation?.getState?.()?.routeNames?.includes("Home")) {
        navigation.navigate("Home");
      }

      return;
    }

    await clearAppMode();

    if (navigation?.canGoBack?.()) {
      navigation.goBack();
      return;
    }

    if (navigation?.getState?.()?.routeNames?.includes("Login")) {
      navigation.navigate("Login");
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <ScrollView
            contentContainerStyle={styles.container}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.heroPanel}>
              <View style={styles.heroIconWrap}>
                <Ionicons name="shield-checkmark-outline" size={28} color={COLORS.primarySoft} />
              </View>
              <Text style={styles.badge}>{t("admin_center_badge")}</Text>
              <Text style={styles.heroTitle}>{t("admin_login_title")}</Text>
              <Text style={styles.heroSubtitle}>{t("admin_login_subtitle")}</Text>
              <Text style={styles.heroNote}>{t("admin_login_note")}</Text>

              <View style={styles.infoGrid}>
                <InfoPill icon="qrcode-scan" label={t("admin_login_role_front_desk")} />
                <InfoPill
                  icon="account-tie-outline"
                  label={t("admin_login_role_manager")}
                />
                <InfoPill icon="domain" label={t("admin_login_role_owner")} />
              </View>
            </View>

            <View style={styles.card}>
              <Text style={styles.sectionTitle}>{t("admin_login_credentials_title")}</Text>
              <Text style={styles.sectionSubtitle}>{t("admin_login_credentials_subtitle")}</Text>

              <TextInput
                placeholder={t("admin_login_email")}
                placeholderTextColor={COLORS.muted}
                style={styles.input}
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
                autoCorrect={false}
              />

              <PasswordField
                placeholder={t("admin_login_password")}
                placeholderTextColor={COLORS.muted}
                style={styles.input}
                value={password}
                onChangeText={setPassword}
                onSubmitEditing={handleAdminLogin}
              />

              <View style={styles.guidanceCard}>
                <Text style={styles.guidanceTitle}>{t("admin_login_internal_only_title")}</Text>
                <Text style={styles.guidanceText}>{t("admin_login_internal_only_line_1")}</Text>
                <Text style={styles.guidanceText}>{t("admin_login_internal_only_line_2")}</Text>
                <Text style={styles.guidanceText}>{t("admin_login_internal_only_line_3")}</Text>
              </View>

              <TouchableOpacity
                style={[styles.primaryBtn, loading && styles.disabledBtn]}
                onPress={handleAdminLogin}
                disabled={loading}
                activeOpacity={0.9}
              >
                {loading ? (
                  <ActivityIndicator color={COLORS.white} />
                ) : (
                  <Text style={styles.primaryText}>{t("admin_login_button")}</Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.secondaryBtn}
                onPress={handleExitStaffAccess}
                activeOpacity={0.82}
              >
                <Text style={styles.secondaryText}>{t("admin_login_member_mode")}</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  safe: {
    flex: 1,
    backgroundColor: COLORS.bgDeep,
  },
  container: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 28,
  },
  heroPanel: {
    backgroundColor: COLORS.card,
    borderRadius: 28,
    padding: 22,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 18,
  },
  heroIconWrap: {
    width: 58,
    height: 58,
    borderRadius: 20,
    backgroundColor: "rgba(59,130,246,0.14)",
    borderWidth: 1,
    borderColor: "rgba(59,130,246,0.28)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  badge: {
    color: COLORS.primarySoft,
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 1,
    marginBottom: 10,
  },
  heroTitle: {
    color: COLORS.white,
    fontSize: 32,
    fontWeight: "900",
    marginBottom: 8,
  },
  heroSubtitle: {
    color: COLORS.softWhite,
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 8,
  },
  heroNote: {
    color: COLORS.muted,
    fontSize: 13,
    lineHeight: 20,
    marginBottom: 18,
  },
  infoGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  infoPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.bgDeep,
  },
  infoPillText: {
    color: COLORS.softWhite,
    fontSize: 12,
    fontWeight: "700",
  },
  card: {
    backgroundColor: COLORS.card,
    borderRadius: 28,
    padding: 22,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  sectionTitle: {
    color: COLORS.white,
    fontSize: 20,
    fontWeight: "800",
    marginBottom: 6,
  },
  sectionSubtitle: {
    color: COLORS.muted,
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 18,
  },
  input: {
    backgroundColor: COLORS.inputBg,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 14,
    color: COLORS.white,
    fontSize: 14,
    marginBottom: 14,
  },
  guidanceCard: {
    backgroundColor: COLORS.bgDeep,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 20,
    padding: 16,
    marginBottom: 16,
  },
  guidanceTitle: {
    color: COLORS.white,
    fontSize: 14,
    fontWeight: "800",
    marginBottom: 8,
  },
  guidanceText: {
    color: COLORS.muted,
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 6,
  },
  primaryBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: 18,
    paddingVertical: 16,
    alignItems: "center",
  },
  disabledBtn: {
    opacity: 0.7,
  },
  primaryText: {
    color: COLORS.white,
    fontSize: 15,
    fontWeight: "900",
  },
  secondaryBtn: {
    marginTop: 14,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
  },
  secondaryText: {
    color: COLORS.softWhite,
    fontSize: 13,
    fontWeight: "700",
  },
});
