'use client'

import { useEffect, useRef } from 'react'

const BLOB_COLORS = [
  { r: 15, g: 15, b: 15 },
  { r: 80, g: 80, b: 80 },
  { r: 180, g: 180, b: 180 },
  { r: 230, g: 230, b: 230 },
  { r: 40, g: 40, b: 40 },
]

export default function FluidCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const mouse = { x: 0, y: 0, targetX: 0, targetY: 0, speed: 0 }
    let lastMouseX = 0
    let lastMouseY = 0
    let blobs: any[] = []
    let globalTime = 0
    let raf = 0

    function resize() {
      canvas!.width = window.innerWidth
      canvas!.height = window.innerHeight
      initBlobs()
    }

    function initBlobs() {
      const w = canvas!.width
      const h = canvas!.height
      blobs = BLOB_COLORS.map((color, i) => ({
        baseX: w * (0.15 + (i / BLOB_COLORS.length) * 0.7),
        baseY: h * (0.35 + Math.random() * 0.3),
        x: 0, y: 0,
        radius: Math.min(w, h) * (0.22 + Math.random() * 0.15),
        color,
        seed: Math.random() * 100,
        speed: 0.004 + Math.random() * 0.004,
      }))
    }

    function handleMouseMove(e: MouseEvent) {
      mouse.targetX = e.clientX
      mouse.targetY = e.clientY
      const dx = e.clientX - lastMouseX
      const dy = e.clientY - lastMouseY
      mouse.speed = Math.min(Math.sqrt(dx * dx + dy * dy) * 0.8, 120)
      lastMouseX = e.clientX
      lastMouseY = e.clientY
    }

    function animate() {
      globalTime += 0.005
      ctx!.fillStyle = '#FFFFFF'
      ctx!.fillRect(0, 0, canvas!.width, canvas!.height)

      mouse.x += (mouse.targetX - mouse.x) * 0.08
      mouse.y += (mouse.targetY - mouse.y) * 0.08
      mouse.speed *= 0.95

      blobs.forEach((blob, index) => {
        blob.seed += blob.speed

        const timeFactor = globalTime * 2 + index
        const waveX = Math.sin(blob.seed) * 50 + Math.cos(timeFactor) * 30
        const waveY = Math.cos(blob.seed) * 50 + Math.sin(timeFactor) * 30

        const mDx = mouse.x - (blob.baseX + waveX)
        const mDy = mouse.y - (blob.baseY + waveY)
        const distance = Math.sqrt(mDx * mDx + mDy * mDy)

        let forceX = 0, forceY = 0
        if (distance < 600) {
          const pushIntensity = (1 - distance / 600) * (50 + mouse.speed * 1.5)
          forceX = (mDx / distance) * pushIntensity
          forceY = (mDy / distance) * pushIntensity
        }

        const currentTargetX = blob.baseX + waveX + forceX
        const currentTargetY = blob.baseY + waveY + forceY

        blob.x += (currentTargetX - blob.x) * 0.06
        blob.y += (currentTargetY - blob.y) * 0.06

        const grad = ctx!.createRadialGradient(blob.x, blob.y, 0, blob.x, blob.y, blob.radius)
        const alpha = 0.22 + Math.sin(globalTime + index) * 0.05

        grad.addColorStop(0, `rgba(${blob.color.r}, ${blob.color.g}, ${blob.color.b}, ${alpha})`)
        grad.addColorStop(0.5, `rgba(${blob.color.r}, ${blob.color.g}, ${blob.color.b}, ${alpha * 0.4})`)
        grad.addColorStop(1, 'rgba(255, 255, 255, 0)')

        ctx!.fillStyle = grad
        ctx!.beginPath()
        ctx!.arc(blob.x, blob.y, blob.radius, 0, Math.PI * 2)
        ctx!.fill()
      })

      raf = requestAnimationFrame(animate)
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('resize', resize)
    resize()
    animate()

    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('resize', resize)
      cancelAnimationFrame(raf)
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      className="absolute top-0 left-0 w-full h-full pointer-events-none"
      style={{
        zIndex: 1,
        filter: 'blur(100px)',
        opacity: 0.9,
      }}
    />
  )
}
