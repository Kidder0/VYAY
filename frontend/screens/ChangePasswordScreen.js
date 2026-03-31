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
import COLORS from "../theme/colors";
import { useI18n } from "../i18n";

const YELLOW = COLORS.primary;
const BLACK = COLORS.bgDeep;
const BLACK_CARD = COLORS.card;
const BORDER = COLORS.border;
const TEXT_MUTED = COLORS.muted;

export default function ChangePasswordScreen({ navigation }) {
  const { t } = useI18n();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const onUpdate = async () => {
    if (!currentPassword.trim() || !newPassword.trim()) {
      return Alert.alert(t("missing_title"), t("fill_all_fields"));
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

      Alert.alert(t("common_success"), res.message || t("password_updated"));
      navigation.goBack();
    } catch (e) {
      Alert.alert(t("failed_title"), e.message || t("unable_update_password"));
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
        <Text style={styles.headerTitle}>{t("change_password_title")}</Text>
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
              <Text style={styles.label}>{t("change_password_current")}</Text>
              <TextInput
                value={currentPassword}
                onChangeText={setCurrentPassword}
                style={styles.input}
                secureTextEntry
                placeholder={t("change_password_placeholder_current")}
                placeholderTextColor={TEXT_MUTED}
              />

              <Text style={styles.label}>{t("change_password_new")}</Text>
              <TextInput
                value={newPassword}
                onChangeText={setNewPassword}
                style={styles.input}
                secureTextEntry
                placeholder={t("change_password_placeholder_new")}
                placeholderTextColor={TEXT_MUTED}
              />

              <Text style={styles.note}>{t("set_password_note")}</Text>

              <TouchableOpacity
                style={[styles.primaryBtn, loading && styles.disabledBtn]}
                onPress={onUpdate}
                disabled={loading}
                activeOpacity={0.9}
              >
                <Text style={styles.primaryText}>
                  {loading ? t("change_password_updating") : t("change_password_update")}
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
    color: COLORS.white,
    fontSize: 13,
    fontWeight: "800",
    marginBottom: 8,
    marginTop: 8,
  },

  input: {
    backgroundColor: COLORS.inputBg,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 14,
    color: COLORS.white,
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
    color: COLORS.darkText,
    fontWeight: "900",
    fontSize: 14,
  },
});
