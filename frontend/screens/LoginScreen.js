import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Alert,
  Platform,
  KeyboardAvoidingView,
  ScrollView,
  TouchableWithoutFeedback,
  Keyboard,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { apiFetch } from "../api";
import COLORS from "../theme/colors";
import { useI18n } from "../i18n";

const YELLOW = COLORS.primary;
const BLACK = COLORS.bgDeep;
const BLACK_CARD = COLORS.card;
const BORDER = COLORS.border;
const TEXT_MUTED = COLORS.muted;

export default function LoginScreen({ navigation, route }) {
  const { t } = useI18n();
  const prefillEmail = route?.params?.prefillEmail || "";

  const [emailOrPhone, setEmailOrPhone] = useState(prefillEmail);
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (prefillEmail) setEmailOrPhone(prefillEmail);
  }, [prefillEmail]);

  const handleLogin = async () => {
    const value = emailOrPhone.trim();

    if (!value || !password.trim()) {
      Alert.alert(t("common_error"), t("login_subtitle"));
      return;
    }

    try {
      setLoading(true);

      const data = await apiFetch("/api/auth/login", {
        method: "POST",
        skipAuth: true,
        body: JSON.stringify({
          email_or_phone: value,
          password: password.trim(),
        }),
      });

      await AsyncStorage.setItem("token", data.token);

      navigation.reset({
        index: 0,
        routes: [{ name: "Home" }],
      });
    } catch (error) {
      Alert.alert(t("common_error"), error.message || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  const resetApp = async () => {
    try {
      await AsyncStorage.removeItem("token");
      await AsyncStorage.removeItem("hasSeenOnboarding_v2");
      Alert.alert(t("common_success"), "Close app completely and reopen.");
    } catch (error) {
      Alert.alert(t("common_error"), "Unable to reset app state");
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <ScrollView
            contentContainerStyle={styles.container}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.card}>
              <Text style={styles.title}>{t("login_title")}</Text>
              <Text style={styles.subtitle}>{t("login_subtitle")}</Text>

              <TextInput
                placeholder={t("login_email_or_phone")}
                placeholderTextColor={TEXT_MUTED}
                style={styles.input}
                value={emailOrPhone}
                onChangeText={setEmailOrPhone}
                autoCapitalize="none"
                keyboardType="email-address"
              />

              <TextInput
                placeholder={t("login_password")}
                placeholderTextColor={TEXT_MUTED}
                secureTextEntry
                style={styles.input}
                value={password}
                onChangeText={setPassword}
                onSubmitEditing={handleLogin}
              />

              <TouchableOpacity
                style={[styles.primaryBtn, loading && styles.disabledBtn]}
                onPress={handleLogin}
                disabled={loading}
                activeOpacity={0.9}
              >
                {loading ? (
                  <ActivityIndicator color={COLORS.darkText} />
                ) : (
                  <Text style={styles.primaryText}>{t("login_button")}</Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.linkBtn}
                onPress={() => navigation.navigate("ResetPassword")}
                activeOpacity={0.8}
              >
                <Text style={styles.linkText}>{t("login_forgot_password")}</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.secondaryBtn}
                onPress={() => navigation.navigate("Register")}
                activeOpacity={0.8}
              >
                <Text style={styles.secondaryText}>{t("login_create_account")}</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.resetBtn}
                onPress={resetApp}
                activeOpacity={0.8}
              >
                <Text style={styles.resetText}>{t("login_reset_onboarding")}</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: BLACK,
  },

  container: {
    flexGrow: 1,
    justifyContent: "center",
    padding: 20,
  },

  card: {
    backgroundColor: BLACK_CARD,
    borderRadius: 22,
    padding: 20,
    borderWidth: 1,
    borderColor: BORDER,
  },

  title: {
    color: YELLOW,
    fontSize: 28,
    fontWeight: "900",
    textAlign: "center",
  },

  subtitle: {
    color: TEXT_MUTED,
    fontSize: 14,
    textAlign: "center",
    marginTop: 6,
    marginBottom: 24,
  },

  input: {
    backgroundColor: COLORS.inputBg,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 14,
    color: COLORS.white,
    fontSize: 14,
    marginBottom: 14,
  },

  primaryBtn: {
    backgroundColor: YELLOW,
    borderRadius: 30,
    paddingVertical: 15,
    alignItems: "center",
    marginTop: 4,
  },

  disabledBtn: {
    opacity: 0.7,
  },

  primaryText: {
    color: COLORS.darkText,
    fontSize: 16,
    fontWeight: "900",
  },

  linkBtn: {
    marginTop: 16,
    alignItems: "center",
  },

  linkText: {
    color: YELLOW,
    fontWeight: "800",
    fontSize: 13,
  },

  secondaryBtn: {
    marginTop: 18,
    borderWidth: 1,
    borderColor: YELLOW,
    borderRadius: 30,
    paddingVertical: 14,
    alignItems: "center",
    backgroundColor: BLACK_CARD,
  },

  secondaryText: {
    color: YELLOW,
    fontWeight: "900",
    fontSize: 14,
  },

  resetBtn: {
    marginTop: 14,
    alignItems: "center",
  },

  resetText: {
    color: TEXT_MUTED,
    fontSize: 12,
    fontWeight: "700",
  },
});
