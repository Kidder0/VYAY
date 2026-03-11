import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  Image,
  ActivityIndicator,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Linking,
  ScrollView,
  Animated,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as WebBrowser from "expo-web-browser";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "../api";

const COLORS = {
  yellow: "#FFD700",
  black: "#0B0B0B",
  card: "#121212",
  card2: "#161616",
  border: "rgba(255,255,255,0.10)",
  muted: "rgba(255,255,255,0.65)",
  white: "#FFFFFF",
  danger: "#EF4444",
  ok: "#22C55E",
};

function resolveBillingPlanId(plan) {
  const raw = String(plan?.name || "").trim().toLowerCase();

  if (raw.includes("basic")) return "basic";
  if (raw.includes("pro")) return "pro";

  return null;
}

export default function CheckinScreen({ navigation }) {
  const queryClient = useQueryClient();
  const [polling, setPolling] = useState(false);
  const [flash, setFlash] = useState({ visible: false, type: "success", text: "" });
  const shimmer = useMemo(() => new Animated.Value(0), []);

  const checkinQuery = useQuery({
    queryKey: ["checkin"],
    queryFn: () => apiFetch("/api/checkin/code"),
    refetchInterval: 30000,
    refetchOnMount: true,
  });

  const checkinData = checkinQuery.data || {};
  const shouldShowPlans = !!checkinData.show_plans;
  const plans = Array.isArray(checkinData.plans) ? checkinData.plans : [];
  const membershipExpiry = checkinData.membership_expiry || null;
  const membershipCode = checkinData.membership_code || "";
  const barcode = checkinData.barcode || null;

  const refreshAll = async () => {
    await queryClient.invalidateQueries({ queryKey: ["checkin"] });
  };

  useEffect(() => {
    if (!barcode) return;

    Animated.sequence([
      Animated.timing(shimmer, {
        toValue: 1,
        duration: 150,
        useNativeDriver: true,
      }),
      Animated.timing(shimmer, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start();
  }, [barcode, shimmer]);

  useEffect(() => {
    const sub = Linking.addEventListener("url", () => {
      refreshAll();
      setPolling(true);
    });

    (async () => {
      const initialUrl = await Linking.getInitialURL();
      if (initialUrl) {
        refreshAll();
      }
    })();

    return () => sub.remove();
  }, []);

  useEffect(() => {
    const sub = Linking.addEventListener("url", (event) => {
      const url = event?.url || "";

      if (url.includes("status=success")) {
        setFlash({ visible: true, type: "success", text: "✅ Payment completed!" });
        setTimeout(() => setFlash({ visible: false, type: "success", text: "" }), 1200);
      } else if (url.includes("status=error")) {
        setFlash({ visible: true, type: "error", text: "❌ Payment failed" });
        setTimeout(() => setFlash({ visible: false, type: "error", text: "" }), 1200);
      }
    });

    return () => sub.remove();
  }, []);

  useEffect(() => {
    if (!polling) return;

    let attempts = 0;
    const maxAttempts = 15;

    const timer = setInterval(async () => {
      attempts += 1;

      await queryClient.invalidateQueries({ queryKey: ["checkin"] });
      const latest = queryClient.getQueryData(["checkin"]);
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
        <ActivityIndicator size="large" style={{ marginTop: 100 }} color={COLORS.yellow} />
      </SafeAreaView>
    );
  }

  if (checkinQuery.isError) {
    return (
      <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
        <View style={styles.container}>
          <Text style={styles.title}>GymPro Check-in</Text>
          <Text style={styles.subTitle}>
            {String(checkinQuery.error?.message || "Error")}
          </Text>

          <TouchableOpacity style={styles.primaryBtn} onPress={refreshAll}>
            <Text style={styles.primaryBtnText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const startCheckout = async (plan) => {
    try {
      const billingPlanId = resolveBillingPlanId(plan);

      if (!billingPlanId) {
        Alert.alert(
          "Plan Error",
          "This plan is not mapped yet in billing. Use Basic or Pro."
        );
        return;
      }

      const res = await apiFetch("/api/billing/create-checkout-session", {
        method: "POST",
        body: JSON.stringify({ planId: billingPlanId }),
      });

      if (!res?.url) {
        Alert.alert("Error", "No checkout URL received");
        return;
      }

      await WebBrowser.openBrowserAsync(res.url);
      setPolling(true);
      refreshAll();
    } catch (err) {
      Alert.alert("Checkout failed", err.message || "Unable to start checkout");
    }
  };

  const goToHistory = () => navigation?.navigate?.("CheckinHistory");

  if (shouldShowPlans) {
    return (
      <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
        <ScrollView contentContainerStyle={styles.containerScroll}>
          <Text style={styles.title}>Choose a Plan</Text>
          <Text style={styles.subTitle}>
            You must enroll in a plan to enable check-in.
          </Text>

          <TouchableOpacity style={styles.outlineBtn} onPress={goToHistory} activeOpacity={0.9}>
            <Text style={styles.outlineBtnText}>View History</Text>
          </TouchableOpacity>

          {plans.length === 0 ? (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Plans not loaded</Text>
              <Text style={styles.cardSub}>Tap refresh to try again.</Text>

              <TouchableOpacity style={styles.outlineBtn} onPress={refreshAll} activeOpacity={0.9}>
                <Text style={styles.outlineBtnText}>Refresh</Text>
              </TouchableOpacity>
            </View>
          ) : (
            plans.map((p) => (
              <View key={p.id} style={[styles.card, { marginTop: 12 }]}>
                <Text style={styles.cardTitle}>{p.name}</Text>
                <Text style={styles.cardSub}>
                  ${Number(p.price || 0).toFixed(2)} / {p.period || "month"}
                </Text>

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
                  <Text style={styles.primaryBtnText}>Buy Plan</Text>
                </TouchableOpacity>
              </View>
            ))
          )}

          {polling ? (
            <Text style={styles.helperText}>Waiting for payment confirmation…</Text>
          ) : (
            <Text style={styles.helperText}>
              After payment, return here and refresh if needed.
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

      <View style={styles.container}>
        <Text style={styles.title}>GymPro Check-in</Text>
        <Text style={styles.subTitle}>Show this barcode at the front desk</Text>

        <View style={styles.card}>
          {!barcode ? (
            <Text style={[styles.cardSub, { color: COLORS.danger }]}>
              Barcode missing. Tap Refresh.
            </Text>
          ) : (
            <View style={styles.barcodeFrame}>
              <Animated.View
                pointerEvents="none"
                style={[
                  styles.shimmerOverlay,
                  {
                    opacity: shimmer.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0, 0.18],
                    }),
                  },
                ]}
              />

              <Image source={{ uri: barcode }} style={styles.barcodeImage} />
            </View>
          )}

          <Text style={styles.codeText}>
            Membership Code: {membershipCode || "Not available"}
          </Text>

          {membershipExpiry ? (
            <Text style={styles.expiryText}>
              Membership Expires: {new Date(membershipExpiry).toLocaleDateString()}
            </Text>
          ) : null}

          <TouchableOpacity style={styles.outlineBtn} onPress={refreshAll} activeOpacity={0.9}>
            <Text style={styles.outlineBtnText}>Refresh</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.outlineBtn} onPress={goToHistory} activeOpacity={0.9}>
            <Text style={styles.outlineBtnText}>View History</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.black },
  container: { flex: 1, padding: 16, alignItems: "center" },
  containerScroll: { padding: 16, alignItems: "center" },

  title: {
    fontSize: 24,
    fontWeight: "900",
    color: COLORS.yellow,
    marginTop: 8,
  },

  subTitle: {
    marginTop: 6,
    marginBottom: 14,
    fontSize: 13,
    color: COLORS.muted,
    textAlign: "center",
  },

  card: {
    width: "100%",
    backgroundColor: COLORS.card,
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: "center",
  },

  cardTitle: {
    fontSize: 16,
    fontWeight: "900",
    color: COLORS.white,
  },

  cardSub: {
    marginTop: 6,
    fontSize: 12,
    color: COLORS.muted,
    textAlign: "center",
  },

  featureText: {
    marginTop: 10,
    color: COLORS.muted,
    textAlign: "center",
    fontSize: 12,
  },

  barcodeFrame: {
    width: "100%",
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    paddingVertical: 26,
    alignItems: "center",
    marginVertical: 20,
    overflow: "hidden",
    position: "relative",
  },

  barcodeImage: {
    width: "100%",
    height: 170,
    resizeMode: "contain",
  },

  shimmerOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: COLORS.yellow,
  },

  codeText: {
    fontSize: 14,
    fontWeight: "800",
    color: COLORS.white,
    marginTop: 6,
    textAlign: "center",
  },

  expiryText: {
    marginTop: 6,
    fontSize: 12,
    color: COLORS.muted,
    textAlign: "center",
  },

  primaryBtn: {
    width: "100%",
    backgroundColor: COLORS.yellow,
    paddingVertical: 14,
    borderRadius: 30,
    alignItems: "center",
    marginTop: 14,
  },

  primaryBtnText: {
    color: "#000",
    fontWeight: "900",
  },

  outlineBtn: {
    width: "100%",
    borderWidth: 1.5,
    borderColor: COLORS.yellow,
    paddingVertical: 14,
    borderRadius: 30,
    alignItems: "center",
    marginTop: 12,
    backgroundColor: COLORS.card2,
  },

  outlineBtnText: {
    color: COLORS.yellow,
    fontWeight: "900",
  },

  helperText: {
    marginTop: 16,
    color: COLORS.muted,
    textAlign: "center",
    fontSize: 12,
  },

  flashOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 999,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
  },

  flashSuccess: { backgroundColor: "rgba(34,197,94,0.92)" },
  flashError: { backgroundColor: "rgba(239,68,68,0.92)" },

  flashText: {
    color: "#fff",
    fontWeight: "900",
  },
});