import React, { useEffect, useState } from "react";
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
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { apiFetch } from "../api";

const YELLOW = "#FFD700";
const BLACK = "#0B0B0B";
const BLACK_CARD = "#121212";
const BORDER = "rgba(255,255,255,0.08)";
const TEXT_MUTED = "rgba(255,255,255,0.65)";

export default function EditProfileScreen({ navigation }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      setLoading(true);
      const data = await apiFetch("/api/auth/profile");
      const p = data.profile || {};
      setName(p.name || "");
      setEmail(p.email || "");
      setPhone(p.phone_number || "");
    } catch (e) {
      Alert.alert("Error", e.message || "Failed to load profile");
    } finally {
      setLoading(false);
    }
  };

  const onSave = async () => {
    if (!name.trim()) {
      return Alert.alert("Missing", "Please enter your name");
    }

    if (!phone.trim()) {
      return Alert.alert("Missing", "Please enter your phone number");
    }

    try {
      setSaving(true);

      const res = await apiFetch("/api/auth/update-profile", {
        method: "PUT",
        body: JSON.stringify({
          name: name.trim(),
          phone_number: phone.trim(),
        }),
      });

      Alert.alert("Success", res.message || "Profile updated");
      navigation.goBack();
    } catch (e) {
      Alert.alert("Update failed", e.message || "Unable to update profile");
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.iconBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={24} color={YELLOW} />
        </TouchableOpacity>

        <Text style={styles.headerTitle}>My Information</Text>

        <View style={styles.iconBtn} />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={YELLOW} />
        </View>
      ) : (
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
                <Text style={styles.label}>Name</Text>
                <TextInput
                  value={name}
                  onChangeText={setName}
                  style={styles.input}
                  placeholder="Enter your name"
                  placeholderTextColor={TEXT_MUTED}
                />

                <Text style={styles.label}>Email</Text>
                <TextInput
                  value={email}
                  editable={false}
                  style={[styles.input, styles.readonly]}
                  placeholderTextColor={TEXT_MUTED}
                />

                <TouchableOpacity
                  style={styles.linkBtn}
                  onPress={() => navigation.navigate("ChangeEmail")}
                  activeOpacity={0.9}
                >
                  <Ionicons name="mail-outline" size={18} color={YELLOW} />
                  <Text style={styles.linkText}>Change Email</Text>
                </TouchableOpacity>

                <Text style={styles.label}>Phone</Text>
                <TextInput
                  value={phone}
                  onChangeText={setPhone}
                  style={styles.input}
                  keyboardType="phone-pad"
                  placeholder="Enter phone number"
                  placeholderTextColor={TEXT_MUTED}
                />

                <TouchableOpacity
                  style={[styles.primaryBtn, saving && styles.disabledBtn]}
                  onPress={onSave}
                  disabled={saving}
                  activeOpacity={0.9}
                >
                  <Text style={styles.primaryText}>
                    {saving ? "Saving..." : "Save Changes"}
                  </Text>
                </TouchableOpacity>

                <Text style={styles.note}>
                  Email changes require OTP verification.
                </Text>
              </View>
            </ScrollView>
          </TouchableWithoutFeedback>
        </KeyboardAvoidingView>
      )}
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
    fontWeight: "900",
    fontSize: 16,
  },

  container: {
    flexGrow: 1,
    padding: 20,
    justifyContent: "center",
  },

  card: {
    backgroundColor: BLACK_CARD,
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: BORDER,
  },

  label: {
    marginTop: 12,
    marginBottom: 8,
    fontWeight: "800",
    color: "#fff",
    fontSize: 13,
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
  },

  readonly: {
    backgroundColor: "#181818",
    color: TEXT_MUTED,
  },

  linkBtn: {
    marginTop: 12,
    borderWidth: 1,
    borderColor: YELLOW,
    borderRadius: 30,
    paddingVertical: 12,
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
    gap: 8,
    backgroundColor: BLACK_CARD,
  },

  linkText: {
    color: YELLOW,
    fontWeight: "900",
  },

  primaryBtn: {
    marginTop: 20,
    backgroundColor: YELLOW,
    paddingVertical: 14,
    borderRadius: 30,
    alignItems: "center",
  },

  disabledBtn: {
    opacity: 0.7,
  },

  primaryText: {
    color: "#000",
    fontWeight: "900",
    fontSize: 14,
  },

  note: {
    marginTop: 12,
    fontSize: 12,
    color: TEXT_MUTED,
    textAlign: "center",
  },

  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
});