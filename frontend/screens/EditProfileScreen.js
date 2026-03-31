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
import COLORS from "../theme/colors";
import { useI18n } from "../i18n";

const YELLOW = COLORS.primary;
const BLACK = COLORS.bgDeep;
const BLACK_CARD = COLORS.card;
const BORDER = COLORS.border;
const TEXT_MUTED = COLORS.muted;

export default function EditProfileScreen({ navigation }) {
  const { t } = useI18n();
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
      Alert.alert(t("common_error"), e.message || t("failed_load_profile"));
    } finally {
      setLoading(false);
    }
  };

  const onSave = async () => {
    if (!name.trim()) {
      return Alert.alert(t("missing_title"), t("enter_name"));
    }

    if (!phone.trim()) {
      return Alert.alert(t("missing_title"), t("enter_phone"));
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

      Alert.alert(t("common_success"), res.message || t("profile_updated"));
      navigation.goBack();
    } catch (e) {
      Alert.alert(t("failed_title"), e.message || t("unable_update_profile"));
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

        <Text style={styles.headerTitle}>{t("account_title_compact")}</Text>

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
                <Text style={styles.label}>{t("edit_profile_name")}</Text>
                <TextInput
                  value={name}
                  onChangeText={setName}
                  style={styles.input}
                  placeholder={t("edit_profile_placeholder_name")}
                  placeholderTextColor={TEXT_MUTED}
                />

                <Text style={styles.label}>{t("edit_profile_email")}</Text>
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
                  <Text style={styles.linkText}>{t("edit_profile_change_email")}</Text>
                </TouchableOpacity>

                <Text style={styles.label}>{t("edit_profile_phone")}</Text>
                <TextInput
                  value={phone}
                  onChangeText={setPhone}
                  style={styles.input}
                  keyboardType="phone-pad"
                  placeholder={t("edit_profile_placeholder_phone")}
                  placeholderTextColor={TEXT_MUTED}
                />

                <TouchableOpacity
                  style={[styles.primaryBtn, saving && styles.disabledBtn]}
                  onPress={onSave}
                  disabled={saving}
                  activeOpacity={0.9}
                >
                  <Text style={styles.primaryText}>
                    {saving ? t("saving") : t("edit_profile_save")}
                  </Text>
                </TouchableOpacity>

                <Text style={styles.note}>
                  {t("edit_profile_note")}
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
    color: COLORS.white,
    fontSize: 13,
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
    color: COLORS.darkText,
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
