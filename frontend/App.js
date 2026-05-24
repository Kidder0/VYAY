import React, { useEffect, useState } from "react";
import { AppState } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { QueryClient, QueryClientProvider, focusManager } from "@tanstack/react-query";

import OnboardingScreen from "./screens/OnboardingScreen";
import LoginScreen from "./screens/LoginScreen";
import AdminLoginScreen from "./screens/AdminLoginScreen";
import RegisterScreen from "./screens/RegisterScreen";
import VerifyEmailScreen from "./screens/VerifyEmailScreen";
import ResetPasswordScreen from "./screens/ResetPasswordScreen";
import VerifyResetOtpScreen from "./screens/VerifyResetOtpScreen";
import SetNewPasswordScreen from "./screens/SetNewPasswordScreen";
import ResetSuccessScreen from "./screens/ResetSuccessScreen";
import SettingsScreen from "./screens/SettingsScreen";
import HomeScreen from "./screens/HomeScreen";
import CheckinScreen from "./screens/CheckinScreen";
import CheckinHistoryScreen from "./screens/CheckinHistoryScreen";
import BranchesScreen from "./screens/BranchesScreen";
import AccountScreen from "./screens/AccountScreen";
import EditProfileScreen from "./screens/EditProfileScreen";
import ChangeEmailScreen from "./screens/ChangeEmailScreen";
import ChangePasswordScreen from "./screens/ChangePasswordScreen";
import StaffScannerScreen from "./screens/StaffScannerScreen";
import MawabScreen from "./screens/MawabScreen";
import AdminDashboardScreen from "./screens/AdminDashboardScreen";
import {
  APP_MODE_ADMIN,
  APP_MODE_MEMBER,
  getSessionSnapshot,
  subscribeToSessionChanges,
} from "./api";
import { I18nProvider } from "./i18n";

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
      AdminLogin: "admin-login",
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
      Mawab: "mawab",
      AdminDashboard: "admin-dashboard",
    },
  },
};

function resolveAppShell({ memberToken, adminToken, appMode, hasSeenOnboarding }) {
  if (appMode === APP_MODE_ADMIN) {
    return {
      shell: "admin",
      initialRoute: adminToken ? "AdminDashboard" : "AdminLogin",
    };
  }

  if (appMode === APP_MODE_MEMBER && memberToken) {
    return {
      shell: "main",
      initialRoute: "Home",
    };
  }

  if (!appMode && adminToken && !memberToken) {
    return {
      shell: "admin",
      initialRoute: "AdminDashboard",
    };
  }

  if (memberToken) {
    return {
      shell: "main",
      initialRoute: "Home",
    };
  }

  return {
    shell: "main",
    initialRoute: hasSeenOnboarding ? "Login" : "Onboarding",
  };
}

function MainNavigator({ initialRoute }) {
  return (
    <Stack.Navigator
      key={`main:${initialRoute}`}
      initialRouteName={initialRoute}
      screenOptions={{ headerShown: false }}
    >
      <Stack.Screen name="Onboarding" component={OnboardingScreen} />
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="AdminLogin" component={AdminLoginScreen} />
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
      <Stack.Screen name="Mawab" component={MawabScreen} />
    </Stack.Navigator>
  );
}

function AdminNavigator({ initialRoute }) {
  return (
    <Stack.Navigator
      key={`admin:${initialRoute}`}
      initialRouteName={initialRoute}
      screenOptions={{ headerShown: false }}
    >
      <Stack.Screen name="AdminLogin" component={AdminLoginScreen} />
      <Stack.Screen name="AdminDashboard" component={AdminDashboardScreen} />
      <Stack.Screen name="StaffScanner" component={StaffScannerScreen} />
    </Stack.Navigator>
  );
}

export default function App() {
  const [appShell, setAppShell] = useState(null);

  useEffect(() => {
    const sub = AppState.addEventListener("change", (status) => {
      focusManager.setFocused(status === "active");
    });

    return () => sub.remove();
  }, []);

  useEffect(() => {
    let mounted = true;

    const syncShell = async () => {
      try {
        const [session, hasSeenOnboarding] = await Promise.all([
          getSessionSnapshot(),
          AsyncStorage.getItem(ONBOARDING_KEY),
        ]);

        if (!mounted) return;

        setAppShell(
          resolveAppShell({
            ...session,
            hasSeenOnboarding: !!hasSeenOnboarding,
          })
        );
      } catch {
        if (mounted) {
          setAppShell({
            shell: "main",
            initialRoute: "Onboarding",
          });
        }
      }
    };

    syncShell();
    const unsubscribe = subscribeToSessionChanges(syncShell);

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, []);

  if (!appShell) return null;

  return (
    <I18nProvider>
      <QueryClientProvider client={queryClient}>
        <NavigationContainer linking={linking} key={`${appShell.shell}:${appShell.initialRoute}`}>
          {appShell.shell === "admin" ? (
            <AdminNavigator initialRoute={appShell.initialRoute} />
          ) : (
            <MainNavigator initialRoute={appShell.initialRoute} />
          )}
        </NavigationContainer>
      </QueryClientProvider>
    </I18nProvider>
  );
}
