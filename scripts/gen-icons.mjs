// Gera os ícones PNG do PWA a partir de public/icon-maskable.svg
import sharp from 'sharp'
import { readFileSync } from 'node:fs'

const svg = readFileSync('public/icon-maskable.svg')
const targets = [
  ['public/pwa-192.png', 192],
  ['public/pwa-512.png', 512],
  ['public/apple-touch-icon.png', 180],
]

for (const [file, size] of targets) {
  await sharp(svg, { density: 384 }).resize(size, size).png().toFile(file)
  console.log('gerado', file, `${size}x${size}`)
}
