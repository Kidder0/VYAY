import React from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { apiFetch } from "../api";

const YELLOW = "#FFD700";
const BLACK = "#0B0B0B";
const BLACK_CARD = "#121212";
const BORDER = "rgba(255,255,255,0.08)";
const TEXT_MUTED = "rgba(255,255,255,0.65)";

export default function HomeScreen({ navigation }) {
  const testProtectedRoute = async () => {
    try {
      await apiFetch("/api/classes/my-bookings");
      Alert.alert("Success", "Protected API working!");
    } catch (err) {
      Alert.alert("Error", err.message || "Request failed");
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>Welcome Back 💪</Text>
            <Text style={styles.title}>GymPro Dashboard</Text>
          </View>

          <TouchableOpacity
            style={styles.profileBtn}
            onPress={() => navigation.navigate("Account")}
            activeOpacity={0.9}
          >
            <Ionicons name="person-outline" size={22} color={YELLOW} />
          </TouchableOpacity>
        </View>

        <View style={styles.heroCard}>
          <Text style={styles.heroTitle}>Train Better. Check In Faster.</Text>
          <Text style={styles.heroSub}>
            Manage your membership, barcode check-in, classes, and account from one place.
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Quick Actions</Text>
          <Text style={styles.cardSub}>
            Access your membership and features instantly.
          </Text>

          <TouchableOpacity
            style={styles.primaryBtn}
            onPress={() => navigation.navigate("Checkin")}
            activeOpacity={0.9}
          >
            <Ionicons name="qr-code-outline" size={22} color="#000" />
            <Text style={styles.primaryText}>Check-in</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.secondaryBtn}
            onPress={() => navigation.navigate("Branches")}
            activeOpacity={0.9}
          >
            <Ionicons name="location-outline" size={20} color={YELLOW} />
            <Text style={styles.secondaryText}>Find Clubs</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.secondaryBtn}
            onPress={() => navigation.navigate("CheckinHistory")}
            activeOpacity={0.9}
          >
            <Ionicons name="time-outline" size={20} color={YELLOW} />
            <Text style={styles.secondaryText}>Check-in History</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.secondaryBtn}
            onPress={testProtectedRoute}
            activeOpacity={0.9}
          >
            <Ionicons name="shield-checkmark-outline" size={20} color={YELLOW} />
            <Text style={styles.secondaryText}>Test Protected API</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Account</Text>
          <Text style={styles.cardSub}>
            Update your profile, email, password, and membership details.
          </Text>

          <TouchableOpacity
            style={styles.secondaryBtn}
            onPress={() => navigation.navigate("Account")}
            activeOpacity={0.9}
          >
            <Ionicons name="settings-outline" size={20} color={YELLOW} />
            <Text style={styles.secondaryText}>Go to Account</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: BLACK,
  },

  container: {
    padding: 20,
    paddingBottom: 40,
  },

  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 6,
    marginBottom: 20,
  },

  greeting: {
    color: TEXT_MUTED,
    fontSize: 13,
    fontWeight: "700",
  },

  title: {
    color: YELLOW,
    fontSize: 24,
    fontWeight: "900",
    marginTop: 4,
  },

  profileBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: BORDER,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: BLACK_CARD,
  },

  heroCard: {
    backgroundColor: BLACK_CARD,
    borderRadius: 22,
    padding: 20,
    borderWidth: 1,
    borderColor: BORDER,
    marginBottom: 16,
  },

  heroTitle: {
    color: "#fff",
    fontSize: 20,
    fontWeight: "900",
  },

  heroSub: {
    color: TEXT_MUTED,
    marginTop: 8,
    fontSize: 13,
    lineHeight: 20,
  },

  card: {
    backgroundColor: BLACK_CARD,
    borderRadius: 22,
    padding: 20,
    borderWidth: 1,
    borderColor: BORDER,
    marginBottom: 16,
  },

  cardTitle: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "900",
  },

  cardSub: {
    color: TEXT_MUTED,
    marginTop: 6,
    marginBottom: 18,
    fontSize: 13,
    lineHeight: 20,
  },

  primaryBtn: {
    backgroundColor: YELLOW,
    paddingVertical: 16,
    borderRadius: 30,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },

  primaryText: {
    color: "#000",
    fontWeight: "900",
    fontSize: 16,
  },

  secondaryBtn: {
    marginTop: 12,
    borderWidth: 1,
    borderColor: YELLOW,
    paddingVertical: 14,
    borderRadius: 30,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: BLACK_CARD,
  },

  secondaryText: {
    color: YELLOW,
    fontWeight: "900",
    fontSize: 14,
  },
});