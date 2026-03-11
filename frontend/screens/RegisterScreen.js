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

const YELLOW = "#FFD700";
const BLACK = "#0B0B0B";
const CARD = "#121212";
const BORDER = "rgba(255,255,255,0.08)";
const MUTED = "rgba(255,255,255,0.65)";

export default function RegisterScreen({ navigation }) {
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
      Alert.alert("Missing info", "Please fill all fields.");
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

      Alert.alert("Success", "OTP sent to your email.");
      navigation.navigate("VerifyEmail", {
        email: cleanEmail,
      });
    } catch (err) {
      Alert.alert("Error", err.message || "Cannot connect to server");
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
              <Text style={styles.title}>Create Account</Text>
              <Text style={styles.subtitle}>
                Join the strongest gym community
              </Text>

              <TextInput
                placeholder="Full Name"
                placeholderTextColor={MUTED}
                style={styles.input}
                value={name}
                onChangeText={setName}
              />

              <TextInput
                placeholder="Email"
                placeholderTextColor={MUTED}
                style={styles.input}
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
              />

              <TextInput
                placeholder="Phone Number"
                placeholderTextColor={MUTED}
                style={styles.input}
                value={phoneNumber}
                onChangeText={setPhoneNumber}
                keyboardType="phone-pad"
              />

              <TextInput
                placeholder="Password"
                placeholderTextColor={MUTED}
                secureTextEntry
                style={styles.input}
                value={password}
                onChangeText={setPassword}
                onSubmitEditing={handleRegister}
              />

              <Text style={styles.note}>
                Password must be at least 8 characters and include uppercase,
                lowercase, number, and special character.
              </Text>

              <TouchableOpacity
                style={[styles.primaryBtn, loading && styles.disabledBtn]}
                onPress={handleRegister}
                disabled={loading}
                activeOpacity={0.9}
              >
                {loading ? (
                  <ActivityIndicator color="#000" />
                ) : (
                  <Text style={styles.primaryText}>Register</Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => navigation.navigate("Login")}
                activeOpacity={0.8}
              >
                <Text style={styles.link}>
                  Already have an account? Login
                </Text>
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
    backgroundColor: "#1A1A1A",
    borderWidth: 1,
    borderColor: BORDER,
    paddingVertical: 14,
    paddingHorizontal: 14,
    marginBottom: 14,
    borderRadius: 14,
    color: "#fff",
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
    color: "#000",
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