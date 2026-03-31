import React from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  TouchableOpacity,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "../api";
import COLORS from "../theme/colors";
import { useI18n } from "../i18n";

const YELLOW = COLORS.primary;
const BLACK = COLORS.bgDeep;
const BLACK_CARD = COLORS.card;
const BORDER = COLORS.border;
const TEXT_MUTED = COLORS.muted;
const WHITE = COLORS.white;

export default function CheckinHistoryScreen({ navigation }) {
  const { t } = useI18n();
  const historyQuery = useQuery({
    queryKey: ["checkinHistory"],
    queryFn: () => apiFetch("/api/checkin/history"),
    refetchOnMount: true,
  });

  const checkins = historyQuery.data?.checkins || [];

  if (historyQuery.isLoading) {
    return (
      <SafeAreaView style={[styles.container, styles.center]} edges={["top", "left", "right"]}>
        <ActivityIndicator size="large" color={YELLOW} />
      </SafeAreaView>
    );
  }

  if (historyQuery.isError) {
    return (
      <SafeAreaView style={[styles.container, styles.center]} edges={["top", "left", "right"]}>
        <Text style={styles.title}>{t("history_title")}</Text>
        <Text style={styles.subTitle}>
          {String(historyQuery.error?.message || t("history_failed_load"))}
        </Text>

        <TouchableOpacity style={styles.button} onPress={() => historyQuery.refetch()}>
          <Text style={styles.buttonText}>{t("retry")}</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["top", "left", "right"]}>
      <View style={styles.headerRow}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.title}>{t("history_title")}</Text>
        <View style={{ width: 36 }} />
      </View>

      <Text style={styles.subTitle}>{t("history_last_30")}</Text>

      <FlatList
        data={checkins}
        keyExtractor={(item, index) =>
          `${item.checkin_time || "time"}-${item.branch_id || "branch"}-${index}`
        }
        contentContainerStyle={{ paddingBottom: 30 }}
        ListEmptyComponent={
          <View style={styles.card}>
            <Text style={styles.emptyText}>{t("history_empty")}</Text>
          </View>
        }
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Text style={styles.dateText}>
              {item.checkin_time
                ? new Date(item.checkin_time).toLocaleString()
                : t("history_unknown_time")}
            </Text>

            <Text style={styles.branchText}>
              {item.branch_name
                ? t("history_branch", { branch: item.branch_name })
                : t("history_branch_unavailable")}
            </Text>
          </View>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BLACK,
    padding: 20,
  },
  center: {
    justifyContent: "center",
    alignItems: "center",
  },

  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  backBtn: {
    width: 36,
    alignItems: "flex-start",
    justifyContent: "center",
  },

  backText: {
    color: YELLOW,
    fontSize: 22,
    fontWeight: "900",
  },

  title: {
    fontSize: 22,
    fontWeight: "900",
    color: YELLOW,
    textAlign: "center",
  },

  subTitle: {
    marginTop: 8,
    marginBottom: 18,
    color: TEXT_MUTED,
    textAlign: "center",
  },

  card: {
    backgroundColor: BLACK_CARD,
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: BORDER,
    marginBottom: 12,
  },

  dateText: {
    color: WHITE,
    fontWeight: "800",
    fontSize: 14,
  },

  branchText: {
    color: TEXT_MUTED,
    marginTop: 6,
    fontSize: 13,
  },

  emptyText: {
    color: TEXT_MUTED,
    textAlign: "center",
  },

  button: {
    marginTop: 16,
    backgroundColor: YELLOW,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 24,
  },

  buttonText: {
    color: COLORS.darkText,
    fontWeight: "900",
  },
});
