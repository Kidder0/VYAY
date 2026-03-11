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

const COLORS = {
  yellow: "#FFD700",
  black: "#0B0B0B",
  card: "#121212",
  border: "rgba(255,255,255,0.10)",
  muted: "rgba(255,255,255,0.65)",
  white: "#FFFFFF",
  danger: "#EF4444",
  ok: "#22C55E",
};

export default function StaffScannerScreen({ navigation, route }) {
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
    setStatus({ type: "loading", msg: "Verifying..." });

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
          msg: message || "Verification failed",
        });
      }
    } catch (e) {
      setStatus({
        type: "err",
        msg: e?.message || "Verification failed",
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
          color={COLORS.yellow}
          size="large"
        />
      </SafeAreaView>
    );
  }

  if (!permission.granted) {
    return (
      <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
        <View style={styles.container}>
          <Text style={styles.title}>Staff Scanner</Text>
          <Text style={styles.subTitle}>Camera permission is required.</Text>

          <TouchableOpacity
            style={styles.primaryBtn}
            onPress={requestPermission}
            activeOpacity={0.9}
          >
            <Text style={styles.primaryBtnText}>Allow Camera</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.outlineBtn}
            onPress={() => navigation.goBack()}
            activeOpacity={0.9}
          >
            <Text style={styles.outlineBtnText}>Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const statusColor =
    status.type === "ok"
      ? COLORS.ok
      : status.type === "err"
      ? COLORS.danger
      : COLORS.yellow;

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      <View style={styles.container}>
        <Text style={styles.title}>Staff Scanner</Text>
        <Text style={styles.subTitle}>Scan member barcode</Text>

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
                {scanned ? "Tap Scan Again" : "Align barcode in the box"}
              </Text>
            </View>
          </View>

          <View style={styles.statusBox}>
            {status.type === "loading" ? (
              <ActivityIndicator color={COLORS.yellow} />
            ) : (
              <Text style={[styles.statusText, { color: statusColor }]}>
                {status.msg || "Ready"}
              </Text>
            )}
          </View>

          <TouchableOpacity
            style={styles.outlineBtn}
            onPress={resetScan}
            activeOpacity={0.9}
          >
            <Text style={styles.outlineBtnText}>Scan Again</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={[styles.outlineBtn, { marginTop: 12 }]}
          onPress={() => navigation.goBack()}
          activeOpacity={0.9}
        >
          <Text style={styles.outlineBtnText}>Back</Text>
        </TouchableOpacity>

        <Text style={styles.helper}>Branch ID in request: {branchId}</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: COLORS.black,
  },

  container: {
    flex: 1,
    padding: 16,
    alignItems: "center",
  },

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
    backgroundColor: "#000",
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
    borderColor: COLORS.yellow,
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
    backgroundColor: "#161616",
  },

  outlineBtnText: {
    color: COLORS.yellow,
    fontWeight: "900",
  },

  helper: {
    marginTop: 12,
    color: COLORS.muted,
    fontSize: 12,
    textAlign: "center",
  },
});