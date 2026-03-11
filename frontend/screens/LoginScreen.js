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

const YELLOW = "#FFD700";
const BLACK = "#0B0B0B";
const BLACK_CARD = "#121212";
const BORDER = "rgba(255,255,255,0.08)";
const TEXT_MUTED = "rgba(255,255,255,0.65)";

export default function LoginScreen({ navigation, route }) {
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
      Alert.alert("Missing", "Please enter email/phone and password");
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
      Alert.alert("Error", error.message || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  const resetApp = async () => {
    try {
      await AsyncStorage.removeItem("token");
      await AsyncStorage.removeItem("hasSeenOnboarding_v2");
      Alert.alert("Reset Done", "Close app completely and reopen.");
    } catch (error) {
      Alert.alert("Error", "Unable to reset app state");
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
              <Text style={styles.title}>Welcome Back</Text>
              <Text style={styles.subtitle}>Login to continue</Text>

              <TextInput
                placeholder="Email or Phone"
                placeholderTextColor={TEXT_MUTED}
                style={styles.input}
                value={emailOrPhone}
                onChangeText={setEmailOrPhone}
                autoCapitalize="none"
                keyboardType="email-address"
              />

              <TextInput
                placeholder="Password"
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
                  <ActivityIndicator color="#000" />
                ) : (
                  <Text style={styles.primaryText}>Login</Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.linkBtn}
                onPress={() => navigation.navigate("ResetPassword")}
                activeOpacity={0.8}
              >
                <Text style={styles.linkText}>Forgot Password?</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.secondaryBtn}
                onPress={() => navigation.navigate("Register")}
                activeOpacity={0.8}
              >
                <Text style={styles.secondaryText}>Create New Account</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.resetBtn}
                onPress={resetApp}
                activeOpacity={0.8}
              >
                <Text style={styles.resetText}>Reset Onboarding</Text>
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
    borderRadius: 30,
    paddingVertical: 15,
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