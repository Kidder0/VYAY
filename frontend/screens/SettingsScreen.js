import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Switch,
  Alert,
  Platform,
  ActivityIndicator,
  Modal,
  TextInput,
  FlatList,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { apiFetch } from "../api";
import COLORS from "../theme/colors";
import { useI18n } from "../i18n";

const APPLE_HEALTH_KEY = "settings_apple_health_enabled";
const LANGUAGE_KEY = "settings_language";
const COUNTRY_KEY = "settings_country";

const LANGUAGE_OPTIONS = [
  "English",
  "Spanish",
  "French",
  "Hindi",
  "Arabic",
];

const COUNTRY_OPTIONS = [
  "Australia",
  "Bangladesh",
  "Brazil",
  "Canada",
  "China",
  "Egypt",
  "France",
  "Germany",
  "India",
  "Indonesia",
  "Ireland",
  "Italy",
  "Japan",
  "Kenya",
  "Malaysia",
  "Mexico",
  "Nepal",
  "Netherlands",
  "New Zealand",
  "Nigeria",
  "Pakistan",
  "Philippines",
  "Portugal",
  "Saudi Arabia",
  "Singapore",
  "South Africa",
  "South Korea",
  "Spain",
  "Sri Lanka",
  "Thailand",
  "Turkey",
  "United Arab Emirates",
  "United Kingdom",
  "United States",
  "Vietnam",
];

const COUNTRY_NAME_BY_CODE = {
  AU: "Australia",
  BD: "Bangladesh",
  BR: "Brazil",
  CA: "Canada",
  CN: "China",
  EG: "Egypt",
  FR: "France",
  DE: "Germany",
  IN: "India",
  ID: "Indonesia",
  IE: "Ireland",
  IT: "Italy",
  JP: "Japan",
  KE: "Kenya",
  MY: "Malaysia",
  MX: "Mexico",
  NP: "Nepal",
  NL: "Netherlands",
  NZ: "New Zealand",
  NG: "Nigeria",
  PK: "Pakistan",
  PH: "Philippines",
  PT: "Portugal",
  SA: "Saudi Arabia",
  SG: "Singapore",
  ZA: "South Africa",
  KR: "South Korea",
  ES: "Spain",
  LK: "Sri Lanka",
  TH: "Thailand",
  TR: "Turkey",
  AE: "United Arab Emirates",
  GB: "United Kingdom",
  US: "United States",
  VN: "Vietnam",
};

const LANGUAGE_NAME_BY_CODE = {
  ar: "Arabic",
  bn: "Bengali",
  zh: "Chinese",
  nl: "Dutch",
  en: "English",
  fr: "French",
  de: "German",
  gu: "Gujarati",
  hi: "Hindi",
  it: "Italian",
  ja: "Japanese",
  kn: "Kannada",
  ko: "Korean",
  ml: "Malayalam",
  mr: "Marathi",
  pt: "Portuguese",
  pa: "Punjabi",
  es: "Spanish",
  ta: "Tamil",
  te: "Telugu",
  tr: "Turkish",
  ur: "Urdu",
  vi: "Vietnamese",
};

function getDeviceLocaleParts() {
  const locale =
    Intl?.DateTimeFormat?.().resolvedOptions?.().locale ||
    "en-US";

  const normalized = String(locale).replace("_", "-");
  const [languageCode = "en", regionCode = "US"] = normalized.split("-");

  return {
    languageCode: languageCode.toLowerCase(),
    regionCode: regionCode.toUpperCase(),
  };
}

function SettingRow({ label, value, onPress, danger, disabled = false }) {
  return (
    <TouchableOpacity
      style={[styles.settingRow, disabled && styles.settingRowDisabled]}
      activeOpacity={disabled ? 1 : 0.85}
      onPress={disabled ? undefined : onPress}
      disabled={disabled}
    >
      <Text style={[styles.settingLabel, danger && { color: COLORS.danger }]}>
        {label}
      </Text>

      <View style={styles.settingRight}>
        {value ? <Text style={styles.settingValue}>{value}</Text> : null}
        {!disabled ? (
          <Ionicons
            name="chevron-forward"
            size={20}
            color={danger ? COLORS.danger : COLORS.muted}
          />
        ) : null}
      </View>
    </TouchableOpacity>
  );
}

export default function SettingsScreen({ navigation }) {
  const { t, setLanguage: applyLanguage } = useI18n();
  const [appleHealthEnabled, setAppleHealthEnabled] = useState(false);
  const [loadingAppleHealth, setLoadingAppleHealth] = useState(Platform.OS === "ios");
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [language, setLanguage] = useState("English");
  const [country, setCountry] = useState("United States");
  const [pickerVisible, setPickerVisible] = useState(false);
  const [pickerTitle, setPickerTitle] = useState("");
  const [pickerItems, setPickerItems] = useState([]);
  const [pickerType, setPickerType] = useState("");
  const [searchText, setSearchText] = useState("");
  const showAppleHealth = Platform.OS === "ios";

  useEffect(() => {
    if (!showAppleHealth) {
      setLoadingAppleHealth(false);
      return;
    }

    let mounted = true;

    const loadAppleHealthSetting = async () => {
      try {
        const savedValue = await AsyncStorage.getItem(APPLE_HEALTH_KEY);

        if (mounted && savedValue !== null) {
          setAppleHealthEnabled(savedValue === "true");
        }
      } catch (e) {
        console.log("Failed to load Apple Health setting:", e?.message || e);
      } finally {
        if (mounted) {
          setLoadingAppleHealth(false);
        }
      }
    };

    loadAppleHealthSetting();

    return () => {
      mounted = false;
    };
  }, [showAppleHealth]);

  useEffect(() => {
    let mounted = true;

    const loadSavedPreferences = async () => {
      try {
        const [savedLanguage, savedCountry] = await Promise.all([
          AsyncStorage.getItem(LANGUAGE_KEY),
          AsyncStorage.getItem(COUNTRY_KEY),
        ]);

        const { languageCode, regionCode } = getDeviceLocaleParts();
        const detectedLanguage = LANGUAGE_NAME_BY_CODE[languageCode];
        const detectedCountry = COUNTRY_NAME_BY_CODE[regionCode];

        if (!mounted) return;

        if (savedLanguage) {
          setLanguage(savedLanguage);
        } else if (detectedLanguage && LANGUAGE_OPTIONS.includes(detectedLanguage)) {
          setLanguage(detectedLanguage);
          await applyLanguage(detectedLanguage);
        }

        if (savedCountry) {
          setCountry(savedCountry);
        } else if (detectedCountry && COUNTRY_OPTIONS.includes(detectedCountry)) {
          setCountry(detectedCountry);
          await AsyncStorage.setItem(COUNTRY_KEY, detectedCountry);
        }
      } catch (e) {
        console.log("Failed to load settings preferences:", e?.message || e);
      }
    };

    loadSavedPreferences();

    return () => {
      mounted = false;
    };
  }, []);

  const onToggleAppleHealth = async (value) => {
    try {
      setAppleHealthEnabled(value);
      await AsyncStorage.setItem(APPLE_HEALTH_KEY, String(value));
    } catch (e) {
      setAppleHealthEnabled((prev) => !prev);
      Alert.alert("Error", "Failed to save Apple Health preference.");
    }
  };

  const onDeleteAccount = () => {
    if (deleteLoading) return;

    Alert.alert(
      "Delete Account",
      "This will permanently delete your account.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              setDeleteLoading(true);
              await apiFetch("/api/auth/delete-account", { method: "DELETE" });
              await AsyncStorage.removeItem("token");
              navigation.reset({ index: 0, routes: [{ name: "Login" }] });
            } catch (e) {
              Alert.alert("Error", e?.message || "Failed");
            } finally {
              setDeleteLoading(false);
            }
          },
        },
      ]
    );
  };

  const openPicker = (type) => {
    setSearchText("");
    setPickerType(type);

    if (type === "language") {
      setPickerTitle(t("settings_select_language"));
      setPickerItems(LANGUAGE_OPTIONS);
    } else {
      setPickerTitle(t("settings_select_country"));
      setPickerItems(COUNTRY_OPTIONS);
    }

    setPickerVisible(true);
  };

  const closePicker = () => {
    setPickerVisible(false);
    setPickerType("");
    setPickerItems([]);
    setSearchText("");
  };

  const onSelectPreference = async (value) => {
    try {
      if (pickerType === "language") {
        setLanguage(value);
        await applyLanguage(value);
      } else if (pickerType === "country") {
        setCountry(value);
        await AsyncStorage.setItem(COUNTRY_KEY, value);
      }

      closePicker();
    } catch (e) {
      Alert.alert(t("common_error"), "Failed to save preference.");
    }
  };

  const filteredPickerItems = pickerItems.filter((item) =>
    item.toLowerCase().includes(searchText.trim().toLowerCase())
  );

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      <Modal
        visible={pickerVisible}
        animationType="slide"
        transparent
        onRequestClose={closePicker}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{pickerTitle}</Text>
              <TouchableOpacity onPress={closePicker} activeOpacity={0.85}>
                <Ionicons name="close" size={22} color={COLORS.white} />
              </TouchableOpacity>
            </View>

            <TextInput
              value={searchText}
              onChangeText={setSearchText}
              placeholder={t("common_search")}
              placeholderTextColor={COLORS.muted}
              style={styles.searchInput}
            />

            <FlatList
              data={filteredPickerItems}
              keyExtractor={(item) => item}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              renderItem={({ item }) => {
                const selectedValue = pickerType === "language" ? language : country;
                const isSelected = selectedValue === item;

                return (
                  <TouchableOpacity
                    style={styles.optionRow}
                    onPress={() => onSelectPreference(item)}
                    activeOpacity={0.85}
                  >
                    <Text
                      style={[
                        styles.optionText,
                        isSelected && styles.optionTextSelected,
                      ]}
                    >
                      {item}
                    </Text>

                    {isSelected ? (
                      <Ionicons
                        name="checkmark-circle"
                        size={20}
                        color={COLORS.primary}
                      />
                    ) : null}
                  </TouchableOpacity>
                );
              }}
              ListEmptyComponent={
                <Text style={styles.emptyText}>{t("settings_no_results")}</Text>
              }
            />
          </View>
        </View>
      </Modal>
      
      {/* HEADER */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backButton}
        >
          <Ionicons name="arrow-back" size={22} color={COLORS.white} />
        </TouchableOpacity>

        <Text style={styles.headerTitle}>{t("settings_title")}</Text>

        <View style={{ width: 42 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

        {/* WEARABLES */}
        {showAppleHealth ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t("settings_wearables")}</Text>

            <View style={styles.switchRow}>
              <Text style={styles.settingLabel}>{t("settings_apple_health")}</Text>

              <View style={styles.switchRight}>
                {loadingAppleHealth ? (
                  <ActivityIndicator size="small" color={COLORS.primarySoft} />
                ) : (
                  <>
                    <Text style={styles.settingValue}>
                      {appleHealthEnabled ? t("settings_enabled") : t("settings_disabled")}
                    </Text>

                    <Switch
                      value={appleHealthEnabled}
                      onValueChange={onToggleAppleHealth}
                      trackColor={{ false: "#3A3A3A", true: COLORS.primary }}
                      thumbColor={appleHealthEnabled ? COLORS.primarySoft : "#E5E5E5"}
                    />
                  </>
                )}
              </View>
            </View>

            <Text style={styles.helperText}>
              {t("settings_apple_health_sub")}
            </Text>
          </View>
        ) : null}

        {/* APP SETTINGS */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t("settings_app")}</Text>

          <SettingRow
            label={t("settings_language")}
            value={language}
            onPress={() => openPicker("language")}
          />
          <View style={styles.divider} />
          <SettingRow
            label={t("settings_country")}
            value={country}
            onPress={() => openPicker("country")}
          />
        </View>

        {/* ACCOUNT */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t("settings_account")}</Text>

          <SettingRow
            label={t("settings_change_password")}
            onPress={() => navigation.navigate("ChangePassword")}
          />

          <View style={styles.divider} />

          <SettingRow
            label={deleteLoading ? t("settings_deleting_account") : t("settings_delete_account")}
            onPress={deleteLoading ? undefined : onDeleteAccount}
            danger
            disabled={deleteLoading}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },

  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 16,
  },

  backButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    justifyContent: "center",
    alignItems: "center",
  },

  headerTitle: {
    color: COLORS.white,
    fontSize: 20,
    fontWeight: "800",
  },

  content: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.72)",
    justifyContent: "flex-end",
  },

  modalCard: {
    backgroundColor: COLORS.card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 18,
    maxHeight: "72%",
  },

  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
  },

  modalTitle: {
    color: COLORS.white,
    fontSize: 18,
    fontWeight: "800",
  },

  searchInput: {
    backgroundColor: COLORS.inputBg,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: COLORS.white,
    fontSize: 14,
    marginBottom: 14,
  },

  optionRow: {
    minHeight: 52,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.bgDeep,
    paddingHorizontal: 14,
    marginBottom: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  optionText: {
    color: COLORS.softWhite,
    fontSize: 15,
    fontWeight: "600",
  },

  optionTextSelected: {
    color: COLORS.primarySoft,
  },

  emptyText: {
    color: COLORS.muted,
    textAlign: "center",
    marginTop: 20,
    fontSize: 14,
  },

  section: {
    backgroundColor: COLORS.card,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 18,
    marginBottom: 18,
  },

  sectionTitle: {
    color: COLORS.primarySoft,
    fontSize: 18,
    fontWeight: "800",
    marginBottom: 16,
  },

  switchRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    minHeight: 60,
  },

  switchRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },

  settingRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    minHeight: 60,
  },

  settingRowDisabled: {
    opacity: 0.75,
  },

  settingLabel: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: "600",
  },

  settingRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },

  settingValue: {
    color: COLORS.muted,
    fontSize: 14,
  },

  helperText: {
    color: COLORS.muted,
    fontSize: 13,
    marginTop: 12,
  },

  divider: {
    height: 1,
    backgroundColor: COLORS.divider,
  },
});
