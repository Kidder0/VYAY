import React from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import COLORS from "../theme/colors";
import { useI18n } from "../i18n";

const YELLOW = COLORS.primary;
const BLACK = COLORS.bgDeep;
const CARD = COLORS.card;
const MUTED = COLORS.muted;
const BORDER = COLORS.border;

export default function ResetSuccessScreen({ navigation, route }) {
  const { t } = useI18n();
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

          <Text style={styles.title}>{t("reset_success_changed_title")}</Text>

          <Text style={styles.sub}>{t("reset_success_changed_sub")}</Text>

          <TouchableOpacity
            style={styles.primaryBtn}
            onPress={goToLogin}
            activeOpacity={0.9}
          >
            <Text style={styles.primaryText}>{t("reset_success_button")}</Text>
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
    color: COLORS.darkText,
    fontSize: 16,
    fontWeight: "900",
  },
});
