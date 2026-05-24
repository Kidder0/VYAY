import React, { useCallback, useMemo, useState } from "react";
import * as Haptics from "expo-haptics";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  StatusBar,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "../api";
import COLORS from "../theme/colors";
import { useI18n } from "../i18n";

function normalizeMembershipName(value) {
  const raw = String(value || "").trim().toLowerCase();

  if (!raw) return null;
  if (raw === "basic") return "Build";
  if (raw === "pro") return "Dominate";
  if (raw.includes("build")) return "Build";
  if (raw.includes("dominate")) return "Dominate";

  return value;
}

function getProgressValue(hasMembership, membershipPlan, checkinCount) {
  if (!hasMembership) return 32;
  if (membershipPlan === "Dominate") return Math.min(94, 60 + checkinCount * 6);
  return Math.min(84, 48 + checkinCount * 5);
}

function buildWorkoutCards(hasMembership, membershipPlan, t) {
  if (!hasMembership) {
    return [
      {
        id: "starter",
        tag: "Start Smart",
        title: "Build Foundations",
        subtitle: "Low-impact strength and consistency first.",
        metaOne: "3 sessions",
        metaTwo: "20-30 min",
        icon: "barbell-outline",
      },
      {
        id: "mobility",
        tag: "Recovery",
        title: "Stretch & Reset",
        subtitle: "Mobility flow to keep your body loose and ready.",
        metaOne: "Daily",
        metaTwo: "12 min",
        icon: "body-outline",
      },
    ];
  }

  if (membershipPlan === "Build") {
    return [
      {
        id: "upper",
        tag: "Upper Body",
        title: "Push Strength",
        subtitle: "Chest, shoulders, and triceps with clean form.",
        metaOne: "4 moves",
        metaTwo: "35 min",
        icon: "fitness-outline",
      },
      {
        id: "conditioning",
        tag: "Conditioning",
        title: "Finish Strong",
        subtitle: "Short treadmill and bike intervals after lifting.",
        metaOne: "2 rounds",
        metaTwo: "15 min",
        icon: "speedometer-outline",
      },
    ];
  }

  return [
    {
      id: "performance",
      tag: "Performance",
      title: "Athletic Power",
      subtitle: "Explosive lower body work with stronger recovery pacing.",
      metaOne: "5 blocks",
      metaTwo: "45 min",
      icon: "flash-outline",
    },
    {
      id: "nutrition",
      tag: "Fuel",
      title: "Recovery Focus",
      subtitle: "Pair heavy training days with protein and hydration goals.",
      metaOne: "120g protein",
      metaTwo: "2.5L water",
      icon: "nutrition-outline",
    },
  ];
}

export default function HomeScreen({ navigation }) {
  const { t } = useI18n();
  const [activeSegment, setActiveSegment] = useState("overview");
  const [activeFilter, setActiveFilter] = useState("all");

  const goAccount = useCallback(() => {
    navigation.navigate("Account");
  }, [navigation]);

  const goCheckin = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    navigation.navigate("Checkin");
  }, [navigation]);

  const goMawab = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    navigation.navigate("Mawab");
  }, [navigation]);

  const membershipQuery = useQuery({
    queryKey: ["home-membership"],
    queryFn: () => apiFetch("/api/checkin/code"),
    refetchOnMount: true,
    staleTime: 15000,
  });

  const historyQuery = useQuery({
    queryKey: ["home-history"],
    queryFn: () => apiFetch("/api/checkin/history"),
    staleTime: 15000,
    refetchOnMount: true,
  });

  const membershipData = membershipQuery.data || {};
  const history = Array.isArray(historyQuery.data?.checkins)
    ? historyQuery.data.checkins
    : [];
  const hasMembership =
    !membershipData?.show_plans && !!membershipData?.membership_code;

  const membershipPlan = normalizeMembershipName(
    membershipData?.membership_plan_name ||
      membershipData?.membership_type ||
      ""
  );

  const checkinCount = history.length;
  const progressValue = getProgressValue(
    hasMembership,
    membershipPlan,
    checkinCount
  );
  const expiryText = membershipData?.membership_expiry
    ? new Date(membershipData.membership_expiry).toLocaleDateString()
    : "Choose a plan";

  const workoutCards = useMemo(
    () => buildWorkoutCards(hasMembership, membershipPlan, t),
    [hasMembership, membershipPlan, t]
  );

  const statCards = [
    {
      id: "progress",
      label: "Momentum",
      value: `${progressValue}%`,
      sub: hasMembership ? "Consistency score" : "Join to unlock",
      icon: "flame-outline",
      highlight: true,
    },
    {
      id: "plan",
      label: "Plan",
      value: membershipPlan || "Guest",
      sub: hasMembership ? "Membership active" : "No active plan",
      icon: "wallet-outline",
    },
    {
      id: "visits",
      label: "Visits",
      value: `${checkinCount}`,
      sub: "Recent check-ins",
      icon: "footsteps-outline",
    },
    {
      id: "expiry",
      label: "Valid Until",
      value: expiryText,
      sub: hasMembership ? "Membership expiry" : "Tap to explore",
      icon: "calendar-outline",
    },
  ];

  const filterChips = [
    { id: "all", label: "All Types" },
    { id: "strength", label: "Strength" },
    { id: "recovery", label: "Recovery" },
    { id: "access", label: "Access" },
  ];

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "left", "right"]}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.bg} />
      <View style={styles.container}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.headerRow}>
            <TouchableOpacity
              style={styles.avatarButton}
              onPress={goAccount}
              activeOpacity={0.9}
            >
              <Ionicons name="person-outline" size={20} color={COLORS.softWhite} />
            </TouchableOpacity>

            <View style={styles.headerCenter}>
              <Text style={styles.headerTitle}>Progress</Text>
              <Text style={styles.headerSubtitle}>{t("home_tagline")}</Text>
            </View>

            <TouchableOpacity
              style={styles.menuButton}
              onPress={goMawab}
              activeOpacity={0.9}
            >
              <Ionicons
                name="ellipsis-horizontal"
                size={20}
                color={COLORS.softWhite}
              />
            </TouchableOpacity>
          </View>

          <View style={styles.segmentWrap}>
            <TouchableOpacity
              style={[
                styles.segmentButton,
                activeSegment === "overview" && styles.segmentButtonActive,
              ]}
              activeOpacity={0.9}
              onPress={() => setActiveSegment("overview")}
            >
              <Text
                style={[
                  styles.segmentText,
                  activeSegment === "overview" && styles.segmentTextActive,
                ]}
              >
                Daily
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.segmentButton,
                activeSegment === "membership" && styles.segmentButtonActive,
              ]}
              activeOpacity={0.9}
              onPress={() => setActiveSegment("membership")}
            >
              <Text
                style={[
                  styles.segmentText,
                  activeSegment === "membership" && styles.segmentTextActive,
                ]}
              >
                Membership
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.progressPanel}>
            <View style={styles.progressPanelLeft}>
              <View style={styles.progressRingOuter}>
                <View style={styles.progressRingInner}>
                  <Text style={styles.progressValue}>{progressValue}%</Text>
                </View>
              </View>

              <Text style={styles.progressLabel}>Average</Text>
              <Text style={styles.progressMeta}>
                {hasMembership ? "Strong weekly rhythm" : "Get started today"}
              </Text>
            </View>

            <View style={styles.metricsGrid}>
              {statCards.map((card) => (
                <TouchableOpacity
                  key={card.id}
                  style={[
                    styles.metricCard,
                    card.highlight && styles.metricCardHighlight,
                  ]}
                  activeOpacity={0.92}
                  onPress={card.id === "visits" ? () => navigation.navigate("CheckinHistory") : goCheckin}
                >
                  <View style={styles.metricTopRow}>
                    <Ionicons
                      name={card.icon}
                      size={16}
                      color={card.highlight ? COLORS.darkText : COLORS.primarySoft}
                    />
                    <Text
                      style={[
                        styles.metricLabel,
                        card.highlight && styles.metricLabelHighlight,
                      ]}
                    >
                      {card.label}
                    </Text>
                  </View>

                  <Text
                    style={[
                      styles.metricValue,
                      card.highlight && styles.metricValueHighlight,
                    ]}
                  >
                    {card.value}
                  </Text>
                  <Text
                    style={[
                      styles.metricSub,
                      card.highlight && styles.metricSubHighlight,
                    ]}
                  >
                    {card.sub}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.quickCheckinCard}>
            <View>
              <Text style={styles.quickCheckinEyebrow}>{t("home_quick_actions")}</Text>
              <Text style={styles.quickCheckinTitle}>Train with more intention.</Text>
              <Text style={styles.quickCheckinSub}>
                Open your barcode fast and keep your club access ready.
              </Text>
            </View>

            <TouchableOpacity
              style={styles.quickCheckinButton}
              activeOpacity={0.92}
              onPress={goCheckin}
            >
              <Text style={styles.quickCheckinButtonText}>{t("home_checkin")}</Text>
              <Ionicons name="arrow-forward" size={18} color={COLORS.darkText} />
            </TouchableOpacity>
          </View>

          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Find your workout</Text>
            <Text style={styles.sectionSubtitle}>
              Personalized ideas shaped around your membership flow.
            </Text>
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filterRow}
          >
            {filterChips.map((chip) => (
              <TouchableOpacity
                key={chip.id}
                style={[
                  styles.filterChip,
                  activeFilter === chip.id && styles.filterChipActive,
                ]}
                activeOpacity={0.9}
                onPress={() => setActiveFilter(chip.id)}
              >
                <Text
                  style={[
                    styles.filterChipText,
                    activeFilter === chip.id && styles.filterChipTextActive,
                  ]}
                >
                  {chip.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {membershipQuery.isLoading || historyQuery.isLoading ? (
            <View style={styles.loadingCard}>
              <ActivityIndicator size="small" color={COLORS.primary} />
              <Text style={styles.loadingText}>{t("home_loading_membership")}</Text>
            </View>
          ) : null}

          {workoutCards.map((card) => (
            <TouchableOpacity
              key={card.id}
              style={styles.workoutCard}
              activeOpacity={0.95}
              onPress={goCheckin}
            >
              <View style={styles.workoutCardContent}>
                <View style={styles.workoutTextWrap}>
                  <View style={styles.workoutTag}>
                    <Text style={styles.workoutTagText}>{card.tag}</Text>
                  </View>

                  <Text style={styles.workoutTitle}>{card.title}</Text>
                  <Text style={styles.workoutSubtitle}>{card.subtitle}</Text>

                  <View style={styles.workoutMetaRow}>
                    <View style={styles.workoutMetaItem}>
                      <Ionicons
                        name="time-outline"
                        size={13}
                        color={COLORS.muted}
                      />
                      <Text style={styles.workoutMetaText}>{card.metaOne}</Text>
                    </View>

                    <View style={styles.workoutMetaItem}>
                      <Ionicons
                        name="pulse-outline"
                        size={13}
                        color={COLORS.muted}
                      />
                      <Text style={styles.workoutMetaText}>{card.metaTwo}</Text>
                    </View>
                  </View>
                </View>

                <View style={styles.workoutVisual}>
                  <View style={styles.workoutIconCircle}>
                    <Ionicons name={card.icon} size={28} color={COLORS.darkText} />
                  </View>
                </View>
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <View style={styles.bottomBar}>
          <TouchableOpacity style={styles.navButton} activeOpacity={0.95}>
            <View style={styles.navIconWrap}>
              <Ionicons name="home" size={20} color={COLORS.darkText} />
            </View>
            <Text style={styles.navText}>{t("home_bottom_home")}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.centerActionButton}
            activeOpacity={0.95}
            onPress={goCheckin}
          >
            <Ionicons name="scan-outline" size={22} color={COLORS.darkText} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.navButton}
            activeOpacity={0.95}
            onPress={goMawab}
          >
            <View style={[styles.navIconWrap, styles.navIconWrapMuted]}>
              <MaterialCommunityIcons
                name="robot-outline"
                size={20}
                color={COLORS.softWhite}
              />
            </View>
            <Text style={styles.navText}>{t("home_bottom_mawab")}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 140,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 18,
  },
  avatarButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: "center",
    justifyContent: "center",
  },
  menuButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: "center",
    justifyContent: "center",
  },
  headerCenter: {
    alignItems: "center",
  },
  headerTitle: {
    color: COLORS.white,
    fontSize: 20,
    fontWeight: "900",
  },
  headerSubtitle: {
    color: COLORS.muted,
    fontSize: 12,
    marginTop: 4,
  },
  segmentWrap: {
    flexDirection: "row",
    alignSelf: "center",
    backgroundColor: COLORS.card,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 4,
    marginBottom: 18,
  },
  segmentButton: {
    paddingHorizontal: 30,
    paddingVertical: 11,
    borderRadius: 14,
  },
  segmentButtonActive: {
    backgroundColor: COLORS.primary,
  },
  segmentText: {
    color: COLORS.muted,
    fontSize: 13,
    fontWeight: "700",
  },
  segmentTextActive: {
    color: COLORS.darkText,
  },
  progressPanel: {
    flexDirection: "row",
    backgroundColor: COLORS.cardSoft,
    borderRadius: 30,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 18,
    marginBottom: 20,
  },
  progressPanelLeft: {
    width: 112,
    alignItems: "center",
    justifyContent: "center",
    paddingRight: 12,
  },
  progressRingOuter: {
    width: 92,
    height: 92,
    borderRadius: 46,
    backgroundColor: COLORS.primary,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: COLORS.primary,
    shadowOpacity: 0.25,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
  },
  progressRingInner: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: COLORS.bgDeep,
    alignItems: "center",
    justifyContent: "center",
  },
  progressValue: {
    color: COLORS.white,
    fontSize: 19,
    fontWeight: "900",
  },
  progressLabel: {
    color: COLORS.softWhite,
    fontSize: 13,
    fontWeight: "700",
    marginTop: 10,
  },
  progressMeta: {
    color: COLORS.muted,
    fontSize: 11,
    marginTop: 4,
    textAlign: "center",
  },
  metricsGrid: {
    flex: 1,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  metricCard: {
    width: "47.5%",
    backgroundColor: COLORS.card,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 14,
  },
  metricCardHighlight: {
    backgroundColor: COLORS.primarySoft,
    borderColor: COLORS.primarySoft,
  },
  metricTopRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 8,
  },
  metricLabel: {
    color: COLORS.muted,
    fontSize: 11,
    fontWeight: "700",
  },
  metricLabelHighlight: {
    color: COLORS.darkText,
  },
  metricValue: {
    color: COLORS.white,
    fontSize: 19,
    fontWeight: "900",
    marginBottom: 6,
  },
  metricValueHighlight: {
    color: COLORS.darkText,
  },
  metricSub: {
    color: COLORS.muted,
    fontSize: 11,
    lineHeight: 15,
  },
  metricSubHighlight: {
    color: "#473A14",
  },
  quickCheckinCard: {
    backgroundColor: COLORS.card,
    borderRadius: 26,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 20,
    marginBottom: 22,
  },
  quickCheckinEyebrow: {
    color: COLORS.primarySoft,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1,
    marginBottom: 8,
    textTransform: "uppercase",
  },
  quickCheckinTitle: {
    color: COLORS.white,
    fontSize: 30,
    fontWeight: "900",
    lineHeight: 34,
    maxWidth: "88%",
  },
  quickCheckinSub: {
    color: COLORS.muted,
    fontSize: 14,
    lineHeight: 21,
    marginTop: 10,
    maxWidth: "92%",
  },
  quickCheckinButton: {
    marginTop: 18,
    minHeight: 54,
    borderRadius: 17,
    backgroundColor: COLORS.primary,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  quickCheckinButtonText: {
    color: COLORS.darkText,
    fontSize: 15,
    fontWeight: "900",
  },
  sectionHeader: {
    marginBottom: 14,
  },
  sectionTitle: {
    color: COLORS.white,
    fontSize: 26,
    fontWeight: "900",
  },
  sectionSubtitle: {
    color: COLORS.muted,
    fontSize: 14,
    lineHeight: 21,
    marginTop: 6,
    maxWidth: "90%",
  },
  filterRow: {
    paddingBottom: 8,
    gap: 10,
  },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  filterChipActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  filterChipText: {
    color: COLORS.softWhite,
    fontSize: 12,
    fontWeight: "700",
  },
  filterChipTextActive: {
    color: COLORS.darkText,
  },
  loadingCard: {
    marginTop: 8,
    marginBottom: 16,
    backgroundColor: COLORS.card,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingVertical: 15,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  loadingText: {
    color: COLORS.softWhite,
    fontSize: 13,
    fontWeight: "600",
  },
  workoutCard: {
    backgroundColor: COLORS.cardSoft,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 18,
    marginBottom: 16,
  },
  workoutCardContent: {
    flexDirection: "row",
    alignItems: "center",
  },
  workoutTextWrap: {
    flex: 1,
    paddingRight: 16,
  },
  workoutTag: {
    alignSelf: "flex-start",
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginBottom: 12,
  },
  workoutTagText: {
    color: COLORS.primarySoft,
    fontSize: 11,
    fontWeight: "800",
  },
  workoutTitle: {
    color: COLORS.white,
    fontSize: 22,
    fontWeight: "900",
    marginBottom: 8,
  },
  workoutSubtitle: {
    color: COLORS.muted,
    fontSize: 14,
    lineHeight: 20,
  },
  workoutMetaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    marginTop: 14,
  },
  workoutMetaItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  workoutMetaText: {
    color: COLORS.muted,
    fontSize: 12,
    fontWeight: "600",
  },
  workoutVisual: {
    width: 96,
    alignItems: "center",
    justifyContent: "center",
  },
  workoutIconCircle: {
    width: 74,
    height: 74,
    borderRadius: 37,
    backgroundColor: COLORS.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  bottomBar: {
    position: "absolute",
    left: 18,
    right: 18,
    bottom: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "rgba(18, 20, 15, 0.95)",
    borderRadius: 26,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  navButton: {
    alignItems: "center",
    justifyContent: "center",
    minWidth: 82,
  },
  navIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.primary,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 6,
  },
  navIconWrapMuted: {
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  navText: {
    color: COLORS.softWhite,
    fontSize: 13,
    fontWeight: "700",
  },
  centerActionButton: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: COLORS.primary,
    alignItems: "center",
    justifyContent: "center",
    marginTop: -28,
    shadowColor: COLORS.primary,
    shadowOpacity: 0.25,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
});
