import React, { useState } from "react";
import { TextInput, TouchableOpacity, View, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import COLORS from "../theme/colors";

export default function PasswordField({ style, inputStyle, ...props }) {
  const [visible, setVisible] = useState(false);

  return (
    <View style={[styles.wrapper, style]}>
      <TextInput
        {...props}
        autoCapitalize="none"
        autoCorrect={false}
        secureTextEntry={!visible}
        selectionColor={COLORS.primary}
        style={[styles.input, inputStyle]}
      />

      <TouchableOpacity
        accessibilityRole="button"
        activeOpacity={0.75}
        hitSlop={{ top: 10, right: 10, bottom: 10, left: 10 }}
        onPress={() => setVisible((current) => !current)}
        style={styles.toggleButton}
      >
        <Ionicons
          name={visible ? "eye-off-outline" : "eye-outline"}
          size={20}
          color={COLORS.muted}
        />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flexDirection: "row",
    alignItems: "center",
  },
  input: {
    flex: 1,
    color: COLORS.white,
    fontSize: 14,
    paddingVertical: 0,
    paddingRight: 12,
  },
  toggleButton: {
    alignItems: "center",
    justifyContent: "center",
  },
});
