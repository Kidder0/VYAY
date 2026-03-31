import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as Location from "expo-location";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "../api";
import COLORS from "../theme/colors";
import { useI18n } from "../i18n";

const YELLOW = COLORS.primary;
const BLACK = COLORS.bgDeep;
const BLACK_SOFT = COLORS.card;
const BORDER = COLORS.border;
const TEXT_MUTED = COLORS.muted;

function distanceMiles(lat1, lon1, lat2, lon2) {
  if (
    lat1 == null ||
    lon1 == null ||
    lat2 == null ||
    lon2 == null
  ) {
    return null;
  }

  const toRad = (v) => (v * Math.PI) / 180;
  const R = 3958.8;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) ** 2;

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export default function BranchesScreen({ navigation }) {
  const { t } = useI18n();
  const [search, setSearch] = useState("");
  const [userLoc, setUserLoc] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== "granted") return;

        const loc = await Location.getCurrentPositionAsync({});
        setUserLoc({
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude,
        });
      } catch (error) {
        console.log("Location error:", error?.message);
      }
    })();
  }, []);

  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ["branches"],
    queryFn: () => apiFetch("/api/branches"),
    refetchInterval: 30000,
  });

  const branches = data?.branches || [];

  const list = useMemo(() => {
    const q = search.trim().toLowerCase();
    let filtered = branches;

    if (q) {
      filtered = branches.filter((b) =>
        `${b.name} ${b.city || ""} ${b.state || ""} ${b.address || ""}`
          .toLowerCase()
          .includes(q)
      );
    }

    return filtered.map((b) => ({
      ...b,
      miles: userLoc
        ? distanceMiles(
            userLoc.latitude,
            userLoc.longitude,
            Number(b.latitude),
            Number(b.longitude)
          )
        : null,
    }));
  }, [branches, search, userLoc]);

  const renderItem = ({ item }) => {
    const distText =
      item.miles != null ? t("branches_distance_miles", { miles: Math.round(item.miles) }) : "";

    return (
      <View style={styles.card}>
        <View style={styles.cardTop}>
          <Text style={styles.title}>{item.name}</Text>
          {!!distText && <Text style={styles.distance}>{distText}</Text>}
        </View>

        <Text style={styles.address}>
          {[item.address, item.city, item.state].filter(Boolean).join(", ") ||
            t("branches_address_unavailable")}
        </Text>

        <View style={styles.actions}>
          <TouchableOpacity style={styles.linkBtn}>
            <Text style={styles.linkText}>{t("branches_details")}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.primaryBtn}
            onPress={() => navigation.navigate("Checkin")}
          >
            <Text style={styles.primaryText}>{t("branches_review_plans")}</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={["top", "left", "right"]}>
      <View style={styles.headerRow}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.back}>←</Text>
        </TouchableOpacity>
        <Text style={styles.header}>{t("branches_title")}</Text>
        <View style={{ width: 36 }} />
      </View>

      <View style={styles.searchWrap}>
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder={t("branches_search")}
          placeholderTextColor={TEXT_MUTED}
          style={styles.search}
        />
      </View>

      {isLoading ? (
        <ActivityIndicator style={{ marginTop: 30 }} color={YELLOW} />
      ) : (
        <FlatList
          data={list}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderItem}
          refreshing={isFetching}
          onRefresh={refetch}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 40 }}
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <Text style={styles.emptyText}>{t("branches_no_results")}</Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BLACK },

  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 12,
    marginBottom: 12,
  },
  backBtn: {
    width: 36,
    alignItems: "flex-start",
    justifyContent: "center",
  },
  back: { fontSize: 20, color: YELLOW },
  header: { fontSize: 18, fontWeight: "900", color: YELLOW },

  searchWrap: { paddingHorizontal: 16, marginBottom: 14 },
  search: {
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: BLACK_SOFT,
    borderRadius: 22,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: COLORS.white,
  },

  card: {
    marginHorizontal: 16,
    marginBottom: 16,
    backgroundColor: BLACK_SOFT,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: BORDER,
    padding: 16,
  },

  cardTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
  },

  title: { flex: 1, fontSize: 16, fontWeight: "900", color: COLORS.white },
  distance: { fontWeight: "800", color: YELLOW },

  address: { marginTop: 6, color: TEXT_MUTED },

  actions: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 16,
    gap: 12,
  },

  linkBtn: { paddingVertical: 8 },
  linkText: { color: YELLOW, fontWeight: "800" },

  primaryBtn: {
    backgroundColor: YELLOW,
    borderRadius: 24,
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  primaryText: { color: COLORS.darkText, fontWeight: "900" },

  emptyWrap: {
    paddingHorizontal: 20,
    paddingTop: 40,
    alignItems: "center",
  },
  emptyText: {
    color: TEXT_MUTED,
    fontSize: 14,
  },
});
