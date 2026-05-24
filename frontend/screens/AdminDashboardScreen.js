import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";

import {
  APP_MODE_MEMBER,
  adminApiFetch,
  clearAdminSession,
  getSessionSnapshot,
  setActiveAppMode,
} from "../api";
import COLORS from "../theme/colors";
import { useI18n } from "../i18n";

function formatDateTime(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  return date.toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function hasPermission(admin, permission) {
  if (!admin) return false;
  if (admin.is_super_admin) return true;
  return Array.isArray(admin.permissions) && admin.permissions.includes(permission);
}

function StatCard({ icon, label, value }) {
  return (
    <View style={styles.statCard}>
      <MaterialCommunityIcons name={icon} size={18} color={COLORS.primarySoft} />
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function ActionCard({ icon, title, subtitle, cta, onPress, disabled = false }) {
  return (
    <View style={[styles.actionCard, disabled && styles.actionCardDisabled]}>
      <View style={styles.actionIconWrap}>
        <MaterialCommunityIcons name={icon} size={22} color={COLORS.primarySoft} />
      </View>
      <Text style={styles.actionTitle}>{title}</Text>
      <Text style={styles.actionSubtitle}>{subtitle}</Text>
      {cta ? (
        <TouchableOpacity
          style={[styles.actionButton, disabled && styles.actionButtonDisabled]}
          onPress={disabled ? undefined : onPress}
          disabled={disabled}
          activeOpacity={0.9}
        >
          <Text style={styles.actionButtonText}>{cta}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

function ClubChip({ label, selected, onPress }) {
  return (
    <TouchableOpacity
      style={[styles.clubChip, selected && styles.clubChipActive]}
      onPress={onPress}
      activeOpacity={0.88}
    >
      <Text style={[styles.clubChipText, selected && styles.clubChipTextActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

export default function AdminDashboardScreen({ navigation }) {
  const { t } = useI18n();
  const [searchText, setSearchText] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selectedClubId, setSelectedClubId] = useState(null);
  const [hasMemberSession, setHasMemberSession] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchText.trim()), 250);
    return () => clearTimeout(timer);
  }, [searchText]);

  useEffect(() => {
    let mounted = true;

    const loadSession = async () => {
      const session = await getSessionSnapshot();
      if (mounted) {
        setHasMemberSession(!!session.memberToken);
      }
    };

    loadSession();

    return () => {
      mounted = false;
    };
  }, []);

  const adminMeQuery = useQuery({
    queryKey: ["admin-me"],
    queryFn: () => adminApiFetch("/api/admin-auth/me"),
  });

  const admin = adminMeQuery.data?.admin || null;
  const clubs = admin?.clubs || [];

  useEffect(() => {
    if (!selectedClubId && clubs.length > 0) {
      setSelectedClubId(clubs[0].club_id);
    }
  }, [clubs, selectedClubId]);

  const selectedClub = useMemo(
    () => clubs.find((club) => Number(club.club_id) === Number(selectedClubId)) || null,
    [clubs, selectedClubId]
  );

  const summaryQuery = useQuery({
    queryKey: ["admin-club-summary", selectedClubId],
    queryFn: () => adminApiFetch(`/api/admin-platform/clubs/${selectedClubId}/summary`),
    enabled: !!selectedClubId,
  });

  const membersQuery = useQuery({
    queryKey: ["admin-club-members", selectedClubId, debouncedSearch],
    queryFn: () =>
      adminApiFetch(
        `/api/admin-platform/clubs/${selectedClubId}/members?q=${encodeURIComponent(
          debouncedSearch
        )}`
      ),
    enabled: !!selectedClubId && hasPermission(admin, "member.read"),
  });

  const checkinsQuery = useQuery({
    queryKey: ["admin-club-checkins", selectedClubId],
    queryFn: () => adminApiFetch(`/api/admin-platform/clubs/${selectedClubId}/checkins`),
    enabled: !!selectedClubId && hasPermission(admin, "report.view"),
  });

  const summary = summaryQuery.data?.summary || {};
  const members = membersQuery.data?.members || [];
  const recentCheckins = checkinsQuery.data?.checkins || [];

  const handleOpenScanner = () => {
    if (!selectedClubId) return;

    navigation.navigate("StaffScanner", {
      clubId: selectedClubId,
      clubName: selectedClub?.club_name || selectedClub?.name || "",
    });
  };

  const handleSwitchToMember = async () => {
    await setActiveAppMode(APP_MODE_MEMBER);
  };

  const handleStaffLogout = () => {
    Alert.alert(t("admin_sign_out_title"), t("admin_sign_out_subtitle"), [
      { text: t("common_cancel"), style: "cancel" },
      {
        text: t("admin_sign_out_button"),
        style: "destructive",
        onPress: async () => {
          await clearAdminSession();
        },
      },
    ]);
  };

  if (adminMeQuery.isLoading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>{t("admin_loading_dashboard")}</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (adminMeQuery.isError) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.errorWrap}>
          <Text style={styles.screenTitle}>{t("admin_center_title")}</Text>
          <Text style={styles.errorTitle}>{t("admin_access_error_title")}</Text>
          <Text style={styles.errorSubtitle}>
            {adminMeQuery.error?.message || t("admin_access_error_subtitle")}
          </Text>
          <TouchableOpacity style={styles.primaryInlineButton} onPress={handleStaffLogout}>
            <Text style={styles.primaryInlineButtonText}>{t("admin_sign_out_button")}</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (!clubs.length) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.errorWrap}>
          <Text style={styles.screenTitle}>{t("admin_center_title")}</Text>
          <Text style={styles.errorTitle}>{t("admin_no_clubs_title")}</Text>
          <Text style={styles.errorSubtitle}>{t("admin_no_clubs_subtitle")}</Text>
          <TouchableOpacity style={styles.primaryInlineButton} onPress={handleStaffLogout}>
            <Text style={styles.primaryInlineButtonText}>{t("admin_sign_out_button")}</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <View style={styles.headerTextWrap}>
          <Text style={styles.screenEyebrow}>{t("admin_center_badge")}</Text>
          <Text style={styles.screenTitle}>{t("admin_center_heading")}</Text>
          <Text style={styles.screenSubtitle}>{t("admin_workspace_subtitle")}</Text>
        </View>

        <View style={styles.headerActions}>
          {hasMemberSession ? (
            <TouchableOpacity
              style={styles.secondaryHeaderButton}
              onPress={handleSwitchToMember}
              activeOpacity={0.88}
            >
              <Ionicons name="swap-horizontal-outline" size={16} color={COLORS.softWhite} />
              <Text style={styles.secondaryHeaderText}>{t("admin_switch_member_app")}</Text>
            </TouchableOpacity>
          ) : null}

          <TouchableOpacity
            style={styles.primaryHeaderButton}
            onPress={handleStaffLogout}
            activeOpacity={0.88}
          >
            <Ionicons name="log-out-outline" size={16} color={COLORS.white} />
            <Text style={styles.primaryHeaderText}>{t("admin_sign_out_button")}</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.card}>
          <View style={styles.scopeTopRow}>
            <View style={styles.scopeBadge}>
              <Text style={styles.scopeBadgeText}>
                {admin?.is_super_admin
                  ? t("admin_role_super_admin")
                  : selectedClub?.role_name || t("admin_session_active")}
              </Text>
            </View>

            {selectedClub?.club_name ? (
              <View style={styles.scopeBadgeMuted}>
                <Text style={styles.scopeBadgeMutedText}>{selectedClub.club_name}</Text>
              </View>
            ) : null}
          </View>

          <Text style={styles.scopeTitle}>{t("admin_workspace_title")}</Text>
          <Text style={styles.scopeText}>
            {selectedClub?.club_name
              ? t("admin_scope_single_club", { club: selectedClub.club_name })
              : t("admin_scope_all_clubs")}
          </Text>

          <View style={styles.metaGrid}>
            <View style={styles.metaCard}>
              <Text style={styles.metaLabel}>{t("admin_current_role_label")}</Text>
              <Text style={styles.metaValue}>
                {admin?.is_super_admin
                  ? t("admin_role_super_admin")
                  : selectedClub?.role_name || t("admin_not_available")}
              </Text>
            </View>

            <View style={styles.metaCard}>
              <Text style={styles.metaLabel}>{t("admin_current_club_label")}</Text>
              <Text style={styles.metaValue}>
                {selectedClub?.club_name || t("admin_not_available")}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>{t("admin_club_selector_title")}</Text>
          <Text style={styles.sectionSubtitle}>{t("admin_club_selector_subtitle")}</Text>
          <View style={styles.clubWrap}>
            {clubs.map((club) => (
              <ClubChip
                key={club.club_id}
                label={club.club_name}
                selected={Number(selectedClubId) === Number(club.club_id)}
                onPress={() => setSelectedClubId(club.club_id)}
              />
            ))}
          </View>
        </View>

        <View style={styles.actionsGrid}>
          <ActionCard
            icon="qrcode-scan"
            title={t("admin_tool_front_desk")}
            subtitle={t("admin_tool_front_desk_sub")}
            cta={t("admin_open_scanner")}
            onPress={handleOpenScanner}
          />
          <ActionCard
            icon="account-search-outline"
            title={t("admin_tool_members")}
            subtitle={t("admin_tool_members_sub")}
            disabled={!hasPermission(admin, "member.read")}
          />
          <ActionCard
            icon="chart-box-outline"
            title={t("admin_tool_reports")}
            subtitle={t("admin_tool_reports_sub")}
            disabled={!hasPermission(admin, "report.view")}
          />
        </View>

        {summaryQuery.isLoading ? (
          <View style={styles.card}>
            <ActivityIndicator color={COLORS.primary} />
          </View>
        ) : summaryQuery.isError ? (
          <View style={styles.card}>
            <Text style={styles.helper}>
              {summaryQuery.error?.message || t("admin_summary_unavailable")}
            </Text>
          </View>
        ) : (
          <View style={styles.statsGrid}>
            <StatCard
              icon="account-group-outline"
              label={t("admin_total_members")}
              value={summary.total_members || 0}
            />
            <StatCard
              icon="card-account-details-outline"
              label={t("admin_active_memberships")}
              value={summary.active_members || 0}
            />
            <StatCard
              icon="calendar-check-outline"
              label={t("admin_today_checkins")}
              value={summary.today_checkins || 0}
            />
            <StatCard
              icon="dumbbell"
              label={t("admin_classes_scheduled")}
              value={summary.scheduled_classes || 0}
            />
          </View>
        )}

        {hasPermission(admin, "member.read") ? (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>{t("admin_member_lookup")}</Text>
            <Text style={styles.sectionSubtitle}>{t("admin_member_lookup_sub")}</Text>

            <TextInput
              value={searchText}
              onChangeText={setSearchText}
              placeholder={t("admin_member_lookup_placeholder")}
              placeholderTextColor={COLORS.muted}
              style={styles.input}
            />

            {membersQuery.isLoading ? (
              <ActivityIndicator color={COLORS.primary} />
            ) : membersQuery.isError ? (
              <Text style={styles.helper}>
                {membersQuery.error?.message || t("admin_member_lookup_failed")}
              </Text>
            ) : members.length === 0 ? (
              <Text style={styles.helper}>
                {debouncedSearch ? t("admin_no_members") : t("admin_search_prompt")}
              </Text>
            ) : (
              members.map((member) => (
                <View key={member.id} style={styles.rowCard}>
                  <Text style={styles.rowTitle}>{member.name || t("admin_unknown_member")}</Text>
                  <Text style={styles.rowMeta}>
                    {member.membership_code || t("admin_no_membership_code")}
                  </Text>
                  <Text style={styles.rowMeta}>
                    {member.membership_plan_name || t("admin_no_plan")}
                  </Text>
                  <Text style={styles.rowMeta}>
                    {member.membership_status || t("admin_not_available")}
                  </Text>
                </View>
              ))
            )}
          </View>
        ) : null}

        {hasPermission(admin, "report.view") ? (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>{t("admin_recent_checkins_title")}</Text>
            <Text style={styles.sectionSubtitle}>{t("admin_reporting_subtitle")}</Text>

            {checkinsQuery.isLoading ? (
              <ActivityIndicator color={COLORS.primary} />
            ) : checkinsQuery.isError ? (
              <Text style={styles.helper}>
                {checkinsQuery.error?.message || t("admin_reporting_failed")}
              </Text>
            ) : recentCheckins.length === 0 ? (
              <Text style={styles.helper}>{t("admin_no_checkins")}</Text>
            ) : (
              recentCheckins.map((entry) => (
                <View key={entry.id} style={styles.rowCard}>
                  <Text style={styles.rowTitle}>
                    {entry.member_name || t("admin_unknown_member")}
                  </Text>
                  <Text style={styles.rowMeta}>
                    {entry.membership_code || t("admin_no_membership_code")}
                  </Text>
                  <Text style={styles.rowMeta}>{formatDateTime(entry.checkin_time)}</Text>
                </View>
              ))
            )}
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  errorWrap: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: "center",
  },
  loadingText: {
    color: COLORS.muted,
    fontSize: 14,
    fontWeight: "600",
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 8,
  },
  headerTextWrap: {
    marginBottom: 14,
  },
  screenEyebrow: {
    color: COLORS.primarySoft,
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 1,
    marginBottom: 8,
  },
  screenTitle: {
    color: COLORS.white,
    fontSize: 30,
    fontWeight: "900",
    marginBottom: 6,
  },
  screenSubtitle: {
    color: COLORS.muted,
    fontSize: 14,
    lineHeight: 20,
  },
  headerActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  secondaryHeaderButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    minHeight: 44,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.card,
  },
  secondaryHeaderText: {
    color: COLORS.softWhite,
    fontSize: 13,
    fontWeight: "700",
  },
  primaryHeaderButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    minHeight: 44,
    paddingHorizontal: 14,
    borderRadius: 14,
    backgroundColor: COLORS.primary,
  },
  primaryHeaderText: {
    color: COLORS.white,
    fontSize: 13,
    fontWeight: "800",
  },
  content: {
    paddingHorizontal: 20,
    paddingBottom: 36,
  },
  card: {
    backgroundColor: COLORS.card,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 18,
    marginBottom: 18,
  },
  scopeTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: 12,
  },
  scopeBadge: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "rgba(59,130,246,0.16)",
    borderWidth: 1,
    borderColor: "rgba(59,130,246,0.30)",
  },
  scopeBadgeText: {
    color: COLORS.primarySoft,
    fontSize: 12,
    fontWeight: "800",
  },
  scopeBadgeMuted: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: COLORS.bgDeep,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  scopeBadgeMutedText: {
    color: COLORS.softWhite,
    fontSize: 12,
    fontWeight: "700",
  },
  scopeTitle: {
    color: COLORS.white,
    fontSize: 24,
    fontWeight: "900",
    marginBottom: 8,
  },
  scopeText: {
    color: COLORS.muted,
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 14,
  },
  metaGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },
  metaCard: {
    width: "48%",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.bgDeep,
    padding: 14,
    marginBottom: 10,
  },
  metaLabel: {
    color: COLORS.muted,
    fontSize: 12,
    fontWeight: "700",
    marginBottom: 6,
  },
  metaValue: {
    color: COLORS.white,
    fontSize: 15,
    fontWeight: "800",
  },
  sectionTitle: {
    color: COLORS.white,
    fontSize: 19,
    fontWeight: "800",
    marginBottom: 6,
  },
  sectionSubtitle: {
    color: COLORS.muted,
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 14,
  },
  clubWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  clubChip: {
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 999,
    backgroundColor: COLORS.bgDeep,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  clubChipActive: {
    borderColor: COLORS.primary,
    backgroundColor: "rgba(59,130,246,0.16)",
  },
  clubChipText: {
    color: COLORS.softWhite,
    fontSize: 12,
    fontWeight: "700",
  },
  clubChipTextActive: {
    color: COLORS.primarySoft,
  },
  actionsGrid: {
    marginBottom: 18,
  },
  actionCard: {
    backgroundColor: COLORS.card,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 18,
    marginBottom: 12,
  },
  actionCardDisabled: {
    opacity: 0.58,
  },
  actionIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: "rgba(59,130,246,0.14)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  actionTitle: {
    color: COLORS.white,
    fontSize: 18,
    fontWeight: "800",
    marginBottom: 6,
  },
  actionSubtitle: {
    color: COLORS.muted,
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 14,
  },
  actionButton: {
    minHeight: 46,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.bgDeep,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  actionButtonDisabled: {
    backgroundColor: COLORS.cardSoft,
  },
  actionButtonText: {
    color: COLORS.white,
    fontSize: 13,
    fontWeight: "800",
  },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    marginBottom: 18,
  },
  statCard: {
    width: "48%",
    backgroundColor: COLORS.card,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 16,
    marginBottom: 12,
  },
  statValue: {
    color: COLORS.white,
    fontSize: 24,
    fontWeight: "900",
    marginVertical: 6,
  },
  statLabel: {
    color: COLORS.muted,
    fontSize: 12,
    lineHeight: 17,
  },
  input: {
    backgroundColor: COLORS.inputBg,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: COLORS.white,
    marginBottom: 10,
  },
  helper: {
    color: COLORS.muted,
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 10,
  },
  rowCard: {
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.bgDeep,
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
  },
  rowTitle: {
    color: COLORS.white,
    fontSize: 15,
    fontWeight: "700",
    marginBottom: 4,
  },
  rowMeta: {
    color: COLORS.muted,
    fontSize: 12,
    lineHeight: 17,
  },
  errorTitle: {
    color: COLORS.white,
    fontSize: 22,
    fontWeight: "800",
    marginBottom: 8,
  },
  errorSubtitle: {
    color: COLORS.muted,
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 18,
  },
  primaryInlineButton: {
    minHeight: 48,
    borderRadius: 16,
    backgroundColor: COLORS.primary,
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "flex-start",
    paddingHorizontal: 16,
  },
  primaryInlineButtonText: {
    color: COLORS.white,
    fontSize: 14,
    fontWeight: "800",
  },
});
