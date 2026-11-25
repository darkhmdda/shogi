import { JAPANESE_NAMES, LESSONS, PIECE_KANJI, pieceMovement, pieceName, TSUME, type PieceKind } from '@shogi/engine'
import { ScrollView, StyleSheet, Text, View } from 'react-native'
import { Button, Card, Row } from '../components/ui'
import { resetProgress, useProgress } from '../progress'
import { colors, spacing } from '../theme'

const KINDS: PieceKind[] = ['king', 'rook', 'bishop', 'gold', 'silver', 'knight', 'lance', 'pawn']

export function HomeScreen({ onNavigate }: { onNavigate: (tab: 'lessons' | 'puzzles' | 'play') => void }) {
  const progress = useProgress()
  const lessons = Object.keys(progress.lessons).length
  const puzzles = Object.keys(progress.puzzles).length

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.eyebrow}>BIENVENIDO AL SHŌGI</Text>
      <Text style={styles.hero}>
        Cada gran jugador <Text style={styles.heroAccent}>comienza con</Text> un movimiento.
      </Text>
      <Text style={styles.body}>Aprende el ajedrez japonés a tu ritmo: lecciones, problemas de mate y partidas.</Text>

      <View style={styles.stats}>
        <Card style={styles.stat}>
          <Text style={styles.statValue}>
            {lessons}/{LESSONS.length}
          </Text>
          <Text style={styles.muted}>lecciones</Text>
        </Card>
        <Card style={styles.stat}>
          <Text style={styles.statValue}>
            {puzzles}/{TSUME.length}
          </Text>
          <Text style={styles.muted}>problemas</Text>
        </Card>
        <Card style={styles.stat}>
          <Text style={styles.statValue}>{progress.games.won}</Text>
          <Text style={styles.muted}>victorias</Text>
        </Card>
      </View>

      <Row>
        <Button title="Empezar las lecciones" variant="primary" onPress={() => onNavigate('lessons')} />
        <Button title="Jugar" onPress={() => onNavigate('play')} />
      </Row>

      <Text style={styles.section}>Las piezas</Text>
      {KINDS.map((kind) => (
        <Card key={kind} style={styles.piece}>
          <View style={styles.pieceIcon}>
            <Text style={styles.pieceKanji}>{kind === 'king' ? '玉' : PIECE_KANJI[kind]}</Text>
          </View>
          <View style={styles.pieceText}>
            <Text style={styles.pieceName}>
              {pieceName({ kind })} <Text style={styles.muted}>· {JAPANESE_NAMES[kind]}</Text>
            </Text>
            <Text style={styles.body}>{pieceMovement({ kind })}</Text>
          </View>
        </Card>
      ))}

      <Button title="Reiniciar progreso" onPress={resetProgress} />
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { padding: spacing.lg, gap: spacing.md },
  eyebrow: { color: colors.accent, fontSize: 12, fontWeight: '700', letterSpacing: 1.5 },
  hero: { fontSize: 32, lineHeight: 38, color: colors.text, fontFamily: 'serif' },
  heroAccent: { color: colors.accent, fontStyle: 'italic' },
  body: { color: colors.text, lineHeight: 21 },
  muted: { color: colors.muted },
  stats: { flexDirection: 'row', gap: spacing.sm },
  stat: { flex: 1, alignItems: 'center', gap: 2 },
  statValue: { fontSize: 22, fontWeight: '700', color: colors.text },
  section: { fontSize: 22, color: colors.text, fontFamily: 'serif', marginTop: spacing.md },
  piece: { flexDirection: 'row', alignItems: 'center' },
  pieceIcon: {
    width: 44,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderTopLeftRadius: 14,
    borderTopRightRadius: 14,
    borderRadius: 4,
    backgroundColor: colors.piece,
  },
  pieceKanji: { fontSize: 24, color: colors.pieceText },
  pieceText: { flex: 1, gap: 2 },
  pieceName: { fontWeight: '700', color: colors.text, textTransform: 'capitalize' },
})
