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
import { apiFetch } from "../api";

const YELLOW = "#FFD700";
const BLACK = "#0B0B0B";
const CARD = "#121212";
const BORDER = "rgba(255,255,255,0.08)";
const MUTED = "rgba(255,255,255,0.65)";

export default function VerifyResetOtpScreen({ navigation, route }) {
  const { email } = route.params || {};

  const [otp, setOtp] = useState("");
  const [timer, setTimer] = useState(60);
  const [canResend, setCanResend] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [resending, setResending] = useState(false);

  useEffect(() => {
    if (timer > 0) {
      const interval = setInterval(() => {
        setTimer((prev) => prev - 1);
      }, 1000);

      return () => clearInterval(interval);
    }

    setCanResend(true);
  }, [timer]);

  const handleVerifyOtp = async () => {
    const cleanOtp = otp.trim();

    if (!email) {
      return Alert.alert("Error", "Email is missing. Please go back and try again.");
    }

    if (!cleanOtp) {
      return Alert.alert("Required", "Please enter OTP");
    }

    try {
      setVerifying(true);

      const res = await apiFetch("/api/auth/verify-reset-otp", {
        method: "POST",
        skipAuth: true,
        body: JSON.stringify({
          email,
          otp: cleanOtp,
        }),
      });

      Alert.alert("Success", res.message || "OTP verified");

      navigation.navigate("SetNewPassword", {
        email,
        otp: cleanOtp,
      });
    } catch (e) {
      Alert.alert("Error", e.message || "Invalid OTP");
    } finally {
      setVerifying(false);
    }
  };

  const handleResendOtp = async () => {
    if (!email) {
      return Alert.alert("Error", "Email is missing. Please go back and try again.");
    }

    try {
      setResending(true);

      const res = await apiFetch("/api/auth/send-reset-otp", {
        method: "POST",
        skipAuth: true,
        body: JSON.stringify({ email }),
      });

      Alert.alert("OTP Sent", res.message || "OTP resent successfully");
      setTimer(60);
      setCanResend(false);
      setOtp("");
    } catch (e) {
      Alert.alert("Error", e.message || "Failed to resend OTP");
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
              <Text style={styles.title}>Verify Reset OTP</Text>
              <Text style={styles.sub}>Enter the OTP sent to</Text>
              <Text style={styles.email}>{email || "No email found"}</Text>

              <TextInput
                placeholder="Enter OTP"
                placeholderTextColor={MUTED}
                style={styles.input}
                value={otp}
                onChangeText={setOtp}
                keyboardType="number-pad"
                maxLength={6}
                onSubmitEditing={handleVerifyOtp}
              />

              <TouchableOpacity
                style={[styles.primaryBtn, verifying && styles.disabledBtn]}
                onPress={handleVerifyOtp}
                disabled={verifying}
                activeOpacity={0.9}
              >
                {verifying ? (
                  <ActivityIndicator color="#000" />
                ) : (
                  <Text style={styles.primaryText}>Verify OTP</Text>
                )}
              </TouchableOpacity>

              <View style={{ marginTop: 20 }}>
                {canResend ? (
                  <TouchableOpacity
                    style={[styles.secondaryBtn, resending && styles.disabledBtn]}
                    onPress={handleResendOtp}
                    disabled={resending}
                    activeOpacity={0.9}
                  >
                    {resending ? (
                      <ActivityIndicator color={YELLOW} />
                    ) : (
                      <Text style={styles.secondaryText}>Resend OTP</Text>
                    )}
                  </TouchableOpacity>
                ) : (
                  <Text style={styles.timerText}>Resend OTP in {timer}s</Text>
                )}
              </View>

              <TouchableOpacity
                style={styles.linkBtn}
                onPress={() => navigation.goBack()}
                activeOpacity={0.8}
              >
                <Text style={styles.linkText}>Back</Text>
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
    color: "#fff",
    marginBottom: 18,
    fontWeight: "700",
  },

  input: {
    backgroundColor: "#1A1A1A",
    borderWidth: 1,
    borderColor: BORDER,
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: 14,
    color: "#fff",
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
    color: "#000",
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