"""
Convierte los colores escritos a mano en los CSS de la web en variables
(--k-xxxxxx) y genera apps/web/src/theme.css con sus valores claro y oscuro.

Uso: python3 scripts/theme-tokens.py   (se puede volver a ejecutar si se
añaden colores nuevos; los ya convertidos se conservan).
"""
import colorsys
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent / "apps/web/src"
FILES = [ROOT / "index.css", ROOT / "App.css", *sorted((ROOT / "components").glob("*.css"))]
THEME = ROOT / "theme.css"
HEX = re.compile(r"#([0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3})\b")

# Colores que se mantienen igual en oscuro (texto claro sobre fondos de color).
KEEP = {"fffaf0"}

# Zonas que conservan siempre los colores claros: tablero de madera y piezas.
LIGHT_ZONES = [
    ".shogi-grid",
    ".shogi-piece",
    ".shogi-hand-piece",
    ".piece-info-kanji",
    ".move-diagram",
    ".mini-board",
    ".promotion-preview",
    ".piece-guide-legend i",
]


def normalize(code: str) -> str:
    code = code.lower()
    if len(code) == 3:
        code = "".join(ch * 2 for ch in code)
    return code


def to_dark(code: str) -> str:
    rgb, alpha = code[:6], code[6:]
    if rgb in KEEP:
        return code
    r, g, b = (int(rgb[i : i + 2], 16) / 255 for i in (0, 2, 4))
    h, l, s = colorsys.rgb_to_hls(r, g, b)
    if s < 0.35 or l > 0.8:
        # Neutros y fondos suaves: se invierte la luminosidad.
        l = 0.10 + (1 - l) * 0.80
        s *= 0.55
    elif l < 0.4:
        # Colores intensos oscuros usados como texto: se aclaran mucho.
        l = 0.74
    else:
        # Colores de marca/acento: un poco más claros sobre fondo oscuro.
        l = min(0.72, l + 0.08)
    r, g, b = colorsys.hls_to_rgb(h, l, s)
    return "".join(f"{round(c * 255):02x}" for c in (r, g, b)) + alpha


def main() -> None:
    colors: dict[str, None] = {}
    if THEME.exists():
        for code in re.findall(r"--k-([0-9a-f]{6,8}):", THEME.read_text()):
            colors[code] = None

    for path in FILES:
        text = path.read_text()

        def repl(match: re.Match) -> str:
            code = normalize(match.group(1))
            colors[code] = None
            return f"var(--k-{code})"

        # No tocar las propias definiciones de variables ni el theme.css.
        new = HEX.sub(repl, text)
        if new != text:
            path.write_text(new)

    light = "\n".join(f"  --k-{c}: #{c};" for c in colors)
    dark = "\n".join(f"  --k-{c}: #{to_dark(c)};" for c in colors)
    zones = ",\n".join(LIGHT_ZONES)
    THEME.write_text(
        f"""/*
 * ARCHIVO GENERADO por scripts/theme-tokens.py — no editar a mano.
 * Cada color de la web es una variable con su valor claro y oscuro.
 * El modo oscuro se activa con el sistema (prefers-color-scheme) o con
 * data-theme="dark" en <html>; data-theme="light" fuerza el claro.
 */

:root {{
  color-scheme: light;
{light}
}}

@media (prefers-color-scheme: dark) {{
  :root:not([data-theme='light']) {{
    color-scheme: dark;
{dark.replace(chr(10), chr(10) + '  ').replace('  --k', '    --k', 1)}
  }}
}}

:root[data-theme='dark'] {{
  color-scheme: dark;
{dark}
}}

/* El tablero de madera y las piezas se ven siempre en sus colores claros. */
{zones} {{
{light}
}}
"""
    )
    print(f"{len(colors)} colores convertidos en variables → {THEME.relative_to(ROOT.parent.parent.parent)}")


if __name__ == "__main__":
    main()
