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

const YELLOW = "#FFD700";
const BLACK = "#0B0B0B";
const BLACK_CARD = "#121212";
const BORDER = "rgba(255,255,255,0.08)";
const TEXT_MUTED = "rgba(255,255,255,0.65)";

export default function ChangeEmailScreen({ navigation }) {
  const [step, setStep] = useState(1);
  const [newEmail, setNewEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);

  const requestOtp = async () => {
    const email = newEmail.trim().toLowerCase();

    if (!email) {
      return Alert.alert("Missing", "Please enter a new email");
    }

    try {
      setLoading(true);

      const res = await apiFetch("/api/auth/update-profile", {
        method: "PUT",
        body: JSON.stringify({ email }),
      });

      Alert.alert(
        "OTP Sent",
        res.message || "Profile updated. Please verify your new email."
      );
      setStep(2);
    } catch (e) {
      Alert.alert("Failed", e.message || "Unable to update email");
    } finally {
      setLoading(false);
    }
  };

  const confirmOtp = async () => {
    const email = newEmail.trim().toLowerCase();
    const code = otp.trim();

    if (!email) {
      return Alert.alert("Missing", "Email is missing");
    }

    if (!code) {
      return Alert.alert("Missing", "Please enter OTP");
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

      Alert.alert("Success", res.message || "Email verified and updated");
      navigation.goBack();
    } catch (e) {
      Alert.alert("Verification Failed", e.message || "Invalid OTP");
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
        <Text style={styles.headerTitle}>Change Email</Text>
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
                  <Text style={styles.title}>Enter New Email</Text>
                  <Text style={styles.sub}>
                    We’ll send an OTP to your new email. Your email changes only
                    after verification.
                  </Text>

                  <Text style={styles.label}>New Email</Text>
                  <TextInput
                    value={newEmail}
                    onChangeText={setNewEmail}
                    style={styles.input}
                    placeholder="Enter new email"
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
                      {loading ? "Sending OTP..." : "Send OTP"}
                    </Text>
                  </TouchableOpacity>
                </>
              ) : (
                <>
                  <Text style={styles.title}>Verify OTP</Text>
                  <Text style={styles.sub}>
                    Enter the OTP sent to {newEmail.trim().toLowerCase()}.
                  </Text>

                  <Text style={styles.label}>OTP</Text>
                  <TextInput
                    value={otp}
                    onChangeText={setOtp}
                    style={styles.input}
                    placeholder="Enter OTP"
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
                      {loading ? "Verifying..." : "Verify OTP"}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.secondaryBtn}
                    onPress={() => setStep(1)}
                    disabled={loading}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.secondaryText}>Change Email Again</Text>
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
    color: "#fff",
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
    color: "#fff",
    fontSize: 13,
    fontWeight: "800",
    marginBottom: 8,
    marginTop: 8,
  },

  input: {
    backgroundColor: "#1A1A1A",
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 14,
    color: "#fff",
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
    color: "#000",
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