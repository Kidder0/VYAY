import React, { useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { CameraView, useCameraPermissions } from "expo-camera";
import { apiFetch } from "../api";
import COLORS from "../theme/colors";
import { useI18n } from "../i18n";

export default function StaffScannerScreen({ navigation, route }) {
  const { t } = useI18n();
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [status, setStatus] = useState({ type: "idle", msg: "" });
  const [branchId] = useState(route?.params?.branchId || 1);

  const cooldownRef = useRef(false);

  const resetScan = () => {
    setScanned(false);
    setStatus({ type: "idle", msg: "" });
    cooldownRef.current = false;
  };

  const verifyMembershipCode = async (membershipCode) => {
    if (!membershipCode) return;
    if (cooldownRef.current) return;

    cooldownRef.current = true;
    setStatus({ type: "loading", msg: t("staff_scanner_verifying") });

    try {
      const res = await apiFetch("/api/checkin/verify", {
        method: "POST",
        skipAuth: true,
        body: JSON.stringify({
          membership_code: membershipCode,
          branch_id: branchId,
        }),
      });

      const message = String(res?.message || "");

      if (message.toLowerCase().includes("successful")) {
        setStatus({
          type: "ok",
          msg: `✅ ${message}\n${res.user?.name || ""}${res.branch?.name ? ` • ${res.branch.name}` : ""}`,
        });
      } else if (message.toLowerCase().includes("already checked")) {
        setStatus({
          type: "warn",
          msg: `ℹ️ ${message}\n${res.user?.name || ""}${res.branch?.name ? ` • ${res.branch.name}` : ""}`,
        });
      } else {
        setStatus({
          type: "err",
          msg: message || t("staff_scanner_verification_failed"),
        });
      }
    } catch (e) {
      setStatus({
        type: "err",
        msg: e?.message || t("staff_scanner_verification_failed"),
      });
    } finally {
      setScanned(true);
      setTimeout(() => {
        cooldownRef.current = false;
      }, 2000);
    }
  };

  const handleBarcodeScanned = ({ data }) => {
    if (!data || scanned) return;
    setScanned(true);
    verifyMembershipCode(String(data).trim());
  };

  if (!permission) {
    return (
      <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
        <ActivityIndicator
          style={{ marginTop: 100 }}
          color={COLORS.primary}
          size="large"
        />
      </SafeAreaView>
    );
  }

  if (!permission.granted) {
    return (
      <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
        <View style={styles.container}>
          <Text style={styles.title}>{t("staff_scanner_title")}</Text>
          <Text style={styles.subTitle}>{t("staff_scanner_camera_required")}</Text>

          <TouchableOpacity
            style={styles.primaryBtn}
            onPress={requestPermission}
            activeOpacity={0.9}
          >
            <Text style={styles.primaryBtnText}>{t("staff_scanner_allow_camera")}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.outlineBtn}
            onPress={() => navigation.goBack()}
            activeOpacity={0.9}
          >
            <Text style={styles.outlineBtnText}>{t("common_back")}</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const statusColor =
    status.type === "ok"
      ? COLORS.success
      : status.type === "err"
      ? COLORS.danger
      : COLORS.primary;

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      <View style={styles.container}>
        <Text style={styles.title}>{t("staff_scanner_title")}</Text>
        <Text style={styles.subTitle}>{t("staff_scanner_scan_member")}</Text>

        <View style={styles.card}>
          <View style={styles.cameraFrame}>
            <CameraView
              style={StyleSheet.absoluteFillObject}
              facing="back"
              barcodeScannerSettings={{
                barcodeTypes: [
                  "code128",
                  "qr",
                  "ean13",
                  "ean8",
                  "code39",
                  "code93",
                  "upc_a",
                  "upc_e",
                ],
              }}
              onBarcodeScanned={scanned ? undefined : handleBarcodeScanned}
            />

            <View style={styles.overlay}>
              <View style={styles.scanBox} />
              <Text style={styles.overlayText}>
                {scanned ? t("staff_scanner_tap_again") : t("staff_scanner_align")}
              </Text>
            </View>
          </View>

          <View style={styles.statusBox}>
            {status.type === "loading" ? (
              <ActivityIndicator color={COLORS.primary} />
            ) : (
              <Text style={[styles.statusText, { color: statusColor }]}>
                {status.msg || t("staff_scanner_ready")}
              </Text>
            )}
          </View>

          <TouchableOpacity
            style={styles.outlineBtn}
            onPress={resetScan}
            activeOpacity={0.9}
          >
            <Text style={styles.outlineBtnText}>{t("staff_scanner_scan_again")}</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={[styles.outlineBtn, { marginTop: 12 }]}
          onPress={() => navigation.goBack()}
          activeOpacity={0.9}
        >
          <Text style={styles.outlineBtnText}>{t("common_back")}</Text>
        </TouchableOpacity>

        <Text style={styles.helper}>{t("staff_scanner_branch_id", { branchId })}</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: COLORS.bgDeep,
  },

  container: {
    flex: 1,
    padding: 16,
    alignItems: "center",
  },

  title: {
    fontSize: 24,
    fontWeight: "900",
    color: COLORS.primary,
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
    padding: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: "center",
  },

  cameraFrame: {
    width: "100%",
    height: 360,
    borderRadius: 16,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    backgroundColor: COLORS.bg,
  },

  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
  },

  scanBox: {
    width: "80%",
    height: 140,
    borderWidth: 2,
    borderColor: COLORS.primary,
    borderRadius: 12,
    backgroundColor: "rgba(0,0,0,0.15)",
  },

  overlayText: {
    marginTop: 14,
    color: COLORS.white,
    fontWeight: "800",
  },

  statusBox: {
    width: "100%",
    marginTop: 12,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    backgroundColor: "rgba(255,255,255,0.04)",
    alignItems: "center",
    minHeight: 52,
    justifyContent: "center",
  },

  statusText: {
    fontSize: 13,
    fontWeight: "900",
    textAlign: "center",
    lineHeight: 20,
  },

  primaryBtn: {
    width: "100%",
    backgroundColor: COLORS.primary,
    paddingVertical: 14,
    borderRadius: 30,
    alignItems: "center",
    marginTop: 14,
  },

  primaryBtnText: {
    color: COLORS.darkText,
    fontWeight: "900",
  },

  outlineBtn: {
    width: "100%",
    borderWidth: 1.5,
    borderColor: COLORS.primary,
    paddingVertical: 14,
    borderRadius: 30,
    alignItems: "center",
    marginTop: 12,
    backgroundColor: "#161616",
  },

  outlineBtnText: {
    color: COLORS.primary,
    fontWeight: "900",
  },

  helper: {
    marginTop: 12,
    color: COLORS.muted,
    fontSize: 12,
    textAlign: "center",
  },
});
