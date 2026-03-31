import React from "react";
import {
  View,
  Text,
  StyleSheet,
  ImageBackground,
  TouchableOpacity,
  StatusBar,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { SafeAreaView } from "react-native-safe-area-context";
import COLORS from "../theme/colors";
import { useI18n } from "../i18n";

const YELLOW = COLORS.primary;
const BLACK = COLORS.bgDeep;
const ONBOARDING_KEY = "hasSeenOnboarding_v2";

export default function OnboardingScreen({ navigation }) {
  const { t } = useI18n();

  const markSeen = async () => {
    await AsyncStorage.setItem(ONBOARDING_KEY, "true");
  };

  const goLogin = async () => {
    await markSeen();
    navigation.replace("Login");
  };

  const goRegister = async () => {
    await markSeen();
    navigation.replace("Register");
  };

  return (
    <ImageBackground
      source={require("../assets/onboarding-bg.png")}
      style={styles.bg}
      resizeMode="cover"
    >
      <StatusBar barStyle="light-content" />

      <View style={styles.overlay}>
        <SafeAreaView style={{ flex: 1 }}>
          <View style={styles.container}>
            <View style={{ flex: 1 }} />

            <Text style={styles.title}>
              {t("onboarding_title_top")}
              {"\n"}
              <Text style={{ color: YELLOW }}>{t("onboarding_title_bottom")}</Text>
            </Text>

            <Text style={styles.subtitle}>{t("onboarding_subtitle")}</Text>

            <View style={styles.buttonsWrapper}>
              <TouchableOpacity
                style={styles.primaryBtn}
                activeOpacity={0.85}
                onPress={goRegister}
              >
                <Text style={styles.primaryText}>{t("onboarding_get_started")}</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.secondaryBtn}
                activeOpacity={0.85}
                onPress={goLogin}
              >
                <Text style={styles.secondaryText}>{t("onboarding_have_account")}</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.skipBtn} onPress={goLogin}>
                <Text style={styles.skipText}>{t("onboarding_skip")}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </SafeAreaView>
      </View>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  bg: {
    flex: 1,
    backgroundColor: BLACK,
  },

  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.75)",
  },

  container: {
    flex: 1,
    paddingHorizontal: 24,
    paddingBottom: 32,
  },

  title: {
    color: COLORS.white,
    fontSize: 42,
    fontWeight: "900",
    lineHeight: 46,
    textTransform: "uppercase",
    marginBottom: 14,
  },

  subtitle: {
    color: "rgba(255,255,255,0.85)",
    fontSize: 16,
    lineHeight: 22,
    marginBottom: 28,
  },

  buttonsWrapper: {
    marginBottom: 10,
  },

  primaryBtn: {
    backgroundColor: YELLOW,
    height: 58,
    borderRadius: 30,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 14,
  },

  primaryText: {
    color: COLORS.darkText,
    fontSize: 17,
    fontWeight: "900",
  },

  secondaryBtn: {
    height: 58,
    borderRadius: 30,
    borderWidth: 1.5,
    borderColor: YELLOW,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.45)",
  },

  secondaryText: {
    color: YELLOW,
    fontSize: 16,
    fontWeight: "900",
  },

  skipBtn: {
    marginTop: 16,
    alignItems: "center",
  },

  skipText: {
    color: "rgba(255,255,255,0.75)",
    fontSize: 14,
    fontWeight: "700",
  },
});
