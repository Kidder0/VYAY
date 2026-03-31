import React, { useState } from "react";
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
  ActivityIndicator,
  View,
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

export default function RegisterScreen({ navigation }) {
  const { t } = useI18n();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleRegister = async () => {
    const cleanName = name.trim();
    const cleanEmail = email.trim().toLowerCase();
    const cleanPhone = phoneNumber.trim();

    if (!cleanName || !cleanEmail || !cleanPhone || !password) {
      Alert.alert(t("common_error"), "Please fill all fields.");
      return;
    }

    try {
      setLoading(true);

      await apiFetch("/api/auth/register", {
        method: "POST",
        skipAuth: true,
        body: JSON.stringify({
          name: cleanName,
          email: cleanEmail,
          phone_number: cleanPhone,
          password,
        }),
      });

      await apiFetch("/api/auth/send-email-otp", {
        method: "POST",
        skipAuth: true,
        body: JSON.stringify({ email: cleanEmail }),
      });

      Alert.alert(t("common_success"), "OTP sent to your email.");
      navigation.navigate("VerifyEmail", {
        email: cleanEmail,
      });
    } catch (err) {
      Alert.alert(t("common_error"), err.message || "Cannot connect to server");
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
              <Text style={styles.title}>{t("register_title")}</Text>
              <Text style={styles.subtitle}>{t("register_subtitle")}</Text>

              <TextInput
                placeholder={t("register_full_name")}
                placeholderTextColor={MUTED}
                style={styles.input}
                value={name}
                onChangeText={setName}
              />

              <TextInput
                placeholder={t("register_email")}
                placeholderTextColor={MUTED}
                style={styles.input}
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
              />

              <TextInput
                placeholder={t("register_phone")}
                placeholderTextColor={MUTED}
                style={styles.input}
                value={phoneNumber}
                onChangeText={setPhoneNumber}
                keyboardType="phone-pad"
              />

              <TextInput
                placeholder={t("register_password")}
                placeholderTextColor={MUTED}
                secureTextEntry
                style={styles.input}
                value={password}
                onChangeText={setPassword}
                onSubmitEditing={handleRegister}
              />

              <Text style={styles.note}>{t("register_note")}</Text>

              <TouchableOpacity
                style={[styles.primaryBtn, loading && styles.disabledBtn]}
                onPress={handleRegister}
                disabled={loading}
                activeOpacity={0.9}
              >
                {loading ? (
                  <ActivityIndicator color={COLORS.darkText} />
                ) : (
                  <Text style={styles.primaryText}>{t("register_button")}</Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => navigation.navigate("Login")}
                activeOpacity={0.8}
              >
                <Text style={styles.link}>{t("register_have_account")}</Text>
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

  subtitle: {
    color: MUTED,
    marginBottom: 20,
  },

  input: {
    backgroundColor: COLORS.inputBg,
    borderWidth: 1,
    borderColor: BORDER,
    paddingVertical: 14,
    paddingHorizontal: 14,
    marginBottom: 14,
    borderRadius: 14,
    color: COLORS.white,
  },

  note: {
    color: MUTED,
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 4,
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

  link: {
    marginTop: 14,
    color: YELLOW,
    textAlign: "center",
    fontSize: 14,
    fontWeight: "700",
  },
});
