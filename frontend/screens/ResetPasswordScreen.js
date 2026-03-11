import React, { useState } from "react";
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
import { apiFetch } from "../api";

const YELLOW = "#FFD700";
const BLACK = "#0B0B0B";
const CARD = "#121212";
const BORDER = "rgba(255,255,255,0.08)";
const MUTED = "rgba(255,255,255,0.65)";

export default function ResetPasswordScreen({ navigation }) {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSendOtp = async () => {
    const cleanEmail = email.trim().toLowerCase();

    if (!cleanEmail) {
      return Alert.alert("Required", "Enter email");
    }

    try {
      setLoading(true);

      const res = await apiFetch("/api/auth/send-reset-otp", {
        method: "POST",
        skipAuth: true,
        body: JSON.stringify({ email: cleanEmail }),
      });

      Alert.alert("OTP Sent", res.message || "Check your email.");
      navigation.navigate("VerifyResetOtp", {
        email: cleanEmail,
      });
    } catch (e) {
      Alert.alert("Error", e.message || "Failed to send OTP");
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
              <Text style={styles.title}>Reset Password</Text>
              <Text style={styles.sub}>Enter your email to receive OTP</Text>

              <TextInput
                placeholder="Email"
                placeholderTextColor={MUTED}
                style={styles.input}
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
                returnKeyType="done"
                onSubmitEditing={handleSendOtp}
              />

              <TouchableOpacity
                style={[styles.primaryBtn, loading && styles.disabledBtn]}
                onPress={handleSendOtp}
                disabled={loading}
                activeOpacity={0.9}
              >
                {loading ? (
                  <ActivityIndicator color="#000" />
                ) : (
                  <Text style={styles.primaryText}>Send OTP</Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.linkBtn}
                onPress={() => navigation.goBack()}
                activeOpacity={0.8}
              >
                <Text style={styles.linkText}>Back to Login</Text>
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
  },

  input: {
    backgroundColor: "#1A1A1A",
    borderWidth: 1,
    borderColor: BORDER,
    paddingVertical: 14,
    paddingHorizontal: 14,
    marginBottom: 14,
    borderRadius: 14,
    color: "#fff",
  },

  primaryBtn: {
    backgroundColor: YELLOW,
    paddingVertical: 16,
    borderRadius: 30,
    alignItems: "center",
    marginTop: 4,
  },

  disabledBtn: {
    opacity: 0.7,
  },

  primaryText: {
    color: "#000",
    fontSize: 16,
    fontWeight: "900",
  },

  linkBtn: {
    marginTop: 14,
    alignItems: "center",
  },

  linkText: {
    color: YELLOW,
    fontSize: 14,
    fontWeight: "700",
  },
});