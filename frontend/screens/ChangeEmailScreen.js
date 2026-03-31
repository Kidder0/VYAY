import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Platform,
  KeyboardAvoidingView,
  ScrollView,
  TouchableWithoutFeedback,
  Keyboard,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { apiFetch } from "../api";
import COLORS from "../theme/colors";
import { useI18n } from "../i18n";

const YELLOW = COLORS.primary;
const BLACK = COLORS.bgDeep;
const BLACK_CARD = COLORS.card;
const BORDER = COLORS.border;
const TEXT_MUTED = COLORS.muted;

export default function ChangeEmailScreen({ navigation }) {
  const { t } = useI18n();
  const [step, setStep] = useState(1);
  const [newEmail, setNewEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);

  const requestOtp = async () => {
    const email = newEmail.trim().toLowerCase();

    if (!email) {
      return Alert.alert(t("missing_title"), t("enter_new_email"));
    }

    try {
      setLoading(true);

      const res = await apiFetch("/api/auth/update-profile", {
        method: "PUT",
        body: JSON.stringify({ email }),
      });

      Alert.alert(
        t("otp_sent_title"),
        res.message || t("change_email_enter_sub")
      );
      setStep(2);
    } catch (e) {
      Alert.alert(t("failed_title"), e.message || t("unable_update_email"));
    } finally {
      setLoading(false);
    }
  };

  const confirmOtp = async () => {
    const email = newEmail.trim().toLowerCase();
    const code = otp.trim();

    if (!email) {
      return Alert.alert(t("missing_title"), t("email_missing"));
    }

    if (!code) {
      return Alert.alert(t("missing_title"), t("enter_otp"));
    }

    try {
      setLoading(true);

      const res = await apiFetch("/api/auth/verify-email-otp", {
        method: "POST",
        body: JSON.stringify({
          email,
          otp: code,
        }),
      });

      Alert.alert(t("common_success"), res.message || t("email_verified_updated"));
      navigation.goBack();
    } catch (e) {
      Alert.alert(t("verification_failed_title"), e.message || t("invalid_otp"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.iconBtn}>
          <Ionicons name="chevron-back" size={24} color={YELLOW} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t("change_email_title")}</Text>
        <View style={styles.iconBtn} />
      </View>

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
              {step === 1 ? (
                <>
                  <Text style={styles.title}>{t("change_email_enter_title")}</Text>
                  <Text style={styles.sub}>{t("change_email_enter_sub")}</Text>

                  <Text style={styles.label}>{t("change_email_new")}</Text>
                  <TextInput
                    value={newEmail}
                    onChangeText={setNewEmail}
                    style={styles.input}
                    placeholder={t("change_email_placeholder")}
                    placeholderTextColor={TEXT_MUTED}
                    autoCapitalize="none"
                    keyboardType="email-address"
                  />

                  <TouchableOpacity
                    style={[styles.primaryBtn, loading && styles.disabledBtn]}
                    onPress={requestOtp}
                    disabled={loading}
                    activeOpacity={0.9}
                  >
                    <Text style={styles.primaryText}>
                      {loading ? t("change_email_sending") : t("change_email_send")}
                    </Text>
                  </TouchableOpacity>
                </>
              ) : (
                <>
                  <Text style={styles.title}>{t("change_email_verify_title")}</Text>
                  <Text style={styles.sub}>
                    {t("change_email_verify_sub", {
                      email: newEmail.trim().toLowerCase(),
                    })}
                  </Text>

                  <Text style={styles.label}>{t("change_email_otp_label")}</Text>
                  <TextInput
                    value={otp}
                    onChangeText={setOtp}
                    style={styles.input}
                    placeholder={t("change_email_placeholder_otp")}
                    placeholderTextColor={TEXT_MUTED}
                    keyboardType="number-pad"
                    maxLength={6}
                  />

                  <TouchableOpacity
                    style={[styles.primaryBtn, loading && styles.disabledBtn]}
                    onPress={confirmOtp}
                    disabled={loading}
                    activeOpacity={0.9}
                  >
                    <Text style={styles.primaryText}>
                      {loading ? t("change_email_verifying") : t("change_email_verify")}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.secondaryBtn}
                    onPress={() => setStep(1)}
                    disabled={loading}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.secondaryText}>{t("change_email_back_again")}</Text>
                  </TouchableOpacity>
                </>
              )}
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

  header: {
    height: 56,
    backgroundColor: BLACK_CARD,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
  },
  iconBtn: {
    width: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    color: YELLOW,
    fontSize: 16,
    fontWeight: "900",
  },

  container: {
    flexGrow: 1,
    padding: 20,
    justifyContent: "center",
  },

  card: {
    backgroundColor: BLACK_CARD,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: BORDER,
    padding: 18,
  },

  title: {
    color: COLORS.white,
    fontSize: 20,
    fontWeight: "900",
    marginBottom: 8,
  },
  sub: {
    color: TEXT_MUTED,
    fontSize: 13,
    lineHeight: 20,
    marginBottom: 18,
  },

  label: {
    color: COLORS.white,
    fontSize: 13,
    fontWeight: "800",
    marginBottom: 8,
    marginTop: 8,
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
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 6,
  },
  disabledBtn: {
    opacity: 0.7,
  },
  primaryText: {
    color: COLORS.darkText,
    fontWeight: "900",
    fontSize: 14,
  },

  secondaryBtn: {
    marginTop: 14,
    alignItems: "center",
    paddingVertical: 10,
  },
  secondaryText: {
    color: YELLOW,
    fontWeight: "800",
    fontSize: 13,
  },
});
