<template>
  <div id="threeContainer" />
  <div id="ui">
    Zoom: scroll<br />
    Size: ↑/↓<br />
    Rotation: ←/→<br />
    Decrease edges: &lt;<br />
    Increase edges: &gt;<br />
    Change zoom mode: left-mouse click<br />
    Reset: R<br />
    <label for="file-input" class="upload-button">Upload Image (JPG/PNG)</label>
    <input type="file" id="file-input" hidden @change="handleImageUpload" />
  </div>
</template>

<style scoped>
canvas {
  z-index: 100;
}

.upload-button {
  display: inline-block;
  margin-top: 10px;
  padding: 10px 20px;
  background-color: #555;
  color: white;
  border-radius: 5px;
  cursor: pointer;
}
</style>

<script>
import * as THREE from 'three'
import fragmentShader from '@/assets/webgl/shaders/magnifyFragmentShader.frag?raw'
import vertexShader from '@/assets/webgl/shaders/magnifyVertexShader.vert?raw'

export default {
  data() {
    return {
      uploadedImgUrl: null,
    }
  },
  methods: {
    handleImageUpload(event) {
      const file = event.target.files[0]
      if (!file) return
      // Check type again (extra safety)
      if (!['image/jpeg', 'image/png'].includes(file.type)) {
        alert('Only JPG and PNG are allowed.')
        return
      }

      this.uploadedImgUrl = file
    },
  },
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
    const drawCanvas = () => {
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

      if (this.uploadedImgUrl !== null) {
        const reader = new FileReader()
        reader.onload = () => {
          // reader.onload = (e) => {
          // const img = new Image()
          // img.onload = () => {
          //   ctx.drawImage(img, 0, 0)
          // }
          // img.src = e.target.result
        }
        reader.readAsDataURL(this.uploadedImgUrl)
        ctx.fillText('THIS IS WORKING', w / 2, h / 2 + 60)
      }
    }

    drawCanvas()

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

    let shaderMat = new THREE.ShaderMaterial({
      uniforms: uniforms,

      vertexShader: vertexShader,
      fragmentShader: fragmentShader,

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
    // USER INTERACTION
    // ============================

    let mouseX = 0
    let mouseY = 0
    let glassEffect = true

    window.addEventListener('mousemove', (e) => {
      mouseX = e.clientX
      mouseY = e.clientY

      if (glassEffect) {
        // Another glass effect
        // -----------------------
        // uniforms.uCenter.value.set(
        //   (mouseX / W()) * canvas.width,
        //   (1 - mouseY / H()) * canvas.height
        // )
        // -----------------------
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
      drawCanvas()
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

    // ============================
    // RENDER PAGE
    // ============================

    function animate() {
      requestAnimationFrame(animate)
      renderer.render(scene, camera)
    }
    animate()

    // Log errors
    window.__demo = { uniforms, rebuildMagnifier }
  },
}
</script>
