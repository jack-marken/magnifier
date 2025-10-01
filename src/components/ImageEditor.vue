<template>
  <div id="threeContainer" />
  <div id="ui">
    Zoom: scroll<br />
    Size: ↑/↓<br />
    Rotation: ←/→<br />
    Decrease edges: &lt;<br />
    Increase edges: &gt;<br />
    Change zoom mode: left-mouse click<br />
    Reset: R
  </div>
</template>

<style scoped>
canvas {
  z-index: 100;
}
</style>

<script>
import * as THREE from 'three'

export default {
  mounted() {
    const container = document.getElementById('threeContainer')
    const W = () => window.innerWidth
    const H = () => window.innerHeight

    const renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setPixelRatio(window.devicePixelRatio || 1)
    renderer.setSize(W(), H())
    container.appendChild(renderer.domElement)

    const scene = new THREE.Scene()
    const camera = new THREE.OrthographicCamera(0, W(), H(), 0, -1000, 1000)
    camera.aspect = W() / H()
    camera.position.z = 10
    scene.add(camera)

    const canvas = document.createElement('canvas')

    canvas.width = W()
    canvas.height = H()

    // ============================
    // CANVAS CONTENT
    // ============================

    const ctx = canvas.getContext('2d')
    function drawText() {
      const w = canvas.width,
        h = canvas.height

      ctx.fillStyle = '#020202'
      ctx.fillRect(0, 0, w, h)

      const fontSize = 42
      ctx.font = `700 ${fontSize}px system-ui, Arial`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillStyle = '#fff'
      ctx.fillText('Polygon magnifier tool demo', w / 2, h / 2 - 30)

      ctx.font = `300 ${fontSize * 0.7}px system-ui, Arial`
      ctx.fillText('move your mouse + scroll to zoom', w / 2, h / 2 + 30)
    }

    drawText()
    let canvasTexture = new THREE.CanvasTexture(canvas)
    canvasTexture.minFilter = THREE.LinearFilter
    canvasTexture.magFilter = THREE.LinearFilter
    canvasTexture.needsUpdate = true

    const meshGeometry = new THREE.PlaneGeometry(W(), H())
    const meshMaterial = new THREE.MeshBasicMaterial({ map: canvasTexture })
    const mesh = new THREE.Mesh(meshGeometry, meshMaterial)
    mesh.position.set(W() / 2, H() / 2, 0)
    scene.add(mesh)

    // ============================
    // POLYGONAL MAGNIFYING GLASS
    // ============================

    const POLYGON_DEFAULTS = {
      sides: 5,
      rotation: 0,
      radius: 0.2,
      zoom: 1.0,
    }
    let sides = POLYGON_DEFAULTS.sides
    let rotation = POLYGON_DEFAULTS.sides
    let radius = POLYGON_DEFAULTS.radius

    let magnifierMesh = null

    let uniforms = {
      uTexture: {},
      uResolution: {},
      uCenter: {},
      uZoom: {},
      uFeather: {},
    }

    function SetUniforms() {
      canvasTexture = new THREE.CanvasTexture(canvas)
      uniforms.uTexture = { value: canvasTexture }
      uniforms.uResolution = { value: new THREE.Vector2(W(), H()) }
      uniforms.uCenter = { value: new THREE.Vector2(W() / 2, H() / 2) }
      uniforms.uZoom = { value: POLYGON_DEFAULTS.zoom }
      uniforms.uFeather = { value: 0.08 }
    }
    SetUniforms()

    const vert = `
uniform vec2 uResolution;
varying vec2 vWorld;
void main(){
	// position is in local mesh coords; compute world position in pixels
	vec4 worldPos = modelMatrix * vec4(position, 1.0);
	vWorld = worldPos.xy;
	gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`
    const frag = `
uniform sampler2D uTexture;
uniform vec2 uResolution;
uniform vec2 uCenter;
uniform float uZoom;
uniform float uFeather;
varying vec2 vWorld;

void main(){
	vec2 uv = vWorld / uResolution;
	vec2 cUV = uCenter / uResolution;
	vec2 delta = uv - cUV;
	vec2 sampleUV = cUV + delta / uZoom;
	// sample magnified
	vec4 mag = texture2D(uTexture, sampleUV);
	// sample original
	vec4 orig = texture2D(uTexture, uv);
	// simple smooth edge based on distance to center (normalized)
	float dist = length(delta) / (max(uResolution.x, uResolution.y));
	float edge = smoothstep(uFeather, 0.0, dist);
	gl_FragColor = mix(orig, mag, edge);
}
`

    let shaderMat = new THREE.ShaderMaterial({
      uniforms: uniforms,

      vertexShader: vert,
      fragmentShader: frag,

      transparent: true,
      depthTest: false,
    })

    function makePolygonShape(sides, radius) {
      const shape = new THREE.Shape()
      for (let i = 0; i < sides; i++) {
        const a = (i / sides) * Math.PI * 2
        const x = Math.cos(a) * radius
        const y = Math.sin(a) * radius
        if (i === 0) shape.moveTo(x, y)
        else shape.lineTo(x, y)
      }
      shape.closePath()
      return shape
    }

    function rebuildMagnifier(x, y) {
      if (magnifierMesh) {
        scene.remove(magnifierMesh)
        magnifierMesh.geometry.dispose()
      }
      const shape = makePolygonShape(sides, Math.min(W(), H()) * radius)
      const geo = new THREE.ShapeGeometry(shape)
      magnifierMesh = new THREE.Mesh(geo, shaderMat)
      // Place mesh so its center aligns with (x,y) in world pixels
      magnifierMesh.position.set(x, y, 1)
      magnifierMesh.rotateZ(rotation)
      scene.add(magnifierMesh)
    }

    rebuildMagnifier(W() / 2, H() / 2)

    // ============================
    let mouseX = 0
    let mouseY = 0
    let glassEffect = true

    window.addEventListener('mousemove', (e) => {
      mouseX = e.clientX
      mouseY = e.clientY

      if (glassEffect) {
        // uniforms.uCenter.value.set(
        //   (mouseX / W()) * canvas.width,
        //   (1 - mouseY / H()) * canvas.height
        // )
        uniforms.uCenter.value.set(mouseX, mouseY)
      } else {
        uniforms.uCenter.value.set(W() / 2, H() / 2)
      }
      rebuildMagnifier(mouseX, H() - mouseY)
    })

    window.addEventListener('click', () => {
      glassEffect = !glassEffect
    })

    window.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowUp') {
        radius += 0.02
      }
      if (e.key === 'ArrowDown') {
        radius -= 0.02
      }
      if (e.key === 'ArrowLeft') {
        rotation += 0.1
      }
      if (e.key === 'ArrowRight') {
        rotation -= 0.1
      }
      if (e.key === 'r') {
        sides = POLYGON_DEFAULTS.sides
        rotation = POLYGON_DEFAULTS.sides
        radius = POLYGON_DEFAULTS.radius
        SetUniforms()
      }
      if (e.key === ',') {
        sides = Math.max(3, sides - 1)
      }
      if (e.key === '.') {
        sides = Math.min(20, sides + 1)
      }
      rebuildMagnifier(mouseX, H() - mouseY)
    })

    window.addEventListener('resize', () => {
      renderer.setSize(W(), H())

      camera.left = 0
      camera.right = W()
      camera.top = H()
      camera.bottom = 0
      camera.updateProjectionMatrix()

      canvas.width = W()
      canvas.height = H()
      mesh.position.set(W() / 2, H() / 2, 0)
      drawText()
      SetUniforms()
      rebuildMagnifier(W() / 2, H() / 2)
    })

    window.addEventListener(
      'wheel',
      (e) => {
        const ZOOM_SPEED = 0.02
        const MIN_ZOOM = 0.01
        const MAX_ZOOM = 1.4
        e.preventDefault()
        const delta = Math.sign(e.deltaY)
        let z = uniforms.uZoom.value
        z *= delta > 0 ? 1 - ZOOM_SPEED : 1 + ZOOM_SPEED
        uniforms.uZoom.value = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, z))
      },
      { passive: false }
    )

    function animate() {
      requestAnimationFrame(animate)
      renderer.render(scene, camera)
    }
    animate()

    window.__demo = { uniforms, rebuildMagnifier }
  },
}
</script>
