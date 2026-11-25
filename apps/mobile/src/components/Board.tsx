import {
  FILE_LABELS,
  findKing,
  HAND_ORDER,
  isInCheck,
  OWNER_SHORT,
  PIECE_KANJI,
  PIECE_NAMES,
  pieceKanji,
  pieceMovement,
  pieceName,
  RANK_LABELS,
  sameSquare,
  squareLabel,
  type HandKind,
  type Move,
  type Owner,
  type Position,
  type Square,
} from '@shogi/engine'
import type { PendingPromotion, Selection } from '@shogi/react'
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native'
import {type Colors, spacing, useColors, useStyles} from '../theme'
import { Button, Card, Row } from './ui'

const INDICES = [0, 1, 2, 3, 4, 5, 6, 7, 8]

type Props = {
  position: Position
  selection: Selection
  targets: Square[]
  pending: PendingPromotion | null
  lastMove?: Move
  canUseHand: (owner: Owner) => boolean
  onSquare: (square: Square) => void
  onHand: (kind: HandKind) => void
  hideHand?: Owner
  handLabel?: (owner: Owner) => string
  /** Ver el tablero desde el lado de Gote. */
  flipped?: boolean
}

/** Tablero táctil de 9×9 con coordenadas y manos. */
export function Board({
  position,
  selection,
  targets,
  pending,
  lastMove,
  canUseHand,
  onSquare,
  onHand,
  hideHand,
  handLabel,
  flipped = false,
}: Props) {
  const colors = useColors()
  const styles = useStyles(createStyles)
  const rows = flipped ? [...INDICES].reverse() : INDICES
  const cols = flipped ? [...INDICES].reverse() : INDICES
  const { width } = useWindowDimensions()
  const boardWidth = Math.min(width, 520) - spacing.lg * 2 - 18
  const cell = Math.floor(boardWidth / 9)
  const checked = isInCheck(position.board, position.turn) ? findKing(position.board, position.turn) : null

  function renderHand(owner: Owner) {
    if (owner === hideHand) return null
    const hand = position.hands[owner]
    const usable = canUseHand(owner)
    const total = HAND_ORDER.reduce((sum, kind) => sum + hand[kind], 0)

    return (
      <View style={[styles.hand, { borderLeftColor: owner === 'sente' ? colors.sente : colors.gote }]}>
        <Text style={styles.handLabel}>
          {owner === 'sente' ? '☗' : '☖'} {handLabel ? handLabel(owner) : OWNER_SHORT[owner]}
        </Text>
        {total === 0 && <Text style={styles.muted}>Sin piezas</Text>}
        {HAND_ORDER.map((kind) => {
          const count = hand[kind]
          if (count === 0) return null
          const selected = owner === position.turn && selection?.type === 'hand' && selection.kind === kind
          return (
            <Pressable
              key={kind}
              disabled={!usable}
              onPress={() => onHand(kind)}
              accessibilityRole="button"
              accessibilityLabel={`${PIECE_NAMES[kind]} en la mano, cantidad ${count}`}
              accessibilityState={{ selected, disabled: !usable }}
              style={[styles.handPiece, selected && styles.handSelected, !usable && styles.handDisabled]}
            >
              <Text style={styles.handKanji}>{PIECE_KANJI[kind]}</Text>
              {count > 1 && <Text style={styles.handCount}>×{count}</Text>}
            </Pressable>
          )
        })}
      </View>
    )
  }

  return (
    <View style={styles.wrapper}>
      {renderHand(flipped ? 'sente' : 'gote')}

      <View>
        <View style={[styles.fileRow, { marginLeft: 18 }]}>
          {cols.map((col) => (
            <Text key={col} style={[styles.coord, { width: cell }]}>
              {FILE_LABELS[col]}
            </Text>
          ))}
        </View>
        <View style={styles.boardRow}>
          <View>
            {rows.map((row) => (
              <Text key={row} style={[styles.coord, styles.rankCoord, { height: cell, lineHeight: cell }]}>
                {RANK_LABELS[row]}
              </Text>
            ))}
          </View>
          <View style={styles.grid}>
            {rows.map((row) => (
              <View key={row} style={styles.row}>
                {cols.map((col) => {
                  const square = { row, col }
                  const piece = position.board[row][col]
                  const selected = selection?.type === 'square' && sameSquare(selection.square, square)
                  const target = targets.some((t) => sameSquare(t, square))
                  const last =
                    lastMove !== undefined &&
                    (sameSquare(lastMove.to, square) || (lastMove.type === 'move' && sameSquare(lastMove.from, square)))
                  const inCheck = checked !== null && sameSquare(checked, square)
                  const isPending = pending !== null && sameSquare(pending.to, square)

                  return (
                    <Pressable
                      key={col}
                      onPress={() => onSquare(square)}
                      accessibilityRole="button"
                      accessibilityLabel={`${squareLabel(square)}, ${
                        piece ? `${pieceName(piece)} de ${OWNER_SHORT[piece.owner]}` : 'vacía'
                      }${target ? ', destino posible' : ''}`}
                      style={[
                        styles.cell,
                        { width: cell, height: cell },
                        last && { backgroundColor: colors.lastMove },
                        inCheck && { backgroundColor: colors.check },
                        selected && {
                          backgroundColor: position.turn === 'sente' ? colors.selectedSente : colors.selectedGote,
                        },
                        isPending && { borderColor: colors.pending, borderWidth: 2 },
                      ]}
                    >
                      {piece && (
                        <View
                          style={[
                            styles.piece,
                            { width: cell * 0.84, height: cell * 0.9 },
                            (piece.owner === 'gote') !== flipped && styles.upsideDown,
                          ]}
                        >
                          <Text
                            style={[
                              styles.pieceText,
                              { fontSize: cell * 0.5 },
                              piece.promoted && { color: colors.promoted },
                            ]}
                          >
                            {pieceKanji(piece)}
                          </Text>
                        </View>
                      )}
                      {target && (
                        <View
                          pointerEvents="none"
                          style={piece ? [styles.captureHint, { borderRadius: cell }] : [styles.moveHint, { width: cell * 0.28, height: cell * 0.28, borderRadius: cell }]}
                        />
                      )}
                    </Pressable>
                  )
                })}
              </View>
            ))}
          </View>
        </View>
      </View>

      {renderHand(flipped ? 'gote' : 'sente')}
    </View>
  )
}

/** Panel para elegir si se promociona una pieza. */
export function PromotionPanel({
  position,
  pending,
  onChoose,
}: {
  position: Position
  pending: PendingPromotion
  onChoose: (promote: boolean) => void
}) {
  const colors = useColors()
  const styles = useStyles(createStyles)
  const piece = position.board[pending.from.row][pending.from.col]
  if (!piece) return null
  const promoted = { ...piece, promoted: true }

  return (
    <Card style={{ borderColor: colors.pending }}>
      <Text style={styles.title}>
        Promoción: {pieceKanji(piece)} → <Text style={{ color: colors.promoted }}>{pieceKanji(promoted)}</Text>
      </Text>
      <Text style={styles.body}>
        {pieceName(promoted)}: {pieceMovement(promoted)}
      </Text>
      <Row>
        <Button title="Promocionar" variant="primary" onPress={() => onChoose(true)} />
        <Button title="No promocionar" onPress={() => onChoose(false)} />
      </Row>
    </Card>
  )
}

const createStyles = (colors: Colors) =>
  StyleSheet.create({
  wrapper: { gap: spacing.sm, alignItems: 'center' },
  hand: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 6,
    padding: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderLeftWidth: 4,
    borderColor: colors.border,
    backgroundColor: colors.handBg,
  },
  handLabel: { fontWeight: '700', color: colors.text, marginRight: 4 },
  handPiece: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: colors.woodLine,
    backgroundColor: colors.handPiece,
  },
  handSelected: { backgroundColor: colors.selectedSente, borderColor: colors.sente, borderWidth: 2 },
  handDisabled: { opacity: 0.6 },
  handKanji: { fontSize: 20, color: colors.handPieceText },
  handCount: { fontSize: 12, color: colors.handPieceText },
  muted: { color: colors.muted },
  fileRow: { flexDirection: 'row' },
  boardRow: { flexDirection: 'row' },
  coord: { textAlign: 'center', fontSize: 11, color: colors.coordinates, fontWeight: '600' },
  rankCoord: { width: 18 },
  grid: { borderTopWidth: 1, borderLeftWidth: 1, borderColor: colors.woodLine, backgroundColor: colors.wood },
  row: { flexDirection: 'row' },
  cell: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.woodLine,
  },
  piece: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 4,
    borderTopLeftRadius: 10,
    borderTopRightRadius: 10,
    backgroundColor: colors.piece,
    shadowColor: colors.shadow,
    shadowOpacity: 0.2,
    shadowRadius: 1,
    shadowOffset: { width: 1, height: 1 },
    elevation: 1,
  },
  upsideDown: { transform: [{ rotate: '180deg' }] },
  pieceText: { color: colors.pieceText, fontWeight: '500' },
  moveHint: { position: 'absolute', backgroundColor: colors.hint },
  captureHint: {
    position: 'absolute',
    top: 2,
    left: 2,
    right: 2,
    bottom: 2,
    borderWidth: 3,
    borderColor: colors.hintRing,
  },
  title: { fontSize: 16, fontWeight: '700', color: colors.text },
  body: { color: colors.text, lineHeight: 20 },
})
