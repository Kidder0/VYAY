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

const YELLOW = "#FFD700";
const BLACK = "#0B0B0B";
const CARD = "#121212";
const BORDER = "rgba(255,255,255,0.08)";
const MUTED = "rgba(255,255,255,0.65)";

export default function SetNewPasswordScreen({ navigation, route }) {
  const { email, otp } = route.params || {};

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const handleChangePassword = async () => {
    if (!email || !otp) {
      return Alert.alert("Error", "Missing email or OTP. Please verify OTP again.");
    }

    if (!newPassword.trim() || !confirmPassword.trim()) {
      return Alert.alert("Required", "Enter new password and confirm password");
    }

    if (newPassword !== confirmPassword) {
      return Alert.alert("Mismatch", "Passwords do not match");
    }

    try {
      setLoading(true);

      const res = await apiFetch("/api/auth/reset-password", {
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
      Alert.alert("Error", e.message || "Failed to reset password");
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
              <Text style={styles.title}>Set New Password</Text>
              <Text style={styles.sub}>
                Create a strong password for your account.
              </Text>

              <View style={styles.row}>
                <TextInput
                  placeholder="New Password"
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
                    {showNew ? "Hide" : "Show"}
                  </Text>
                </Pressable>
              </View>

              <View style={styles.row}>
                <TextInput
                  placeholder="Confirm Password"
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
                    {showConfirm ? "Hide" : "Show"}
                  </Text>
                </Pressable>
              </View>

              <Text style={styles.note}>
                Password must be at least 8 characters and include uppercase,
                lowercase, number, and special character.
              </Text>

              <TouchableOpacity
                style={[styles.primaryBtn, loading && styles.disabledBtn]}
                onPress={handleChangePassword}
                disabled={loading}
                activeOpacity={0.9}
              >
                {loading ? (
                  <ActivityIndicator color="#000" />
                ) : (
                  <Text style={styles.primaryText}>Update Password</Text>
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
    backgroundColor: "#1A1A1A",
    borderWidth: 1,
    borderColor: BORDER,
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: 14,
    color: "#fff",
  },

  inputFlex: {
    flex: 1,
  },

  toggleBtn: {
    marginLeft: 10,
    backgroundColor: "#1A1A1A",
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
    color: "#000",
    fontSize: 16,
    fontWeight: "900",
  },
});