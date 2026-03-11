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

export default function ChangePasswordScreen({ navigation }) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const onUpdate = async () => {
    if (!currentPassword.trim() || !newPassword.trim()) {
      return Alert.alert("Missing", "Please fill all fields");
    }

    try {
      setLoading(true);

      const res = await apiFetch("/api/auth/change-password", {
        method: "PUT",
        body: JSON.stringify({
          current_password: currentPassword,
          new_password: newPassword,
        }),
      });

      Alert.alert("Success", res.message || "Password updated");
      navigation.goBack();
    } catch (e) {
      Alert.alert("Failed", e.message || "Unable to update password");
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
        <Text style={styles.headerTitle}>Change Password</Text>
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
              <Text style={styles.label}>Current Password</Text>
              <TextInput
                value={currentPassword}
                onChangeText={setCurrentPassword}
                style={styles.input}
                secureTextEntry
                placeholder="Enter current password"
                placeholderTextColor={TEXT_MUTED}
              />

              <Text style={styles.label}>New Password</Text>
              <TextInput
                value={newPassword}
                onChangeText={setNewPassword}
                style={styles.input}
                secureTextEntry
                placeholder="Enter new password"
                placeholderTextColor={TEXT_MUTED}
              />

              <Text style={styles.note}>
                New password must be at least 8 characters and include uppercase,
                lowercase, number, and special character.
              </Text>

              <TouchableOpacity
                style={[styles.primaryBtn, loading && styles.disabledBtn]}
                onPress={onUpdate}
                disabled={loading}
                activeOpacity={0.9}
              >
                <Text style={styles.primaryText}>
                  {loading ? "Updating..." : "Update Password"}
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

  note: {
    color: TEXT_MUTED,
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 16,
  },

  primaryBtn: {
    backgroundColor: YELLOW,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 4,
  },
  disabledBtn: {
    opacity: 0.7,
  },
  primaryText: {
    color: "#000",
    fontWeight: "900",
    fontSize: 14,
  },
});