import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as Haptics from "expo-haptics";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Dimensions,
  FlatList,
  ActivityIndicator,
  StatusBar,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "../api";

const { width } = Dimensions.get("window");
const SLIDE_WIDTH = width - 40;
const AUTO_SLIDE_MS = 3500;

const COLORS = {
  bg: "#000000",
  bgDeep: "#050505",
  card: "#121212",
  cardSoft: "#171717",
  border: "#232323",
  borderSoft: "#2E2E2E",
  primary: "#3B82F6",
  primarySoft: "#93C5FD",
  white: "#FFFFFF",
  softWhite: "#E5E7EB",
  muted: "#A1A1AA",
  muted2: "#71717A",
  darkText: "#111111",
  success: "#34D399",
};

function normalizeMembershipName(value) {
  const raw = String(value || "").trim().toLowerCase();

  if (!raw) return null;
  if (raw === "basic") return "Build";
  if (raw === "pro") return "Dominate";
  if (raw.includes("build")) return "Build";
  if (raw.includes("dominate")) return "Dominate";

  return value;
}

function buildSlides(hasMembership, membershipPlan) {
  if (!hasMembership) {
    return [
      {
        id: "no-plan-build",
        eyebrow: "START HERE",
        title: "Build",
        text: "Essential access and a strong starting point for your training journey.",
        cta: "Explore Build",
        icon: "barbell-outline",
      },
      {
        id: "no-plan-dominate",
        eyebrow: "LEVEL UP",
        title: "Dominate",
        text: "More flexibility, better access, and a stronger premium member experience.",
        cta: "Explore Dominate",
        icon: "flash-outline",
      },
    ];
  }

  if (membershipPlan === "Build") {
    return [
      {
        id: "build-upgrade-1",
        eyebrow: "UPGRADE",
        title: "Dominate",
        text: "Unlock stronger access, premium flexibility, and more member benefits.",
        cta: "Upgrade Now",
        icon: "arrow-up-outline",
      },
      {
        id: "build-upgrade-2",
        eyebrow: "NEXT LEVEL",
        title: "Train Bigger",
        text: "Move beyond the basics with a more premium and flexible gym experience.",
        cta: "See Benefits",
        icon: "trending-up-outline",
      },
    ];
  }

  return [
    {
      id: "dominate-product-1",
      eyebrow: "RECOVERY",
      title: "Protein",
      text: "Support recovery, muscle growth, and consistency with smart nutrition choices.",
      cta: "View Products",
      icon: "nutrition-outline",
    },
    {
      id: "dominate-product-2",
      eyebrow: "ON THE GO",
      title: "Bars & Snacks",
      text: "Quick fuel for busy days when you still want to stay on track.",
      cta: "Shop Now",
      icon: "cafe-outline",
    },
    {
      id: "dominate-product-3",
      eyebrow: "ESSENTIALS",
      title: "Gym Gear",
      text: "Accessories that make your daily training cleaner, easier, and more complete.",
      cta: "Browse Gear",
      icon: "shirt-outline",
    },
  ];
}

function getHeroContent(hasMembership, membershipPlan) {
  if (!hasMembership) {
    return {
      badge: "GET STARTED",
      titleTop: "WELCOME TO",
      titleMain: "VYAY",
      subtitle1: "Train smarter. Stay consistent.",
      subtitle2: "Join today and start building momentum.",
      button: "Join Now",
    };
  }

  if (membershipPlan === "Build") {
    return {
      badge: "UPGRADE AVAILABLE",
      titleTop: "MOVE UP TO",
      titleMain: "DOMINATE",
      subtitle1: "More access. More flexibility.",
      subtitle2: "Upgrade for a stronger gym experience.",
      button: "Explore Dominate",
    };
  }

  return {
    badge: "PREMIUM MEMBER",
    titleTop: "READY FOR",
    titleMain: "MORE",
    subtitle1: "Keep your momentum strong.",
    subtitle2: "Explore premium products and member benefits.",
    button: "View Products",
  };
}

export default function HomeScreen({ navigation }) {
  const flatListRef = useRef(null);
  const autoSlideRef = useRef(null);
  const [activeSlide, setActiveSlide] = useState(0);

  const goAccount = useCallback(() => {
    navigation.navigate("Account");
  }, [navigation]);

  const goCheckin = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    navigation.navigate("Checkin");
  }, [navigation]);

  const membershipQuery = useQuery({
    queryKey: ["home-membership"],
    queryFn: () => apiFetch("/api/checkin/code"),
    refetchOnMount: true,
    staleTime: 15000,
  });

  const membershipData = membershipQuery.data || {};
  const hasMembership =
    !membershipData?.show_plans && !!membershipData?.membership_code;

  const membershipPlan = normalizeMembershipName(
    membershipData?.membership_plan_name ||
      membershipData?.membership_type ||
      ""
  );

  const heroContent = useMemo(
    () => getHeroContent(hasMembership, membershipPlan),
    [hasMembership, membershipPlan]
  );

  const slides = useMemo(
    () => buildSlides(hasMembership, membershipPlan),
    [hasMembership, membershipPlan]
  );

  useEffect(() => {
    setActiveSlide(0);

    const timer = setTimeout(() => {
      flatListRef.current?.scrollToOffset({ offset: 0, animated: false });
    }, 50);

    return () => clearTimeout(timer);
  }, [slides.length]);

  useEffect(() => {
    if (!slides.length) return;

    if (autoSlideRef.current) clearInterval(autoSlideRef.current);

    autoSlideRef.current = setInterval(() => {
      setActiveSlide((prev) => {
        const next = (prev + 1) % slides.length;
        flatListRef.current?.scrollToOffset({
          offset: next * SLIDE_WIDTH,
          animated: true,
        });
        return next;
      });
    }, AUTO_SLIDE_MS);

    return () => {
      if (autoSlideRef.current) clearInterval(autoSlideRef.current);
    };
  }, [slides]);

  const onMomentumScrollEnd = useCallback((event) => {
    const offsetX = event.nativeEvent.contentOffset.x;
    const index = Math.round(offsetX / SLIDE_WIDTH);
    setActiveSlide(index);
  }, []);

  const handleHeroPress = useCallback(() => {
    if (!hasMembership) {
      goCheckin();
      return;
    }

    if (membershipPlan === "Build") {
      goCheckin();
      return;
    }

    goAccount();
  }, [hasMembership, membershipPlan, goCheckin, goAccount]);

  const handleSlidePress = useCallback(() => {
    if (!hasMembership) {
      goCheckin();
      return;
    }

    if (membershipPlan === "Build") {
      goCheckin();
      return;
    }

    goAccount();
  }, [hasMembership, membershipPlan, goCheckin, goAccount]);

  const sectionTitle = !hasMembership
    ? "Membership Plans"
    : membershipPlan === "Build"
    ? "Upgrade Recommendations"
    : "Recommended For You";

  const renderHero = () => {
    return (
      <View style={styles.heroCard}>
        <View style={styles.heroTopRow}>
          <View style={styles.heroBadge}>
            <Text style={styles.heroBadgeText}>{heroContent.badge}</Text>
          </View>

          {hasMembership && membershipPlan ? (
            <View style={styles.heroMemberChip}>
              <Text style={styles.heroMemberChipText}>{membershipPlan}</Text>
            </View>
          ) : null}
        </View>

        <Text style={styles.heroTitleTop}>{heroContent.titleTop}</Text>
        <Text style={styles.heroTitleMain}>{heroContent.titleMain}</Text>

        <Text style={styles.heroSubtitleMain}>{heroContent.subtitle1}</Text>
        <Text style={styles.heroSubtitleAccent}>{heroContent.subtitle2}</Text>

        <TouchableOpacity
          style={styles.heroButton}
          onPress={handleHeroPress}
          activeOpacity={0.9}
        >
          <Text style={styles.heroButtonText}>{heroContent.button}</Text>
          <Ionicons name="arrow-forward" size={18} color={COLORS.white} />
        </TouchableOpacity>
      </View>
    );
  };

  const renderQuickActions = () => {
    if (!hasMembership) return null;

    return (
      <View style={styles.panelCard}>
        <Text style={styles.sectionTitle}>Quick Actions</Text>
        <Text style={styles.sectionSubtitle}>
          Open your membership access instantly.
        </Text>

        <TouchableOpacity
          style={styles.primaryAction}
          onPress={goCheckin}
          activeOpacity={0.92}
        >
          <View style={styles.primaryActionLeft}>
            <View style={styles.primaryActionIconWrap}>
              <MaterialCommunityIcons
                name="qrcode-scan"
                size={24}
                color={COLORS.primary}
              />
            </View>

            <View style={styles.primaryActionTextWrap}>
              <Text style={styles.primaryActionTitle}>Check-in</Text>
              <Text style={styles.primaryActionSubtitle}>
                Open your membership barcode
              </Text>
            </View>
          </View>

          <Ionicons name="chevron-forward" size={22} color={COLORS.white} />
        </TouchableOpacity>
      </View>
    );
  };

  const renderSlide = ({ item }) => {
    return (
      <TouchableOpacity
        activeOpacity={0.94}
        onPress={handleSlidePress}
        style={styles.slideCard}
      >
        <View style={styles.slideTopRow}>
          <Text style={styles.slideEyebrow}>{item.eyebrow}</Text>

          <View style={styles.slideIconWrap}>
            <Ionicons name={item.icon} size={18} color={COLORS.primary} />
          </View>
        </View>

        <View>
          <Text style={styles.slideTitle}>{item.title}</Text>
          <Text style={styles.slideText}>{item.text}</Text>
        </View>

        <View style={styles.slideFooter}>
          <Text style={styles.slideCtaText}>{item.cta}</Text>

          <View style={styles.arrowCircle}>
            <Ionicons name="arrow-forward" size={18} color={COLORS.white} />
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "left", "right"]}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.bg} />
      <View style={styles.container}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.topRow}>
            <View style={styles.topTextWrap}>
              <Text style={styles.welcomeText}>Welcome back</Text>
              <Text style={styles.pageTitle}>VYAY</Text>
              <Text style={styles.pageSubtitle}>
                Train stronger. Stay consistent.
              </Text>

              {hasMembership && membershipPlan ? (
                <View style={styles.planPill}>
                  <View style={styles.planDot} />
                  <Text style={styles.planPillText}>{membershipPlan} Member</Text>
                </View>
              ) : null}
            </View>

            <TouchableOpacity
              style={styles.profileBtn}
              onPress={goAccount}
              activeOpacity={0.88}
            >
              <Ionicons name="person-outline" size={22} color={COLORS.white} />
            </TouchableOpacity>
          </View>

          {renderHero()}

          {membershipQuery.isLoading ? (
            <View style={styles.loadingCard}>
              <ActivityIndicator size="small" color={COLORS.primary} />
              <Text style={styles.loadingText}>Loading membership details...</Text>
            </View>
          ) : null}

          {renderQuickActions()}

          <View style={styles.sectionWrap}>
            <Text style={styles.sectionTitle}>{sectionTitle}</Text>
            <Text style={styles.sectionSubtitle}>
              Curated for your membership experience.
            </Text>

            <FlatList
              ref={flatListRef}
              data={slides}
              keyExtractor={(item) => item.id}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              onMomentumScrollEnd={onMomentumScrollEnd}
              renderItem={renderSlide}
              snapToInterval={SLIDE_WIDTH}
              decelerationRate="fast"
              bounces={false}
              getItemLayout={(_, index) => ({
                length: SLIDE_WIDTH,
                offset: SLIDE_WIDTH * index,
                index,
              })}
            />

            <View style={styles.dotsRow}>
              {slides.map((slide, index) => (
                <View
                  key={slide.id}
                  style={[
                    styles.dot,
                    index === activeSlide ? styles.dotActive : styles.dotInactive,
                  ]}
                />
              ))}
            </View>
          </View>
        </ScrollView>

        <View style={styles.bottomBar}>
          <TouchableOpacity style={styles.homeNavButton} activeOpacity={0.95}>
            <View style={styles.homeNavIconWrap}>
              <Ionicons name="home" size={22} color={COLORS.white} />
            </View>
            <Text style={styles.homeNavText}>Home</Text>
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
    paddingTop: 12,
    paddingBottom: 128,
  },

  topRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 20,
  },
  topTextWrap: {
    flex: 1,
    paddingRight: 12,
  },
  welcomeText: {
    color: COLORS.muted,
    fontSize: 14,
    fontWeight: "700",
    marginBottom: 6,
  },
  pageTitle: {
    color: COLORS.white,
    fontSize: 34,
    fontWeight: "900",
    lineHeight: 38,
    letterSpacing: 0.4,
  },
  pageSubtitle: {
    color: COLORS.softWhite,
    fontSize: 15,
    fontWeight: "500",
    marginTop: 8,
  },
  planPill: {
    alignSelf: "flex-start",
    marginTop: 14,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.borderSoft,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    flexDirection: "row",
    alignItems: "center",
  },
  planDot: {
    width: 8,
    height: 8,
    borderRadius: 999,
    backgroundColor: COLORS.success,
    marginRight: 8,
  },
  planPillText: {
    color: COLORS.white,
    fontSize: 13,
    fontWeight: "700",
  },
  profileBtn: {
    width: 54,
    height: 54,
    borderRadius: 27,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
  },

  heroCard: {
    backgroundColor: COLORS.card,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 22,
    paddingVertical: 24,
    marginBottom: 22,
  },
  heroTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 18,
  },
  heroBadge: {
    backgroundColor: "rgba(59,130,246,0.14)",
    borderWidth: 1,
    borderColor: "rgba(59,130,246,0.35)",
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
  },
  heroBadgeText: {
    color: COLORS.primarySoft,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.9,
  },
  heroMemberChip: {
    backgroundColor: COLORS.bgDeep,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
  },
  heroMemberChipText: {
    color: COLORS.white,
    fontSize: 12,
    fontWeight: "700",
  },
  heroTitleTop: {
    color: COLORS.muted,
    fontSize: 14,
    fontWeight: "800",
    letterSpacing: 1,
    marginBottom: 8,
  },
  heroTitleMain: {
    color: COLORS.white,
    fontSize: 40,
    fontWeight: "900",
    lineHeight: 44,
    marginBottom: 12,
  },
  heroSubtitleMain: {
    color: COLORS.white,
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 6,
  },
  heroSubtitleAccent: {
    color: COLORS.muted,
    fontSize: 15,
    fontWeight: "500",
    marginBottom: 20,
    lineHeight: 22,
  },
  heroButton: {
    minHeight: 56,
    borderRadius: 18,
    backgroundColor: COLORS.primary,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingHorizontal: 20,
  },
  heroButtonText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: "800",
  },

  loadingCard: {
    marginBottom: 22,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 20,
    paddingVertical: 16,
    paddingHorizontal: 18,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  loadingText: {
    color: COLORS.softWhite,
    fontSize: 14,
    fontWeight: "600",
  },

  panelCard: {
    backgroundColor: COLORS.card,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 20,
    marginBottom: 22,
  },

  sectionWrap: {
    marginBottom: 24,
  },
  sectionTitle: {
    color: COLORS.white,
    fontSize: 22,
    fontWeight: "900",
    marginBottom: 6,
  },
  sectionSubtitle: {
    color: COLORS.muted,
    fontSize: 14,
    lineHeight: 21,
    marginBottom: 14,
  },

  primaryAction: {
    minHeight: 82,
    borderRadius: 22,
    backgroundColor: COLORS.bgDeep,
    borderWidth: 1,
    borderColor: COLORS.border,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
  },
  primaryActionLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  primaryActionIconWrap: {
    width: 50,
    height: 50,
    borderRadius: 16,
    backgroundColor: "rgba(59,130,246,0.14)",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 14,
  },
  primaryActionTextWrap: {
    flex: 1,
  },
  primaryActionTitle: {
    color: COLORS.white,
    fontSize: 17,
    fontWeight: "800",
    marginBottom: 3,
  },
  primaryActionSubtitle: {
    color: COLORS.muted,
    fontSize: 13,
    fontWeight: "500",
  },

  slideCard: {
    width: SLIDE_WIDTH,
    minHeight: 210,
    borderRadius: 24,
    padding: 22,
    justifyContent: "space-between",
    backgroundColor: COLORS.cardSoft,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  slideTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  slideEyebrow: {
    color: COLORS.primarySoft,
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 1,
  },
  slideIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.bgDeep,
    borderWidth: 1,
    borderColor: COLORS.border,
    justifyContent: "center",
    alignItems: "center",
  },
  slideTitle: {
    color: COLORS.white,
    fontSize: 26,
    fontWeight: "900",
    marginTop: 16,
    marginBottom: 10,
  },
  slideText: {
    color: COLORS.muted,
    fontSize: 15,
    lineHeight: 22,
    maxWidth: "95%",
  },
  slideFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 18,
  },
  slideCtaText: {
    color: COLORS.white,
    fontSize: 14,
    fontWeight: "700",
  },
  arrowCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: COLORS.primary,
    justifyContent: "center",
    alignItems: "center",
  },

  dotsRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 16,
  },
  dot: {
    height: 8,
    borderRadius: 999,
    marginHorizontal: 4,
  },
  dotActive: {
    width: 24,
    backgroundColor: COLORS.primary,
  },
  dotInactive: {
    width: 8,
    backgroundColor: "#3A3A3A",
  },

  bottomBar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.bgDeep,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingTop: 10,
    paddingBottom: 18,
  },
  homeNavButton: {
    alignItems: "center",
    justifyContent: "center",
    minWidth: 100,
  },
  homeNavIconWrap: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: COLORS.primary,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 6,
  },
  homeNavText: {
    color: COLORS.white,
    fontSize: 14,
    fontWeight: "700",
  },
});