import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Alert,
  Pressable,
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
const CARD = COLORS.card;
const BORDER = COLORS.border;
const MUTED = COLORS.muted;

export default function SetNewPasswordScreen({ navigation, route }) {
  const { t } = useI18n();
  const { email, otp } = route.params || {};

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const handleChangePassword = async () => {
    if (!email || !otp) {
      return Alert.alert(t("common_error"), t("missing_email_or_otp"));
    }

    if (!newPassword.trim() || !confirmPassword.trim()) {
      return Alert.alert(t("required_title"), t("enter_new_and_confirm_password"));
    }

    if (newPassword !== confirmPassword) {
      return Alert.alert(t("mismatch_title"), t("passwords_do_not_match"));
    }

    try {
      setLoading(true);

      await apiFetch("/api/auth/reset-password", {
        method: "POST",
        skipAuth: true,
        body: JSON.stringify({
          email,
          otp,
          new_password: newPassword.trim(),
        }),
      });

      await AsyncStorage.removeItem("token");
      await AsyncStorage.removeItem("user");

      navigation.reset({
        index: 0,
        routes: [{ name: "ResetSuccess", params: { email } }],
      });
    } catch (e) {
      Alert.alert(t("common_error"), e.message || t("failed_reset_password"));
    } finally {
      setLoading(false);
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
              <Text style={styles.title}>{t("set_password_title")}</Text>
              <Text style={styles.sub}>{t("set_password_sub", { email: email || "" })}</Text>

              <View style={styles.row}>
                <TextInput
                  placeholder={t("set_password_new")}
                  placeholderTextColor={MUTED}
                  style={[styles.input, styles.inputFlex]}
                  secureTextEntry={!showNew}
                  value={newPassword}
                  onChangeText={setNewPassword}
                />
                <Pressable
                  style={styles.toggleBtn}
                  onPress={() => setShowNew((v) => !v)}
                >
                  <Text style={styles.toggleText}>
                    {showNew ? t("hide") : t("show")}
                  </Text>
                </Pressable>
              </View>

              <View style={styles.row}>
                <TextInput
                  placeholder={t("set_password_confirm")}
                  placeholderTextColor={MUTED}
                  style={[styles.input, styles.inputFlex]}
                  secureTextEntry={!showConfirm}
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  onSubmitEditing={handleChangePassword}
                />
                <Pressable
                  style={styles.toggleBtn}
                  onPress={() => setShowConfirm((v) => !v)}
                >
                  <Text style={styles.toggleText}>
                    {showConfirm ? t("hide") : t("show")}
                  </Text>
                </Pressable>
              </View>

              <Text style={styles.note}>{t("set_password_note")}</Text>

              <TouchableOpacity
                style={[styles.primaryBtn, loading && styles.disabledBtn]}
                onPress={handleChangePassword}
                disabled={loading}
                activeOpacity={0.9}
              >
                {loading ? (
                  <ActivityIndicator color={COLORS.darkText} />
                ) : (
                  <Text style={styles.primaryText}>{t("set_password_update")}</Text>
                )}
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
    marginBottom: 6,
  },

  sub: {
    color: MUTED,
    marginBottom: 20,
    lineHeight: 20,
  },

  row: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 14,
  },

  input: {
    backgroundColor: COLORS.inputBg,
    borderWidth: 1,
    borderColor: BORDER,
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: 14,
    color: COLORS.white,
  },

  inputFlex: {
    flex: 1,
  },

  toggleBtn: {
    marginLeft: 10,
    backgroundColor: COLORS.inputBg,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },

  toggleText: {
    color: YELLOW,
    fontWeight: "800",
    fontSize: 12,
  },

  note: {
    color: MUTED,
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 8,
  },

  primaryBtn: {
    backgroundColor: YELLOW,
    paddingVertical: 16,
    borderRadius: 30,
    alignItems: "center",
    marginTop: 10,
  },

  disabledBtn: {
    opacity: 0.7,
  },

  primaryText: {
    color: COLORS.darkText,
    fontSize: 16,
    fontWeight: "900",
  },
});
