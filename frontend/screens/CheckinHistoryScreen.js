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

const YELLOW = "#FFD700";
const BLACK = "#0B0B0B";
const BLACK_CARD = "#121212";
const BORDER = "rgba(255,255,255,0.08)";
const TEXT_MUTED = "rgba(255,255,255,0.65)";
const WHITE = "#FFFFFF";

export default function CheckinHistoryScreen({ navigation }) {
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
        <Text style={styles.title}>Check-in History</Text>
        <Text style={styles.subTitle}>
          {String(historyQuery.error?.message || "Failed to load history")}
        </Text>

        <TouchableOpacity style={styles.button} onPress={() => historyQuery.refetch()}>
          <Text style={styles.buttonText}>Retry</Text>
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
        <Text style={styles.title}>Check-in History</Text>
        <View style={{ width: 36 }} />
      </View>

      <Text style={styles.subTitle}>Last 30 check-ins</Text>

      <FlatList
        data={checkins}
        keyExtractor={(item, index) =>
          `${item.checkin_time || "time"}-${item.branch_id || "branch"}-${index}`
        }
        contentContainerStyle={{ paddingBottom: 30 }}
        ListEmptyComponent={
          <View style={styles.card}>
            <Text style={styles.emptyText}>No check-ins yet.</Text>
          </View>
        }
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Text style={styles.dateText}>
              {item.checkin_time
                ? new Date(item.checkin_time).toLocaleString()
                : "Unknown time"}
            </Text>

            <Text style={styles.branchText}>
              {item.branch_name ? `Branch: ${item.branch_name}` : "Branch unavailable"}
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
    color: "#000",
    fontWeight: "900",
  },
});