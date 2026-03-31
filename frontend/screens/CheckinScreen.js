import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  Image,
  ActivityIndicator,
  StyleSheet,
  TouchableOpacity,
  Linking,
  ScrollView,
  Animated,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as WebBrowser from "expo-web-browser";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { apiFetch } from "../api";
import COLORS from "../theme/colors";
import { useI18n } from "../i18n";

function resolveBillingPlanId(plan) {
  const raw = String(plan?.name || "").trim().toLowerCase();

  if (raw.includes("build")) return "basic";
  if (raw.includes("dominate")) return "pro";
  if (raw.includes("basic")) return "basic";
  if (raw.includes("pro")) return "pro";

  return null;
}

function normalizeMembershipPlanName(value) {
  const raw = String(value || "").trim();
  const lower = raw.toLowerCase();

  if (!raw) return "Membership";
  if (lower === "basic") return "Build";
  if (lower === "pro") return "Dominate";
  if (lower.includes("build")) return "Build";
  if (lower.includes("dominate")) return "Dominate";

  return raw;
}

export default function CheckinScreen({ navigation }) {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const [polling, setPolling] = useState(false);
  const [flash, setFlash] = useState({ visible: false, type: "success", text: "" });
  const shimmer = useMemo(() => new Animated.Value(0), []);

  const syncMembership = async () => {
    try {
      await apiFetch("/api/billing/sync-membership", {
        method: "POST",
        body: JSON.stringify({}),
      });
    } catch (error) {
      // Stripe may not be settled yet; keep polling and let webhook fallback finish.
    }
  };

  const refreshAll = async () => {
    const result = await queryClient.fetchQuery({
      queryKey: ["checkin"],
      queryFn: () => apiFetch("/api/checkin/code"),
    });

    await queryClient.invalidateQueries({ queryKey: ["home-membership"] });
    return result;
  };

  const checkinQuery = useQuery({
    queryKey: ["checkin"],
    queryFn: () => apiFetch("/api/checkin/code"),
    refetchInterval: polling ? 1500 : false,
    refetchOnMount: true,
  });

  const checkinData = checkinQuery.data || {};
  const shouldShowPlans = !!checkinData.show_plans;
  const plans = Array.isArray(checkinData.plans) ? checkinData.plans : [];
  const membershipExpiry = checkinData.membership_expiry || null;
  const membershipCode = checkinData.membership_code || "";
  const barcode = checkinData.barcode || null;
  const membershipPlanName = normalizeMembershipPlanName(
    checkinData.membership_plan_name || checkinData.membership_type || ""
  );

  const goToHistory = () => navigation.navigate("CheckinHistory");

  const startCheckout = async (plan) => {
    try {
      const billingPlanId = resolveBillingPlanId(plan);

      if (!billingPlanId) {
        setFlash({
          visible: true,
          type: "error",
          text: t("checkin_plan_not_linked"),
        });
        setTimeout(() => setFlash({ visible: false, type: "error", text: "" }), 1600);
        return;
      }

      const res = await apiFetch("/api/billing/create-checkout-session", {
        method: "POST",
        body: JSON.stringify({
          planId: billingPlanId,
          successUrl: "gympro://checkin?status=success",
          cancelUrl: "gympro://checkin?status=cancel",
        }),
      });

      if (!res?.url) {
        throw new Error("Checkout URL not received");
      }

      setPolling(true);
      const browserResult = await WebBrowser.openBrowserAsync(res.url);

      if (browserResult?.type !== "cancel") {
        await syncMembership();
        await refreshAll();
      }
    } catch (err) {
      setFlash({
        visible: true,
        type: "error",
        text: String(err?.message || t("checkin_unable_checkout")),
      });
      setTimeout(() => setFlash({ visible: false, type: "error", text: "" }), 1800);
    }
  };

  useEffect(() => {
    if (!barcode) return;

    Animated.sequence([
      Animated.timing(shimmer, {
        toValue: 1,
        duration: 180,
        useNativeDriver: true,
      }),
      Animated.timing(shimmer, {
        toValue: 0,
        duration: 320,
        useNativeDriver: true,
      }),
    ]).start();
  }, [barcode, shimmer]);

  useEffect(() => {
    const sub = Linking.addEventListener("url", () => {
      syncMembership().finally(refreshAll);
      setPolling(true);
    });

    (async () => {
      const initialUrl = await Linking.getInitialURL();
      if (initialUrl) {
        syncMembership().finally(refreshAll);
      }
    })();

    return () => sub.remove();
  }, []);

  useEffect(() => {
    const sub = Linking.addEventListener("url", (event) => {
      const url = event?.url || "";

      if (url.includes("status=success")) {
        setFlash({ visible: true, type: "success", text: t("checkin_payment_completed") });
        setTimeout(() => setFlash({ visible: false, type: "success", text: "" }), 1400);
      } else if (url.includes("status=error") || url.includes("status=cancel")) {
        setFlash({ visible: true, type: "error", text: t("checkin_payment_failed") });
        setTimeout(() => setFlash({ visible: false, type: "error", text: "" }), 1400);
      }
    });

    return () => sub.remove();
  }, []);

  useEffect(() => {
    if (!polling) return;

    let attempts = 0;
    const maxAttempts = 20;

    const timer = setInterval(async () => {
      attempts += 1;

      await syncMembership();
      const latest = await refreshAll();
      const stillShowingPlans = !!latest?.show_plans;

      if (!stillShowingPlans || attempts >= maxAttempts) {
        clearInterval(timer);
        setPolling(false);
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [polling, queryClient]);

  if (checkinQuery.isLoading) {
    return (
      <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>{t("checkin_loading_keytag")}</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (checkinQuery.isError) {
    return (
      <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
        <View style={styles.centerWrap}>
          <View style={styles.errorCard}>
            <Text style={styles.pageTitle}>{t("home_checkin")}</Text>
            <Text style={styles.pageSubTitle}>
              {String(checkinQuery.error?.message || t("checkin_error_loading"))}
            </Text>

            <TouchableOpacity style={styles.primaryBtn} onPress={refreshAll} activeOpacity={0.9}>
              <Text style={styles.primaryBtnText}>{t("common_refresh")}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  if (shouldShowPlans) {
    return (
      <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
        {flash.visible ? (
          <View
            style={[
              styles.flashOverlay,
              flash.type === "success" ? styles.flashSuccess : styles.flashError,
            ]}
          >
            <Text style={styles.flashText}>{flash.text}</Text>
          </View>
        ) : null}

        <ScrollView contentContainerStyle={styles.containerScroll} showsVerticalScrollIndicator={false}>
          <View style={styles.headerWrap}>
            <Text style={styles.pageTitle}>{t("checkin_title_locked")}</Text>
            <Text style={styles.pageSubTitle}>
              {t("checkin_sub_locked")}
            </Text>
          </View>

          <TouchableOpacity style={styles.secondaryWideBtn} onPress={goToHistory} activeOpacity={0.9}>
            <Text style={styles.secondaryWideBtnText}>{t("checkin_view_history")}</Text>
          </TouchableOpacity>

          {plans.length === 0 ? (
            <View style={styles.planCard}>
              <Text style={styles.planTitle}>{t("checkin_plans_not_loaded")}</Text>
              <Text style={styles.planSub}>{t("checkin_tap_refresh")}</Text>

              <TouchableOpacity style={styles.primaryBtn} onPress={refreshAll} activeOpacity={0.9}>
                <Text style={styles.primaryBtnText}>{t("common_refresh")}</Text>
              </TouchableOpacity>
            </View>
          ) : (
            plans.map((p) => (
              <View key={p.id} style={styles.planCard}>
                <View style={styles.planTopRow}>
                  <View style={styles.planIconWrap}>
                    <Ionicons
                      name={String(p.name || "").toLowerCase().includes("dominate") ? "flash" : "barbell"}
                      size={18}
                      color={COLORS.primary}
                    />
                  </View>

                  <View style={styles.planTextWrap}>
                    <Text style={styles.planTitle}>{p.name}</Text>
                    <Text style={styles.planPrice}>
                      ${Number(p.price || 0).toFixed(2)} / {p.period || "month"}
                    </Text>
                  </View>
                </View>

                {!!p.features && (
                  <Text style={styles.featureText}>
                    {Array.isArray(p.features) ? p.features.join(", ") : String(p.features)}
                  </Text>
                )}

                <TouchableOpacity
                  style={styles.primaryBtn}
                  onPress={() => startCheckout(p)}
                  activeOpacity={0.9}
                >
                  <Text style={styles.primaryBtnText}>{t("checkin_buy_plan")}</Text>
                </TouchableOpacity>
              </View>
            ))
          )}

          {polling ? (
            <Text style={styles.helperText}>{t("checkin_waiting")}</Text>
          ) : (
            <Text style={styles.helperText}>
              {t("checkin_after_payment")}
            </Text>
          )}
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      {flash.visible ? (
        <View
          style={[
            styles.flashOverlay,
            flash.type === "success" ? styles.flashSuccess : styles.flashError,
          ]}
        >
          <Text style={styles.flashText}>{flash.text}</Text>
        </View>
      ) : null}

      <ScrollView contentContainerStyle={styles.containerScroll} showsVerticalScrollIndicator={false}>
        <View style={styles.headerWrap}>
          <Text style={styles.pageTitle}>{t("checkin_member_keytag")}</Text>
          <Text style={styles.pageSubTitle}>{t("checkin_member_sub")}</Text>
        </View>

        <View style={styles.membershipCard}>
          <View style={styles.cardGlowOne} />
          <View style={styles.cardGlowTwo} />

          <View style={styles.topBadgeRow}>
            <Text style={styles.brandText}>VYAY FITNESS</Text>
            <View style={styles.activeBadge}>
              <Text style={styles.activeBadgeText}>{t("checkin_active_member")}</Text>
            </View>
          </View>

          <View style={styles.planBlock}>
            <Text style={styles.membershipLabel}>{membershipPlanName}</Text>
            <Text style={styles.tagline}>{t("home_tagline")}</Text>
          </View>

          <View style={styles.barcodeOuter}>
            {!barcode ? (
              <View style={styles.barcodeMissingBox}>
                <MaterialCommunityIcons name="barcode-off" size={34} color={COLORS.danger} />
                <Text style={styles.barcodeMissingText}>{t("checkin_barcode_missing")}</Text>
              </View>
            ) : (
              <View style={styles.barcodeFrame}>
                <Animated.View
                  pointerEvents="none"
                  style={[
                    styles.shimmerOverlay,
                    {
                      opacity: shimmer.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0, 0.14],
                      }),
                    },
                  ]}
                />
                <Image source={{ uri: barcode }} style={styles.barcodeImage} resizeMode="contain" />
              </View>
            )}
          </View>

          <View style={styles.codeBlock}>
            <Text style={styles.memberCodeLabel}>{t("checkin_member_code")}</Text>
            <Text style={styles.memberCodeValue}>{membershipCode || t("checkin_not_available")}</Text>

            {membershipExpiry ? (
              <Text style={styles.expiryText}>
                {t("checkin_valid_until", {
                  date: new Date(membershipExpiry).toLocaleDateString(),
                })}
              </Text>
            ) : null}
          </View>

          <View style={styles.actionRow}>
            <TouchableOpacity style={styles.secondaryBtnHalf} onPress={refreshAll} activeOpacity={0.9}>
              <Ionicons name="refresh" size={16} color={COLORS.softWhite} />
              <Text style={styles.secondaryBtnText}>{t("common_refresh")}</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.primaryBtnHalf} onPress={goToHistory} activeOpacity={0.9}>
              <Ionicons name="time-outline" size={16} color={COLORS.white} />
              <Text style={styles.primaryBtnHalfText}>{t("checkin_history")}</Text>
            </TouchableOpacity>
          </View>
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

  loadingWrap: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
  },
  loadingText: {
    color: COLORS.muted,
    marginTop: 14,
    fontSize: 14,
    fontWeight: "600",
  },

  centerWrap: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 18,
  },
  errorCard: {
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 24,
    padding: 22,
    alignItems: "center",
  },

  containerScroll: {
    paddingHorizontal: 18,
    paddingTop: 8,
    paddingBottom: 34,
  },
  headerWrap: {
    alignItems: "center",
    marginBottom: 18,
  },
  pageTitle: {
    fontSize: 30,
    fontWeight: "900",
    color: COLORS.white,
    marginTop: 8,
    letterSpacing: 0.2,
  },
  pageSubTitle: {
    marginTop: 8,
    fontSize: 13,
    color: COLORS.muted,
    textAlign: "center",
    lineHeight: 19,
    maxWidth: 320,
  },

  membershipCard: {
    width: "100%",
    backgroundColor: COLORS.card,
    borderRadius: 30,
    paddingTop: 20,
    paddingBottom: 20,
    paddingHorizontal: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOpacity: 0.35,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  cardGlowOne: {
    position: "absolute",
    top: -30,
    right: -20,
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: "rgba(59,130,246,0.10)",
  },
  cardGlowTwo: {
    position: "absolute",
    bottom: -40,
    left: -20,
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: "rgba(59,130,246,0.08)",
  },

  topBadgeRow: {
    alignItems: "center",
    marginBottom: 18,
  },
  brandText: {
    color: COLORS.white,
    fontSize: 24,
    fontWeight: "900",
    letterSpacing: 1.2,
  },
  activeBadge: {
    marginTop: 12,
    backgroundColor: "rgba(59,130,246,0.14)",
    borderWidth: 1,
    borderColor: "rgba(59,130,246,0.35)",
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 999,
  },
  activeBadgeText: {
    color: COLORS.primarySoft,
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 0.7,
  },

  planBlock: {
    alignItems: "center",
    marginBottom: 18,
  },
  membershipLabel: {
    color: COLORS.white,
    fontSize: 30,
    fontWeight: "900",
    textAlign: "center",
  },
  tagline: {
    color: COLORS.muted,
    marginTop: 8,
    textAlign: "center",
    fontSize: 14,
  },

  barcodeOuter: {
    width: "100%",
    alignItems: "center",
    marginTop: 2,
    marginBottom: 14,
  },
  barcodeFrame: {
    width: "100%",
    backgroundColor: COLORS.white,
    borderRadius: 24,
    paddingVertical: 18,
    paddingHorizontal: 12,
    overflow: "hidden",
    alignItems: "center",
  },
  barcodeImage: {
    width: "100%",
    height: 148,
  },
  shimmerOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: COLORS.primary,
  },
  barcodeMissingBox: {
    width: "100%",
    backgroundColor: COLORS.bgDeep,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 24,
    paddingVertical: 30,
    paddingHorizontal: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  barcodeMissingText: {
    color: COLORS.muted,
    fontSize: 14,
    fontWeight: "600",
    textAlign: "center",
    marginTop: 12,
  },

  codeBlock: {
    alignItems: "center",
    marginTop: 4,
  },
  memberCodeLabel: {
    color: COLORS.muted2,
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  memberCodeValue: {
    color: COLORS.white,
    fontSize: 20,
    fontWeight: "800",
    letterSpacing: 2,
    marginTop: 8,
    textAlign: "center",
  },
  expiryText: {
    color: COLORS.muted,
    fontSize: 13,
    marginTop: 10,
    textAlign: "center",
  },

  actionRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 22,
    width: "100%",
  },

  primaryBtn: {
    marginTop: 14,
    backgroundColor: COLORS.primary,
    paddingVertical: 13,
    paddingHorizontal: 20,
    borderRadius: 16,
    minWidth: 150,
    alignItems: "center",
  },
  primaryBtnText: {
    color: COLORS.white,
    fontWeight: "800",
    fontSize: 14,
  },

  primaryBtnHalf: {
    flex: 1,
    backgroundColor: COLORS.primary,
    paddingVertical: 14,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  primaryBtnHalfText: {
    color: COLORS.white,
    fontWeight: "800",
    fontSize: 14,
  },

  secondaryWideBtn: {
    width: "100%",
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.borderSoft,
    paddingVertical: 13,
    borderRadius: 16,
    alignItems: "center",
    marginBottom: 2,
  },
  secondaryWideBtnText: {
    color: COLORS.softWhite,
    fontWeight: "800",
    fontSize: 14,
  },

  secondaryBtnHalf: {
    flex: 1,
    backgroundColor: COLORS.bgDeep,
    borderWidth: 1,
    borderColor: COLORS.borderSoft,
    paddingVertical: 14,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  secondaryBtnText: {
    color: COLORS.softWhite,
    fontWeight: "800",
    fontSize: 14,
  },

  planCard: {
    width: "100%",
    backgroundColor: COLORS.cardSoft,
    borderRadius: 22,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginTop: 12,
  },
  planTopRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  planIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: "rgba(59,130,246,0.14)",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  planTextWrap: {
    flex: 1,
  },
  planTitle: {
    fontSize: 18,
    fontWeight: "900",
    color: COLORS.white,
  },
  planPrice: {
    marginTop: 6,
    fontSize: 14,
    color: COLORS.primarySoft,
    fontWeight: "800",
  },
  planSub: {
    marginTop: 8,
    fontSize: 13,
    color: COLORS.muted,
    textAlign: "center",
    lineHeight: 18,
  },
  featureText: {
    marginTop: 14,
    color: COLORS.muted,
    lineHeight: 19,
    fontSize: 13,
  },

  helperText: {
    marginTop: 16,
    color: COLORS.muted2,
    textAlign: "center",
    lineHeight: 18,
    fontSize: 12,
  },

  flashOverlay: {
    position: "absolute",
    top: 10,
    left: 16,
    right: 16,
    zIndex: 999,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    alignItems: "center",
  },
  flashSuccess: {
    backgroundColor: "rgba(34,197,94,0.95)",
  },
  flashError: {
    backgroundColor: "rgba(239,68,68,0.95)",
  },
  flashText: {
    color: COLORS.white,
    fontWeight: "800",
  },
});
