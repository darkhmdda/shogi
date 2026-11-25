import { StatusBar } from 'expo-status-bar'
import { useEffect, useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context'
import { ACCOUNTS_AVAILABLE, loadAccount } from './src/account'
import { loadProgress } from './src/progress'
import { AccountScreen } from './src/screens/AccountScreen'
import { OnlineScreen } from './src/screens/OnlineScreen'
import { HomeScreen } from './src/screens/HomeScreen'
import { LessonsScreen } from './src/screens/LessonsScreen'
import { PlayScreen } from './src/screens/PlayScreen'
import { PuzzlesScreen } from './src/screens/PuzzlesScreen'
import { loadTheme, type Colors, useColors, useIsDark, useStyles } from './src/theme'

type Tab = 'home' | 'lessons' | 'puzzles' | 'play' | 'online' | 'account'

const TABS: { id: Tab; icon: string; label: string }[] = [
  { id: 'home', icon: '⌂', label: 'Inicio' },
  { id: 'lessons', icon: '書', label: 'Aprender' },
  { id: 'puzzles', icon: '詰', label: 'Problemas' },
  { id: 'play', icon: '対', label: 'Jugar' },
  ...(ACCOUNTS_AVAILABLE
    ? [
        { id: 'online' as const, icon: '網', label: 'En línea' },
        { id: 'account' as const, icon: '人', label: 'Cuenta' },
      ]
    : []),
]

export default function App() {
  const colors = useColors()
  const isDark = useIsDark()
  const styles = useStyles(createStyles)
  const [tab, setTab] = useState<Tab>('home')

  useEffect(() => {
    loadTheme()
    loadProgress().then(loadAccount)
  }, [])

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
        <StatusBar style={isDark ? 'light' : 'dark'} />
        <View style={styles.header}>
          <View style={styles.brandMark}>
            <Text style={styles.brandKanji}>将</Text>
          </View>
          <Text style={styles.brand}>
            shōgi<Text style={{ color: colors.accent }}>.</Text>
          </Text>
        </View>

        <View style={styles.content}>
          {tab === 'home' && <HomeScreen onNavigate={setTab} />}
          {tab === 'lessons' && <LessonsScreen />}
          {tab === 'puzzles' && <PuzzlesScreen />}
          {tab === 'play' && <PlayScreen />}
          {tab === 'online' && <OnlineScreen onNeedAccount={() => setTab('account')} />}
          {tab === 'account' && <AccountScreen />}
        </View>
      </SafeAreaView>

      <SafeAreaView edges={['bottom']} style={styles.tabBarSafe}>
        <View style={styles.tabBar} accessibilityRole="tablist">
          {TABS.map((item) => {
            const active = item.id === tab
            return (
              <Pressable
                key={item.id}
                onPress={() => setTab(item.id)}
                accessibilityRole="tab"
                accessibilityState={{ selected: active }}
                style={styles.tab}
              >
                <Text style={[styles.tabIcon, active && styles.tabActive]}>{item.icon}</Text>
                <Text style={[styles.tabLabel, active && styles.tabActive]}>{item.label}</Text>
              </Pressable>
            )
          })}
        </View>
      </SafeAreaView>
    </SafeAreaProvider>
  )
}

const createStyles = (colors: Colors) =>
  StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  brandMark: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.accent },
  brandKanji: { color: colors.onAccent, fontSize: 20 },
  brand: { fontSize: 22, fontWeight: '700', color: colors.text },
  content: { flex: 1 },
  tabBarSafe: { backgroundColor: colors.surface },
  tabBar: { flexDirection: 'row', borderTopWidth: 1, borderTopColor: colors.border },
  tab: { flex: 1, alignItems: 'center', paddingVertical: 8, gap: 2 },
  tabIcon: { fontSize: 20, color: colors.muted },
  tabLabel: { fontSize: 11, color: colors.muted, fontWeight: '600' },
  tabActive: { color: colors.accent },
})
