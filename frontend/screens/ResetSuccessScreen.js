import React from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const YELLOW = "#FFD700";
const BLACK = "#0B0B0B";
const CARD = "#121212";
const MUTED = "rgba(255,255,255,0.65)";
const BORDER = "rgba(255,255,255,0.08)";

export default function ResetSuccessScreen({ navigation, route }) {
  const email = route?.params?.email || "";

  const goToLogin = () => {
    navigation.reset({
      index: 0,
      routes: [{ name: "Login", params: { prefillEmail: email } }],
    });
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      <View style={styles.container}>
        <View style={styles.card}>
          <Text style={styles.emoji}>✅</Text>

          <Text style={styles.title}>Password Changed</Text>

          <Text style={styles.sub}>
            Your password has been successfully updated.
            You can now login with your new password.
          </Text>

          <TouchableOpacity
            style={styles.primaryBtn}
            onPress={goToLogin}
            activeOpacity={0.9}
          >
            <Text style={styles.primaryText}>Back to Login</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: BLACK,
  },

  container: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 24,
  },

  card: {
    backgroundColor: CARD,
    borderRadius: 24,
    padding: 28,
    borderWidth: 1,
    borderColor: BORDER,
    alignItems: "center",
  },

  emoji: {
    fontSize: 48,
    marginBottom: 14,
  },

  title: {
    fontSize: 26,
    fontWeight: "900",
    color: YELLOW,
    marginBottom: 10,
    textAlign: "center",
  },

  sub: {
    color: MUTED,
    fontSize: 15,
    textAlign: "center",
    marginBottom: 24,
    lineHeight: 22,
  },

  primaryBtn: {
    backgroundColor: YELLOW,
    paddingVertical: 16,
    paddingHorizontal: 40,
    borderRadius: 30,
    alignItems: "center",
  },

  primaryText: {
    color: "#000",
    fontSize: 16,
    fontWeight: "900",
  },
});