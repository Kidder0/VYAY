import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import COLORS from "../theme/colors";
import { useI18n } from "../i18n";
import { apiFetch } from "../api";

export default function MawabScreen({ navigation }) {
  const { t, language } = useI18n();
  const scrollRef = useRef(null);
  const [input, setInput] = useState("");
  const [isThinking, setIsThinking] = useState(false);
  const [messages, setMessages] = useState([
    {
      id: "welcome",
      role: "assistant",
      text: t("mawab_welcome_subtitle"),
    },
  ]);

  const suggestions = useMemo(
    () => [
      t("mawab_suggestion_membership"),
      t("mawab_suggestion_checkin"),
      t("mawab_suggestion_workout"),
    ],
    [t]
  );

  useEffect(() => {
    setMessages((prev) => {
      if (!prev.length || prev[0]?.id !== "welcome") return prev;
      return [
        {
          ...prev[0],
          text: t("mawab_welcome_subtitle"),
        },
        ...prev.slice(1),
      ];
    });
  }, [t]);

  const goHome = () => {
    navigation.navigate("Home");
  };

  const scrollToBottom = () => {
    requestAnimationFrame(() => {
      scrollRef.current?.scrollToEnd({ animated: true });
    });
  };

  const submitMessage = async (preset) => {
    const nextText = String(preset ?? input).trim();
    if (!nextText || isThinking) {
      if (!nextText) {
        Alert.alert(t("common_error"), t("mawab_error_empty"));
      }
      return;
    }

    const userMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      text: nextText,
    };

    const nextMessages = [...messages, userMessage];
    setMessages(nextMessages);
    setInput("");
    setIsThinking(true);
    scrollToBottom();

    try {
      const data = await apiFetch("/api/mawab/chat", {
        method: "POST",
        body: JSON.stringify({
          language,
          messages: nextMessages.map((message) => ({
            role: message.role,
            text: message.text,
          })),
        }),
      });

      const reply = {
        id: `assistant-${Date.now()}`,
        role: "assistant",
        text: data?.reply || t("mawab_error_unavailable"),
      };

      setMessages((prev) => [...prev, reply]);
      scrollToBottom();
    } catch (error) {
      const reply = {
        id: `assistant-error-${Date.now()}`,
        role: "assistant",
        text: error?.message || t("mawab_error_unavailable"),
      };

      setMessages((prev) => [...prev, reply]);
      scrollToBottom();
    } finally {
      setIsThinking(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "left", "right"]}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={styles.header}>
          <View style={styles.headerBadge}>
            <MaterialCommunityIcons
              name="robot-excited-outline"
              size={18}
              color={COLORS.primarySoft}
            />
          </View>

          <View style={styles.headerTextWrap}>
            <Text style={styles.title}>{t("mawab_title")}</Text>
            <Text style={styles.subtitle}>{t("mawab_subtitle")}</Text>
          </View>
        </View>

        <ScrollView
          ref={scrollRef}
          style={styles.messages}
          contentContainerStyle={styles.messagesContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.heroCard}>
            <Text style={styles.heroTitle}>{t("mawab_welcome_title")}</Text>
            <Text style={styles.heroSubtitle}>{t("mawab_welcome_subtitle")}</Text>
          </View>

          <View style={styles.suggestionsWrap}>
            <Text style={styles.suggestionsTitle}>{t("mawab_suggestions_title")}</Text>
            <View style={styles.suggestionRow}>
              {suggestions.map((suggestion) => (
                <TouchableOpacity
                  key={suggestion}
                  style={styles.suggestionChip}
                  activeOpacity={0.9}
                  onPress={() => submitMessage(suggestion)}
                >
                  <Text style={styles.suggestionText}>{suggestion}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {messages.map((message) => (
            <View
              key={message.id}
              style={[
                styles.bubbleRow,
                message.role === "user" ? styles.bubbleRowUser : styles.bubbleRowAssistant,
              ]}
            >
              <View
                style={[
                  styles.bubble,
                  message.role === "user" ? styles.userBubble : styles.assistantBubble,
                ]}
              >
                <Text
                  style={[
                    styles.bubbleText,
                    message.role === "user" ? styles.userBubbleText : styles.assistantBubbleText,
                  ]}
                >
                  {message.text}
                </Text>
              </View>
            </View>
          ))}

          {isThinking ? (
            <View style={styles.bubbleRow}>
              <View style={[styles.bubble, styles.assistantBubble]}>
                <Text style={[styles.bubbleText, styles.assistantBubbleText]}>
                  {t("mawab_typing")}
                </Text>
              </View>
            </View>
          ) : null}
        </ScrollView>

        <View style={styles.inputBar}>
          <TextInput
            style={styles.input}
            value={input}
            onChangeText={setInput}
            placeholder={t("mawab_placeholder")}
            placeholderTextColor={COLORS.muted}
            returnKeyType="send"
            onSubmitEditing={() => submitMessage()}
          />

          <TouchableOpacity
            style={[styles.sendButton, (!input.trim() || isThinking) && styles.sendButtonDisabled]}
            activeOpacity={0.9}
            disabled={!input.trim() || isThinking}
            onPress={() => submitMessage()}
          >
            <Ionicons name="send" size={18} color={COLORS.white} />
          </TouchableOpacity>
        </View>

        <View style={styles.bottomBar}>
          <TouchableOpacity style={styles.navButton} activeOpacity={0.95} onPress={goHome}>
            <View style={[styles.navIconWrap, styles.navIconInactive]}>
              <Ionicons name="home-outline" size={22} color={COLORS.softWhite} />
            </View>
            <Text style={styles.navText}>{t("home_bottom_home")}</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.navButton} activeOpacity={0.95}>
            <View style={styles.navIconWrap}>
              <MaterialCommunityIcons name="robot-outline" size={22} color={COLORS.white} />
            </View>
            <Text style={styles.navText}>{t("home_bottom_mawab")}</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
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
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 16,
  },
  headerBadge: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: "rgba(59,130,246,0.14)",
    borderWidth: 1,
    borderColor: "rgba(59,130,246,0.35)",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 14,
  },
  headerTextWrap: {
    flex: 1,
  },
  title: {
    color: COLORS.white,
    fontSize: 24,
    fontWeight: "900",
  },
  subtitle: {
    color: COLORS.muted,
    fontSize: 13,
    marginTop: 4,
    lineHeight: 18,
  },
  messages: {
    flex: 1,
  },
  messagesContent: {
    paddingHorizontal: 20,
    paddingBottom: 18,
  },
  heroCard: {
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 24,
    padding: 20,
    marginBottom: 16,
  },
  heroTitle: {
    color: COLORS.white,
    fontSize: 21,
    fontWeight: "900",
    marginBottom: 8,
  },
  heroSubtitle: {
    color: COLORS.muted,
    fontSize: 14,
    lineHeight: 21,
  },
  suggestionsWrap: {
    marginBottom: 18,
  },
  suggestionsTitle: {
    color: COLORS.softWhite,
    fontSize: 14,
    fontWeight: "700",
    marginBottom: 10,
  },
  suggestionRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  suggestionChip: {
    backgroundColor: COLORS.cardSoft,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  suggestionText: {
    color: COLORS.primarySoft,
    fontSize: 13,
    fontWeight: "700",
  },
  bubbleRow: {
    marginBottom: 12,
    flexDirection: "row",
  },
  bubbleRowAssistant: {
    justifyContent: "flex-start",
  },
  bubbleRowUser: {
    justifyContent: "flex-end",
  },
  bubble: {
    maxWidth: "86%",
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  assistantBubble: {
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  userBubble: {
    backgroundColor: COLORS.primary,
  },
  bubbleText: {
    fontSize: 14,
    lineHeight: 21,
  },
  assistantBubbleText: {
    color: COLORS.softWhite,
  },
  userBubbleText: {
    color: COLORS.white,
    fontWeight: "600",
  },
  inputBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 10,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    backgroundColor: COLORS.bgDeep,
  },
  input: {
    flex: 1,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 18,
    minHeight: 52,
    color: COLORS.white,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginRight: 10,
  },
  sendButton: {
    width: 52,
    height: 52,
    borderRadius: 18,
    backgroundColor: COLORS.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  sendButtonDisabled: {
    opacity: 0.55,
  },
  bottomBar: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: COLORS.bgDeep,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingTop: 10,
    paddingBottom: 18,
    gap: 28,
  },
  navButton: {
    alignItems: "center",
    justifyContent: "center",
    minWidth: 100,
  },
  navIconWrap: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: COLORS.primary,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 6,
  },
  navIconInactive: {
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  navText: {
    color: COLORS.white,
    fontSize: 14,
    fontWeight: "700",
  },
});
