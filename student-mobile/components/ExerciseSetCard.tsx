import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Clock } from "lucide-react-native";

export type ExerciseSetCardVariant = "horizontal" | "stacked";

type Props = {
  variant: ExerciseSetCardVariant;
  label: string;
  accentColor: string;
  backgroundColor: string;
  borderColor: string;
  series: string;
  reps: string;
  load?: string;
  rest?: string;
  testIDPrefix?: string;
};

export default function ExerciseSetCard({
  variant,
  label,
  accentColor,
  backgroundColor,
  borderColor,
  series,
  reps,
  load,
  rest,
  testIDPrefix,
}: Props) {
  const prefix = testIDPrefix || "exercise-set-card";

  return (
    <View
      style={[styles.card, { backgroundColor, borderColor }]}
      testID={`${prefix}-root`}
    >
      {variant === "stacked" ? (
        <View style={styles.stackedLayout} testID={`${prefix}-layout`}>
          <View style={styles.badge} testID={`${prefix}-line-label`}>
            <Text style={[styles.badgeText, { color: accentColor }]}>
              {label}
            </Text>
          </View>
          <Text
            style={styles.setsText}
            numberOfLines={1}
            testID={`${prefix}-line-sets`}
          >
            {series} x {reps}
          </Text>
          {!!load && (
            <Text
              style={styles.loadTextStacked}
              numberOfLines={1}
              testID={`${prefix}-line-load`}
            >
              {load}
            </Text>
          )}
          {!!rest && (
            <View style={styles.restRow} testID={`${prefix}-line-rest`}>
              <Clock size={14} color="#94a3b8" />
              <Text style={styles.restText} numberOfLines={1}>
                {rest}
              </Text>
            </View>
          )}
        </View>
      ) : (
        <>
          <View style={styles.headerRow} testID={`${prefix}-layout`}>
            <View style={styles.headerLeft}>
              <View style={styles.badge} testID={`${prefix}-line-label`}>
                <Text style={[styles.badgeText, { color: accentColor }]}>
                  {label}
                </Text>
              </View>
              <Text
                style={styles.setsText}
                numberOfLines={1}
                testID={`${prefix}-line-sets`}
              >
                {series} x {reps}
              </Text>
            </View>

            {!!load && (
              <Text
                style={styles.loadTextHorizontal}
                numberOfLines={1}
                testID={`${prefix}-line-load`}
              >
                {load}
              </Text>
            )}
          </View>

          {!!rest && (
            <View style={styles.restRow} testID={`${prefix}-line-rest`}>
              <Clock size={14} color="#94a3b8" />
              <Text style={styles.restText} numberOfLines={1}>
                {rest}
              </Text>
            </View>
          )}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 8,
    padding: 8,
    borderWidth: 1,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 6,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    minWidth: 0,
    flex: 1,
  },
  stackedLayout: {
    gap: 4,
    minWidth: 0,
  },
  badge: {
    backgroundColor: "#fff",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    alignSelf: "flex-start",
  },
  badgeText: {
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 0.5,
  },
  setsText: {
    fontWeight: "800",
    color: "#1e293b",
    fontSize: 13,
    flexShrink: 1,
  },
  loadTextHorizontal: {
    fontSize: 11,
    color: "#475569",
    fontWeight: "800",
    textTransform: "uppercase",
    maxWidth: 90,
    textAlign: "right",
    flexShrink: 1,
  },
  loadTextStacked: {
    fontSize: 11,
    color: "#475569",
    fontWeight: "800",
    textTransform: "uppercase",
    flexShrink: 1,
  },
  restRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 4,
    minWidth: 0,
  },
  restText: {
    fontSize: 11,
    color: "#64748b",
    fontWeight: "700",
    flexShrink: 1,
  },
});
