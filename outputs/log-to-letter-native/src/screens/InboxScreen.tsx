import { useRef, useState } from "react";
import { Image, NativeScrollEvent, NativeSyntheticEvent, Pressable, ScrollView, StyleSheet, Text, TextInput, useWindowDimensions, View } from "react-native";
import { Screen } from "../components/Screen";
import { useAppTheme } from "../lib/theme";
import { Letter, LetterPaperStyle } from "../types/domain";

declare const require: <T = unknown>(moduleName: string) => T;

type Props = {
  letters: Letter[];
  letterPaperStyle: LetterPaperStyle;
  onSavePostscript: (letterId: string, postscript: string) => void;
};

function monthLabel(value: string) {
  const date = new Date(value);
  return `${date.getFullYear()}년 ${date.getMonth() + 1}월`;
}

function dateKey(value: string) {
  return value.slice(0, 10);
}

function truncateArchiveTitle(value: string) {
  return value.length > 9 ? `${value.slice(0, 9)}...` : value;
}

function formatDateLabel(value: string) {
  const date = new Date(value);
  return `${date.getFullYear()}년 ${date.getMonth() + 1}월 ${date.getDate()}일`;
}

function formatPeriodLabel(value: string) {
  return value
    .split("~")
    .map((part) => part.trim())
    .filter(Boolean)
    .map(formatDateLabel)
    .join(" ~ ");
}

function splitLetterBody(body: string) {
  const maxLength = 360;
  const paragraphs = body.split(/\n+/).map((part) => part.trim()).filter(Boolean);
  const pages: string[] = [];
  let current = "";

  paragraphs.forEach((paragraph) => {
    if (!current) {
      current = paragraph;
      return;
    }
    if (`${current}\n\n${paragraph}`.length <= maxLength) {
      current = `${current}\n\n${paragraph}`;
      return;
    }
    pages.push(current);
    current = paragraph;
  });

  if (current) pages.push(current);
  if (!pages.length) return [body];

  return pages.flatMap((page) => {
    if (page.length <= maxLength) return [page];
    const chunks: string[] = [];
    for (let index = 0; index < page.length; index += maxLength) {
      chunks.push(page.slice(index, index + maxLength));
    }
    return chunks;
  });
}

function DecorClover({ color, style, opacity, fourLeaf }: { color: string; style?: object; opacity: number; fourLeaf?: boolean }) {
  return (
    <Image
      source={fourLeaf ? require("../../assets/four-leaf-clover-pattern-symbol.png") : require("../../assets/clover-pattern-symbol.png")}
      style={[styles.decorClover, style, { opacity, tintColor: color }]}
      resizeMode="contain"
    />
  );
}

export function InboxScreen({ letters, letterPaperStyle, onSavePostscript }: Props) {
  const theme = useAppTheme();
  const { width } = useWindowDimensions();
  const [selected, setSelected] = useState<Letter | null>(null);
  const [postscript, setPostscript] = useState("");
  const [pageIndex, setPageIndex] = useState(0);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [savingImage, setSavingImage] = useState(false);
  const pageRefs = useRef<Array<View | null>>([]);
  const sorted = [...letters].sort((a, b) => new Date(b.deliveredAt).getTime() - new Date(a.deliveredAt).getTime());
  const groups = sorted.reduce<Record<string, Letter[]>>((acc, letter) => {
    const key = monthLabel(letter.deliveredAt);
    acc[key] = [...(acc[key] || []), letter];
    return acc;
  }, {});

  if (selected) {
    const pages = splitLetterBody(selected.body);
    const savePage = async (index: number) => {
      const target = pageRefs.current[index];
      if (!target) return false;
      const { captureRef } = require<typeof import("react-native-view-shot")>("react-native-view-shot");
      const MediaLibrary = require<typeof import("expo-media-library")>("expo-media-library");
      const uri = await captureRef(target, {
        format: "png",
        quality: 1,
        result: "tmpfile"
      });
      await MediaLibrary.saveToLibraryAsync(uri);
      return true;
    };
    const saveLetterImages = async (mode: "current" | "all") => {
      setSavingImage(true);
      setSaveMessage(null);
      try {
        const MediaLibrary = require<typeof import("expo-media-library")>("expo-media-library");
        const permission = await MediaLibrary.requestPermissionsAsync();
        if (!permission.granted) {
          setSaveMessage("사진 저장 권한이 필요해.");
          return;
        }
        const indexes = mode === "current" ? [pageIndex] : pages.map((_, index) => index);
        let savedCount = 0;
        for (const index of indexes) {
          if (await savePage(index)) savedCount += 1;
        }
        setSaveMessage(`${savedCount}장의 편지 이미지를 저장했어.`);
      } catch (error) {
        console.warn("Letter image save failed", error);
        setSaveMessage("이미지 저장에 실패했어.");
      } finally {
        setSavingImage(false);
      }
    };

    return (
      <Screen eyebrow="LETTER" title="편지보관함">
        <Pressable style={styles.back} onPress={() => setSelected(null)}>
          <Text style={[styles.backText, { color: theme.tint }]}>← 목록으로</Text>
        </Pressable>
        <View style={styles.sliderWrap}>
          <ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={(event: NativeSyntheticEvent<NativeScrollEvent>) => {
              const width = event.nativeEvent.layoutMeasurement.width || 1;
              setPageIndex(Math.round(event.nativeEvent.contentOffset.x / width));
            }}
          >
            {pages.map((body, index) => (
              <View key={`${selected.id}-${index}`} style={[styles.slide, { width }]}>
                <View
                  ref={(node) => {
                    pageRefs.current[index] = node;
                  }}
                  collapsable={false}
                  style={[
                    styles.paper,
                    letterPaperStyle === "themeBorder" && { borderColor: theme.tint, borderWidth: 2 },
                    letterPaperStyle === "clover" && { borderColor: theme.border },
                    letterPaperStyle === "cloudTitle" && { borderColor: theme.border }
                  ]}
                >
                  {letterPaperStyle === "clover" ? (
                    <>
                      <DecorClover color={theme.tint} style={styles.decorCloverTop} opacity={0.5} />
                      <DecorClover color={theme.tint} style={styles.decorCloverBottom} opacity={0.46} />
                      <DecorClover color={theme.tint} style={styles.decorCloverLeftMid} opacity={0.34} />
                      <DecorClover color={theme.tint} style={styles.decorCloverRightMid} opacity={0.36} />
                      <DecorClover color={theme.tint} style={styles.decorCloverLowerRight} opacity={0.3} />
                      <DecorClover color={theme.tint} style={styles.decorFourLeafHidden} opacity={0.48} fourLeaf />
                    </>
                  ) : null}
                  <View style={styles.titleWrap}>
                    <View style={styles.titleWrap}>
                      <Text
                        style={[styles.letterTitle, { color: theme.tint }]}
                        textBreakStrategy="balanced"
                        lineBreakStrategyIOS="hangul-word"
                      >
                        {selected.title}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.letterMeta}>
                    <Text style={styles.letterMetaText}>받은 날짜 {formatDateLabel(selected.deliveredAt)}</Text>
                    <Text style={styles.letterMetaText}>기록 기간 {formatPeriodLabel(selected.periodLabel)}</Text>
                  </View>
                  <View style={[styles.letterContentArea, letterPaperStyle === "cloudTitle" && { backgroundColor: theme.soft, padding: 16, borderRadius: 8 }]}>
                    <Text style={styles.body}>{body}</Text>
                    {pages.length > 1 ? (
                      <Text style={[styles.pageCount, { color: theme.tint }]}>{index + 1} / {pages.length}</Text>
                    ) : null}
                    {letterPaperStyle !== "cloudTitle" ? (
                      <View style={styles.letterBrand}>
                        <Image source={require("../../assets/app-icon.png")} style={styles.letterBrandIcon} />
                        <Text style={styles.letterBrandText}>Log to Letter</Text>
                      </View>
                    ) : null}
                  </View>
                  {letterPaperStyle === "cloudTitle" ? (
                    <View style={styles.letterBrand}>
                      <Image source={require("../../assets/app-icon.png")} style={styles.letterBrandIcon} />
                      <Text style={styles.letterBrandText}>Log to Letter</Text>
                    </View>
                  ) : null}
                </View>
              </View>
            ))}
          </ScrollView>
          {pages.length > 1 ? (
            <View style={styles.dots}>
              {pages.map((_, index) => (
                <View key={index} style={[styles.dot, pageIndex === index && { backgroundColor: theme.tint }]} />
              ))}
            </View>
          ) : null}
        </View>
        <View style={styles.postscript}>
          <Text style={styles.sectionTitle}>추신</Text>
          <TextInput
            multiline
            value={postscript || selected.postscript || ""}
            onChangeText={setPostscript}
            placeholder="이 편지를 읽고 지금의 내가 남기고 싶은 말을 적어봐."
            style={styles.postscriptInput}
            textAlignVertical="top"
          />
          <Pressable
            style={[styles.save, { backgroundColor: theme.tint }]}
            onPress={() => {
              onSavePostscript(selected.id, postscript);
              setSelected({ ...selected, postscript });
            }}
          >
            <Text style={styles.saveText}>저장하기</Text>
          </Pressable>
        </View>
        <View style={styles.shareActions}>
          <Pressable
            disabled={savingImage}
            style={[styles.share, { borderColor: theme.border, backgroundColor: theme.soft }, savingImage && styles.disabledButton]}
            onPress={() => saveLetterImages("all")}
          >
            <Text style={[styles.shareText, { color: theme.tint }]}>{savingImage ? "저장 중" : "편지 내용 이미지로 저장"}</Text>
          </Pressable>
        </View>
        {saveMessage ? <Text style={[styles.saveMessage, { color: theme.tint }]}>{saveMessage}</Text> : null}
      </Screen>
    );
  }

  return (
    <Screen eyebrow="LETTER" title="편지보관함" lead="지난 날의 네가 보낸 편지를 확인해봐.">
      {sorted.length ? (
        Object.entries(groups).map(([label, items]) => (
          <View key={label} style={styles.group}>
            <Text style={styles.month}>{label}</Text>
            <View style={styles.grid}>
              {items.map((letter) => (
                <Pressable key={letter.id} style={styles.card} onPress={() => {
                  setPostscript(letter.postscript || "");
                  setSelected(letter);
                  setPageIndex(0);
                  setSaveMessage(null);
                }}>
                  <Image source={require("../../assets/letter-archive-icon.png")} style={styles.icon} resizeMode="contain" />
                  <Text style={styles.keyword}>{truncateArchiveTitle(letter.keyword)}</Text>
                  <Text style={[styles.date, { color: theme.tint }]}>{dateKey(letter.deliveredAt)}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        ))
      ) : (
        <Text style={styles.empty}>아직 도착한 편지가 없어.</Text>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  back: {
    alignSelf: "flex-start",
    paddingVertical: 8
  },
  backText: {
    color: "#2f8f54",
    fontWeight: "900"
  },
  group: {
    gap: 12
  },
  month: {
    color: "#18241b",
    fontSize: 18,
    fontWeight: "900"
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12
  },
  card: {
    width: "48%",
    alignItems: "center",
    gap: 8,
    padding: 14,
    borderWidth: 1,
    borderColor: "#dfe8da",
    borderRadius: 8,
    backgroundColor: "#fff"
  },
  icon: {
    width: 96,
    height: 96
  },
  keyword: {
    color: "#18241b",
    fontSize: 14,
    fontWeight: "900",
    lineHeight: 20,
    textAlign: "center"
  },
  date: {
    color: "#2f8f54",
    fontSize: 13,
    fontWeight: "900"
  },
  empty: {
    color: "#657064",
    fontSize: 15
  },
  sliderWrap: {
    gap: 10,
    marginHorizontal: -20
  },
  slide: {
    paddingHorizontal: 20
  },
  paper: {
    position: "relative",
    minHeight: 520,
    gap: 14,
    padding: 20,
    borderWidth: 1,
    borderColor: "#dfe8da",
    borderRadius: 8,
    backgroundColor: "#fff",
    overflow: "hidden"
  },
  titleWrap: {
    position: "relative",
    alignSelf: "flex-start",
    alignItems: "flex-start",
    maxWidth: "100%",
    paddingBottom: 3
  },
  splitTitleArea: {
    padding: 20,
    paddingBottom: 16,
    backgroundColor: "#fff"
  },
  letterContentArea: {
    flex: 1,
    gap: 14,
    padding: 0
  },
  letterTitle: {
    fontSize: 22,
    fontWeight: "900",
    lineHeight: 29,
    textAlign: "left",
    zIndex: 1
  },
  letterMeta: {
    alignItems: "flex-end",
    gap: 3
  },
  letterMetaText: {
    color: "#657064",
    fontSize: 12,
    fontWeight: "800",
    textAlign: "right"
  },
  body: {
    color: "#253027",
    fontSize: 15,
    lineHeight: 24
  },
  pageCount: {
    marginTop: "auto",
    alignSelf: "flex-end",
    fontSize: 12,
    fontWeight: "900"
  },
  letterBrand: {
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 8
  },
  letterBrandIcon: {
    width: 18,
    height: 18,
    borderRadius: 4
  },
  letterBrandText: {
    color: "#657064",
    fontSize: 12,
    fontWeight: "900"
  },
  decorClover: {
    position: "absolute",
    width: 66,
    height: 66
  },
  decorCloverTop: {
    top: 18,
    right: 20,
    transform: [{ rotate: "-7deg" }]
  },
  decorCloverBottom: {
    bottom: 18,
    left: 18,
    transform: [{ rotate: "10deg" }]
  },
  decorCloverLeftMid: {
    top: 164,
    left: -12,
    transform: [{ scale: 0.72 }, { rotate: "14deg" }]
  },
  decorCloverRightMid: {
    top: 270,
    right: -8,
    transform: [{ scale: 0.62 }, { rotate: "-12deg" }]
  },
  decorCloverLowerRight: {
    bottom: 92,
    right: 46,
    transform: [{ scale: 0.5 }, { rotate: "8deg" }]
  },
  decorFourLeafHidden: {
    top: 352,
    left: 72,
    transform: [{ scale: 0.58 }, { rotate: "-10deg" }]
  },
  dots: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 6
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 999,
    backgroundColor: "#dfe8da"
  },
  postscript: {
    gap: 10,
    padding: 16,
    borderWidth: 1,
    borderColor: "#dfe8da",
    borderRadius: 8,
    backgroundColor: "#fff"
  },
  sectionTitle: {
    color: "#18241b",
    fontSize: 16,
    fontWeight: "900"
  },
  postscriptInput: {
    minHeight: 96,
    padding: 12,
    borderWidth: 1,
    borderColor: "#dfe8da",
    borderRadius: 8
  },
  save: {
    alignItems: "center",
    paddingVertical: 13,
    borderRadius: 8,
    backgroundColor: "#18241b"
  },
  saveText: {
    color: "#fff",
    fontWeight: "900"
  },
  shareActions: {
    gap: 8
  },
  share: {
    alignItems: "center",
    paddingVertical: 13,
    borderWidth: 1,
    borderColor: "#dfe8da",
    borderRadius: 8,
    backgroundColor: "#fff"
  },
  shareText: {
    color: "#18241b",
    fontWeight: "900"
  },
  disabledButton: {
    opacity: 0.55
  },
  saveMessage: {
    textAlign: "center",
    fontSize: 13,
    fontWeight: "900"
  }
});
