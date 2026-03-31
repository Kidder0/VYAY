import React, { useEffect, useState } from "react";
import {
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
  View,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { apiFetch } from "../api";
import COLORS from "../theme/colors";
import { useI18n } from "../i18n";

const YELLOW = COLORS.primary;
const BLACK = COLORS.bgDeep;
const CARD = COLORS.card;
const BORDER = COLORS.border;
const MUTED = COLORS.muted;

export default function VerifyEmailScreen({ route, navigation }) {
  const { t } = useI18n();
  const { email } = route.params || {};

  const [otp, setOtp] = useState("");
  const [timer, setTimer] = useState(60);
  const [canResend, setCanResend] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [resending, setResending] = useState(false);

  useEffect(() => {
    if (timer > 0) {
      const interval = setInterval(() => setTimer((prev) => prev - 1), 1000);
      return () => clearInterval(interval);
    }
    setCanResend(true);
  }, [timer]);

  const verifyOtp = async () => {
    if (!email) {
      return Alert.alert(t("common_error"), t("email_missing"));
    }

    if (!otp.trim()) {
      return Alert.alert(t("required_title"), t("enter_otp"));
    }

    try {
      setVerifying(true);

      await apiFetch("/api/auth/verify-email-otp", {
        method: "POST",
        skipAuth: true,
        body: JSON.stringify({
          email,
          otp: otp.trim(),
        }),
      });

      Alert.alert(t("common_success"), t("email_verified_success"));
      navigation.reset({
        index: 0,
        routes: [{ name: "Login", params: { prefillEmail: email } }],
      });
    } catch (err) {
      Alert.alert(t("common_error"), err.message || t("invalid_otp"));
    } finally {
      setVerifying(false);
    }
  };

  const resendOtp = async () => {
    if (!email) {
      return Alert.alert(t("common_error"), t("email_missing"));
    }

    try {
      setResending(true);

      await apiFetch("/api/auth/send-email-otp", {
        method: "POST",
        skipAuth: true,
        body: JSON.stringify({ email }),
      });

      Alert.alert(t("common_success"), t("otp_resent_success"));
      setTimer(60);
      setCanResend(false);
    } catch (err) {
      Alert.alert(t("common_error"), err.message || t("failed_resend_otp"));
    } finally {
      setResending(false);
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
              <Text style={styles.title}>{t("verify_email_title")}</Text>
              <Text style={styles.sub}>{t("verify_email_otp_sent_to")}</Text>
              <Text style={styles.email}>{email || t("verify_email_no_email")}</Text>

              <TextInput
                placeholder={t("verify_email_otp")}
                placeholderTextColor={MUTED}
                style={styles.input}
                value={otp}
                onChangeText={setOtp}
                keyboardType="number-pad"
                maxLength={6}
                onSubmitEditing={verifyOtp}
              />

              <TouchableOpacity
                style={[styles.primaryBtn, verifying && styles.disabledBtn]}
                onPress={verifyOtp}
                disabled={verifying}
                activeOpacity={0.9}
              >
                {verifying ? (
                  <ActivityIndicator color={COLORS.darkText} />
                ) : (
                  <Text style={styles.primaryText}>{t("verify_email_verify")}</Text>
                )}
              </TouchableOpacity>

              <View style={{ marginTop: 20 }}>
                {canResend ? (
                  <TouchableOpacity
                    style={[styles.secondaryBtn, resending && styles.disabledBtn]}
                    onPress={resendOtp}
                    disabled={resending}
                    activeOpacity={0.9}
                  >
                    {resending ? (
                      <ActivityIndicator color={YELLOW} />
                    ) : (
                      <Text style={styles.secondaryText}>{t("verify_email_resend")}</Text>
                    )}
                  </TouchableOpacity>
                ) : (
                  <Text style={styles.timerText}>{t("verify_email_timer", { seconds: timer })}</Text>
                )}
              </View>

              <TouchableOpacity
                style={styles.linkBtn}
                onPress={() => navigation.goBack()}
                activeOpacity={0.8}
              >
                <Text style={styles.linkText}>{t("common_back")}</Text>
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
    paddingHorizontal: 22,
  },

  card: {
    backgroundColor: CARD,
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: BORDER,
  },

  title: {
    fontSize: 28,
    fontWeight: "900",
    color: YELLOW,
    marginBottom: 8,
  },

  sub: {
    color: MUTED,
  },

  email: {
    color: COLORS.white,
    marginBottom: 18,
    fontWeight: "700",
  },

  input: {
    backgroundColor: COLORS.inputBg,
    borderWidth: 1,
    borderColor: BORDER,
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: 14,
    color: COLORS.white,
    marginBottom: 16,
    textAlign: "center",
    fontSize: 18,
    letterSpacing: 6,
  },

  primaryBtn: {
    backgroundColor: YELLOW,
    paddingVertical: 16,
    borderRadius: 30,
    alignItems: "center",
  },

  primaryText: {
    color: COLORS.darkText,
    fontSize: 16,
    fontWeight: "900",
  },

  secondaryBtn: {
    borderWidth: 2,
    borderColor: YELLOW,
    paddingVertical: 14,
    borderRadius: 30,
    alignItems: "center",
  },

  secondaryText: {
    color: YELLOW,
    fontWeight: "800",
  },

  timerText: {
    textAlign: "center",
    color: MUTED,
  },

  linkBtn: {
    marginTop: 16,
    alignItems: "center",
  },

  linkText: {
    color: YELLOW,
    fontWeight: "800",
  },

  disabledBtn: {
    opacity: 0.7,
  },
});
