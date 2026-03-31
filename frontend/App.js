import React, { useEffect, useState } from "react";
import { AppState } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { QueryClient, QueryClientProvider, focusManager } from "@tanstack/react-query";

// Auth / onboarding
import OnboardingScreen from "./screens/OnboardingScreen";
import LoginScreen from "./screens/LoginScreen";
import RegisterScreen from "./screens/RegisterScreen";
import VerifyEmailScreen from "./screens/VerifyEmailScreen";
import ResetPasswordScreen from "./screens/ResetPasswordScreen";
import VerifyResetOtpScreen from "./screens/VerifyResetOtpScreen";
import SetNewPasswordScreen from "./screens/SetNewPasswordScreen";
import ResetSuccessScreen from "./screens/ResetSuccessScreen";
import SettingsScreen from "./screens/SettingsScreen";
// Main app
import HomeScreen from "./screens/HomeScreen";
import CheckinScreen from "./screens/CheckinScreen";
import CheckinHistoryScreen from "./screens/CheckinHistoryScreen";
import BranchesScreen from "./screens/BranchesScreen";
import AccountScreen from "./screens/AccountScreen";
import EditProfileScreen from "./screens/EditProfileScreen";
import ChangeEmailScreen from "./screens/ChangeEmailScreen";
import ChangePasswordScreen from "./screens/ChangePasswordScreen";
import StaffScannerScreen from "./screens/StaffScannerScreen";

const Stack = createNativeStackNavigator();

const ONBOARDING_VERSION = "v2";
const ONBOARDING_KEY = `hasSeenOnboarding_${ONBOARDING_VERSION}`;

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 0,
      refetchOnMount: true,
      refetchOnReconnect: true,
      refetchOnWindowFocus: true,
      retry: 1,
    },
  },
});

const linking = {
  prefixes: ["gympro://"],
  config: {
    screens: {
      Onboarding: "onboarding",
      Login: "login",
      Register: "register",
      VerifyEmail: "verify-email",
      ResetPassword: "reset-password",
      VerifyResetOtp: "verify-reset-otp",
      SetNewPassword: "set-new-password",
      ResetSuccess: "reset-success",
      Home: "home",
      Checkin: "checkin",
      CheckinHistory: "checkin-history",
      Branches: "branches",
      Account: "account",
      EditProfile: "edit-profile",
      ChangeEmail: "change-email",
      ChangePassword: "change-password",
      StaffScanner: "staff-scanner",
    },
  },
};

export default function App() {
  const [initialRoute, setInitialRoute] = useState(null);

  useEffect(() => {
    const sub = AppState.addEventListener("change", (status) => {
      focusManager.setFocused(status === "active");
    });

    return () => sub.remove();
  }, []);

  useEffect(() => {
    const initializeApp = async () => {
      try {
        const token = await AsyncStorage.getItem("token");
        const hasSeenOnboarding = await AsyncStorage.getItem(ONBOARDING_KEY);

        if (token) {
          setInitialRoute("Home");
        } else if (hasSeenOnboarding) {
          setInitialRoute("Login");
        } else {
          setInitialRoute("Onboarding");
        }
      } catch {
        setInitialRoute("Onboarding");
      }
    };

    initializeApp();
  }, []);

  if (!initialRoute) return null;

  return (
    <QueryClientProvider client={queryClient}>
      <NavigationContainer linking={linking}>
        <Stack.Navigator
          initialRouteName={initialRoute}
          screenOptions={{ headerShown: false }}
        >
          <Stack.Screen name="Onboarding" component={OnboardingScreen} />
          <Stack.Screen name="Login" component={LoginScreen} />
          <Stack.Screen name="Register" component={RegisterScreen} />
          <Stack.Screen name="VerifyEmail" component={VerifyEmailScreen} />

          <Stack.Screen name="ResetPassword" component={ResetPasswordScreen} />
          <Stack.Screen name="VerifyResetOtp" component={VerifyResetOtpScreen} />
          <Stack.Screen name="SetNewPassword" component={SetNewPasswordScreen} />
          <Stack.Screen name="ResetSuccess" component={ResetSuccessScreen} />

          <Stack.Screen name="Home" component={HomeScreen} />
          <Stack.Screen name="Checkin" component={CheckinScreen} />
          <Stack.Screen name="CheckinHistory" component={CheckinHistoryScreen} />
          <Stack.Screen name="Branches" component={BranchesScreen} />
          <Stack.Screen name="Account" component={AccountScreen} />
          <Stack.Screen name="Settings" component={SettingsScreen} />
          <Stack.Screen name="EditProfile" component={EditProfileScreen} />
          <Stack.Screen name="ChangeEmail" component={ChangeEmailScreen} />
          <Stack.Screen name="ChangePassword" component={ChangePasswordScreen} />
          <Stack.Screen name="StaffScanner" component={StaffScannerScreen} />
        </Stack.Navigator>
      </NavigationContainer>
    </QueryClientProvider>
  );
}