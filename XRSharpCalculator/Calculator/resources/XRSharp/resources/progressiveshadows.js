// based on https://github.com/vis-prime/progressive-shadows/blob/main/src/ProgressiveShadows.js

const {
    Color,
    DirectionalLightHelper,
    PlaneHelper,
    MeshLambertMaterial,
    DirectionalLight,
    DoubleSide,
    FloatType,
    Group,
    HalfFloatType,
    PlaneGeometry,
    WebGLRenderTarget,
    ShaderMaterial,
    UniformsUtils,
    Camera,
} = THREE;

class ProgressiveShadows {
    constructor(
        renderer,
        scene,
        {
            resolution = 1024,
            shadowMapRes = 512,
            shadowBias = 0.001,
            lightCount = 8,
            size = 4,
            planeWidth = 4,
            planeHeight = 4,
            frames = 40,
            lightRadius = 2,
            ambientWeight = 0.5,
            alphaTest = 0.98,
            temporal = true,
        } = {}
    ) {
        this.params = {
            enabled: true,
            temporal,
            frames,
            lightRadius,
            ambientWeight,
            alphaTest,
            debugHelpers: false,
            size,
            planeWidth,
            planeHeight,
        }
        this.scene = scene
        this.renderer = renderer
        this.buffer1Active = false
        this.dirLights = []
        this.dirLightsHelpers = []
        this.clearColor = new Color()
        this.clearAlpha = 0
        this.progress = 0
        this.discardMaterial = new DiscardMaterial()
        this.lights = []
        this.meshes = []
        this.objectsToHide = []
        this.framesDone = 0

        // All objects3d made by this class is added here , which is added to the scene
        this.progShadowGrp = new Group()
        this.progShadowGrp.name = "progressive_shadow_assets"
        this.scene.add(this.progShadowGrp)

        //light position control (only the position of this object used , lights are added to light group)
        this.lightOrigin = new Group()
        this.lightOrigin.name = "light_origin"
        this.lightOrigin.position.set(size, size, size)
        this.progShadowGrp.add(this.lightOrigin)

        // All lights are added to this group
        this.lightGroup = new Group()
        this.lightGroup.name = "all_dir_lights"
        this.progShadowGrp.add(this.lightGroup)

        // create 8 directional lights to speed up the convergence
        for (let l = 0; l < lightCount; l++) {
            const dirLight = new DirectionalLight(0xffffff, 1 / lightCount)
            dirLight.name = "dir_light_" + l
            dirLight.castShadow = true
            dirLight.shadow.bias = shadowBias
            dirLight.shadow.camera.near = 0.1
            dirLight.shadow.camera.far = 50
            dirLight.shadow.camera.right = size / 2
            dirLight.shadow.camera.left = -size / 2
            dirLight.shadow.camera.top = size / 2
            dirLight.shadow.camera.bottom = -size / 2
            dirLight.shadow.mapSize.width = shadowMapRes
            dirLight.shadow.mapSize.height = shadowMapRes
            this.dirLights.push(dirLight)
            this.lightGroup.add(dirLight)
        }

        // Create the Progressive LightMap Texture
        const format = /(Android|iPad|iPhone|iPod)/g.test(navigator.userAgent) ? HalfFloatType : FloatType
        const targetHeight = Math.round(resolution / (planeWidth / planeHeight));
        this.progressiveLightMap1 = new WebGLRenderTarget(resolution, targetHeight, { type: format, colorSpace: this.renderer.outputColorSpace })
        this.progressiveLightMap2 = new WebGLRenderTarget(resolution, targetHeight, { type: format, colorSpace: this.renderer.outputColorSpace })

        // Material applied to shadow catching plane
        this.shadowCatcherMaterial = new SoftShadowMaterial({
            map: this.progressiveLightMap2.texture,
        })

        // Create plane to catch shadows
        this.shadowCatcherMesh = new THREE.Mesh(new PlaneGeometry(planeWidth, planeHeight), this.shadowCatcherMaterial)
        this.shadowCatcherMesh.position.y = 0.001 // avoid z-flicker
        this.shadowCatcherMesh.name = "shadowCatcherMesh"
        this.shadowCatcherMesh.receiveShadow = true
        this.progShadowGrp.add(this.shadowCatcherMesh)

        // Create group to add assets to debug shadow catcher
        this.debugHelpersGroup = new Group()

        //Inject some spicy new logic into a standard Lambert material
        this.targetMat = new MeshLambertMaterial({ fog: false })
        this.previousShadowMap = { value: this.progressiveLightMap1.texture }
        this.averagingWindow = { value: frames }
        this.targetMat.onBeforeCompile = (shader) => {
            // Vertex Shader: Set Vertex Positions to the Unwrapped UV Positions
            shader.vertexShader =
                "varying vec2 vUv;\n" + shader.vertexShader.slice(0, -1) + "vUv = uv; gl_Position = vec4((uv - 0.5) * 2.0, 1.0, 1.0); }"

            // Fragment Shader: Set Pixels to average in the Previous frame's Shadows
            const bodyStart = shader.fragmentShader.indexOf("void main() {")
            shader.fragmentShader =
                "varying vec2 vUv;\n" +
                shader.fragmentShader.slice(0, bodyStart) +
                "uniform sampler2D previousShadowMap;\n	uniform float averagingWindow;\n" +
                shader.fragmentShader.slice(bodyStart - 1, -1) +
                `\nvec3 texelOld = texture2D(previousShadowMap, vUv).rgb;
        gl_FragColor.rgb = mix(texelOld, gl_FragColor.rgb, 1.0/ averagingWindow);
      }`

            // Set the Previous Frame's Texture Buffer and Averaging Window
            shader.uniforms.previousShadowMap = this.previousShadowMap
            shader.uniforms.averagingWindow = this.averagingWindow
        }
    }

    remove() {
        this.params.enabled = false;
        this.scene.remove(this.progShadowGrp);
        this.discardMaterial.dispose();
        this.shadowCatcherMaterial.dispose();
        this.targetMat.dispose();
        this.progressiveLightMap1.dispose();
        this.progressiveLightMap2.dispose();
        this.lights.length = 0;
        this.meshes.length = 0;
        this.objectsToHide.length = 0;
        this.dirLights.length = 0;
        this.dirLightsHelpers.length = 0;        
    }

    /**
     * This function renders each mesh one at a time into their respective surface maps
     * @param {Camera} camera Standard Rendering Camera
     */
    renderOnRenderTargets(camera) {
        this.prepare()
        // this.targetMat.uniforms.averagingWindow = { value: this.params.blendWindow }
        this.averagingWindow.value = this.params.frames

        // Ping-pong two surface buffers for reading/writing
        const activeMap = this.buffer1Active ? this.progressiveLightMap1 : this.progressiveLightMap2
        const inactiveMap = this.buffer1Active ? this.progressiveLightMap2 : this.progressiveLightMap1

        const xrEnabled = this.renderer.xr.enabled;
        this.renderer.xr.enabled = false;

        // Render the object's surface maps
        this.renderer.setRenderTarget(activeMap)
        // this.targetMat.uniforms.previousShadowMap = { value: inactiveMap.texture }
        this.previousShadowMap.value = inactiveMap.texture

        this.buffer1Active = !this.buffer1Active
        this.renderer.render(this.scene, camera)

        this.finish()

        // Restore the original Render Target
        this.renderer.setRenderTarget(null)
        this.renderer.xr.enabled = xrEnabled;
    }

    /**
     * Make Debug assets visible
     * @param {boolean} visible Whether the debug plane should be visible
     */
    showDebugHelpers(visible) {
        if (!this.debugHelpersGroup.children.length) {
            const renderTargetDisplayHelper = new THREE.Mesh(
                this.shadowCatcherMesh.geometry,
                new THREE.MeshBasicMaterial({
                    map: this.progressiveLightMap1.texture,
                    side: DoubleSide,
                })
            )
            renderTargetDisplayHelper.position.copy(this.shadowCatcherMesh.position);
            renderTargetDisplayHelper.rotation.copy(this.shadowCatcherMesh.rotation);
            renderTargetDisplayHelper.position.y += 1;

            for (const dirLight of this.dirLights) {
                const helper = new DirectionalLightHelper(dirLight)
                this.dirLightsHelpers.push(helper)
            }

            const originLightSphere = new THREE.Mesh(new THREE.SphereGeometry(0.05));
            originLightSphere.position.copy(this.lightOrigin.position);

            const plane = new THREE.Plane();
            const normal = new THREE.Vector3(0, 0, 1).applyQuaternion(this.shadowCatcherMesh.quaternion);
            const point = new THREE.Vector3().copy(this.shadowCatcherMesh.position);
            plane.setFromNormalAndCoplanarPoint(normal, point);
            const shadowAreaHelper = new PlaneHelper(plane, this.params.size, 0xffff00);

            this.debugHelpersGroup.add(renderTargetDisplayHelper, originLightSphere, shadowAreaHelper, ...this.dirLightsHelpers);
        }

        if (visible) {
            this.progShadowGrp.add(this.debugHelpersGroup)
            this.dirLightsHelpers.forEach((h) => {
                h.update()
            })
        } else {
            this.progShadowGrp.remove(this.debugHelpersGroup)
        }
    }

    /**
     * Randomise direction lights
     */
    randomiseLights() {
        const length = this.lightOrigin.position.length()
        // Manually Update the Directional Lights
        for (let l = 0; l < this.dirLights.length; l++) {
            // Sometimes they will be sampled from the target direction
            // Sometimes they will be uniformly sampled from the upper hemisphere
            if (Math.random() > this.params.ambientWeight) {
                this.dirLights[l].position.set(
                    this.lightOrigin.position.x + THREE.MathUtils.randFloatSpread(this.params.lightRadius),
                    this.lightOrigin.position.y + THREE.MathUtils.randFloatSpread(this.params.lightRadius),
                    this.lightOrigin.position.z + THREE.MathUtils.randFloatSpread(this.params.lightRadius)
                )
            } else {
                // Uniform Hemispherical Surface Distribution for Ambient Occlusion
                const lambda = Math.acos(2 * Math.random() - 1) - 3.14159 / 2.0
                const phi = 2 * 3.14159 * Math.random()
                this.dirLights[l].position.set(
                    Math.cos(lambda) * Math.cos(phi) * length,
                    Math.abs(Math.cos(lambda) * Math.sin(phi) * length),
                    Math.sin(lambda) * length
                )
            }

            if (this.params.debugHelpers) this.dirLightsHelpers[l].update()
        }
    }

    /**
     * Trigger an update
     */
    async recalculate() {
        if (!this.params.enabled) return
        this.clear()
        this.framesDone = 0
    }

    /**
     * Prepare all meshes/lights
     */
    prepare() {
        this.lights.forEach((l) => (l.object.intensity = 0))
        this.meshes.forEach((m) => (m.object.material = this.discardMaterial))
        this.objectsToHide.forEach((m) => (m.object.visible = false))

        this.lightGroup.visible = true
        this.shadowCatcherMesh.material = this.targetMat
        if (this.params.debugHelpers) this.showDebugHelpers(false)
    }

    /**
     * Restore all meshes/lights
     */
    finish() {
        this.lights.forEach((l) => (l.object.intensity = l.intensity))
        this.meshes.forEach((m) => (m.object.material = m.material))
        this.objectsToHide.forEach((m) => (m.object.visible = m.visible))
        this.lightGroup.visible = false
        this.shadowCatcherMesh.material = this.shadowCatcherMaterial
        if (this.params.debugHelpers) this.showDebugHelpers(true)
    }

    /**
     * Clear the shadow Target & update mesh list
     * Call this once after all the models are loaded
     */
    clear() {
        this.framesDone = this.params.frames;
        this.renderer.getClearColor(this.clearColor)
        this.clearAlpha = this.renderer.getClearAlpha()
        this.renderer.setClearColor("black", 1) // setting to any other color/alpha will decrease shadow's impact when accumulating
        this.renderer.setRenderTarget(this.progressiveLightMap1)
        this.renderer.clear()
        this.renderer.setRenderTarget(this.progressiveLightMap2)
        this.renderer.clear()
        this.renderer.setRenderTarget(null)
        this.renderer.setClearColor(this.clearColor, this.clearAlpha)

        this.shadowCatcherMesh.material.alphaTest = 0.0

        this.updateShadowObjectsList()
    }

    /**
     * Update list of meshes which need to be hidden
     */
    updateShadowObjectsList() {
        this.lights.length = 0
        this.meshes.length = 0
        this.objectsToHide.length = 0
        this.scene.traverse((object) => {
            if (object.geometry && object !== this.shadowCatcherMesh) {
                if (object.castShadow) {
                    this.meshes.push({ object, material: object.material, matrixWorld: object.matrixWorld.clone() })
                } else {
                    this.objectsToHide.push({ object, visible: object.visible })
                }
            } else if (object.isTransformControls) {
                this.objectsToHide.push({ object, visible: object.visible })
            } else if (object.isLight && object.parent !== this.lightGroup) {
                this.lights.push({ object, intensity: object.intensity })
            }
        })

        // console.log({ meshes: this.meshes, lights: this.lights, objectsToHide: this.objectsToHide })
    }

    /**
     * Add this function to animate loop
     * @param {Camera} camera
     */
    update(camera) {
        if (!this.params.enabled || this.scene.el?.is('ar-mode'))
            return;

        if (this.framesDone >= this.params.frames) {
            if (!this.renderer.xr.enabled) {
                for (var i = 0; i < this.meshes.length; i++) {
                    var mesh = this.meshes[i];
                    if (!mesh.object.matrixWorld.equals(mesh.matrixWorld)) {
                        this.recalculate();
                        break;
                    }
                }
            }
            return;
        }

        if (this.params.temporal) {
            this.shadowCatcherMesh.material.alphaTest = THREE.MathUtils.clamp(
                THREE.MathUtils.mapLinear(this.framesDone, 2, this.params.frames - 1, 0, this.params.alphaTest),
                0,
                1
            )

            this.renderOnRenderTargets(camera)
            this.randomiseLights()
            this.progress = THREE.MathUtils.mapLinear(this.framesDone, 0, this.params.frames - 1, 0, 100)

            this.framesDone++
        }
        else {
            const xrEnabled = this.renderer.xr.enabled;
            this.renderer.xr.enabled = false;
            this.prepare();

            for (; this.framesDone < this.params.frames; this.framesDone++) {

                this.shadowCatcherMesh.material.alphaTest = THREE.MathUtils.clamp(
                    THREE.MathUtils.mapLinear(this.framesDone, 2, this.params.frames - 1, 0, this.params.alphaTest),
                    0,
                    1
                );

                this.shadowCatcherMesh.material = this.targetMat;

                // Ping-pong two surface buffers for reading/writing
                const activeMap = this.buffer1Active ? this.progressiveLightMap1 : this.progressiveLightMap2;
                const inactiveMap = this.buffer1Active ? this.progressiveLightMap2 : this.progressiveLightMap1;

                // Render the object's surface maps
                this.renderer.setRenderTarget(activeMap);
                this.previousShadowMap.value = inactiveMap.texture;

                this.buffer1Active = !this.buffer1Active;
                this.renderer.render(this.scene, camera);
                
                this.shadowCatcherMesh.material = this.shadowCatcherMaterial;

                this.randomiseLights();
            }

            this.finish();

            // Restore the original Render Target
            this.renderer.setRenderTarget(null);
            this.renderer.xr.enabled = xrEnabled;
        }
    }

    saveShadowsAsImage() {
        const canvas = document.createElement("canvas");
        const color = new Color();
        const renderTarget = this.progressiveLightMap1
        const width = renderTarget.width
        const height = renderTarget.height
        console.log(renderTarget)
        const pixels = new Float32Array(width * height * 4)
        this.renderer.readRenderTargetPixels(renderTarget, 0, 0, width, height, pixels)
        const shadowColor = this.shadowCatcherMaterial.color
        const blend = this.shadowCatcherMaterial.blend

        let min = 100000,
            max = 0
        for (let i = 0; i < pixels.length; i += 4) {
            min = Math.min(min, pixels[i])
            max = Math.max(max, pixels[i])
        }

        const range = max - min
        const alphaScale = 1 / range

        for (let i = 0; i < pixels.length; i += 4) {
            color.fromArray(pixels, i)
            const diffuse = color.r
            const invertedValue = max - diffuse
            const alphaValue = invertedValue * alphaScale
            pixels[i + 3] = alphaValue
            color.setRGB(diffuse * shadowColor.r * blend, diffuse * shadowColor.g * blend, diffuse * shadowColor.b * blend)
            // color.convertLinearToSRGB()
            color.toArray(pixels, i)
        }

        const uint8ClampedArray = new Uint8ClampedArray(pixels.length);

        for (let i = 0; i < pixels.length; i++) {
            uint8ClampedArray[i] = Math.round(pixels[i] * 255)
        }

        // setup canvas to draw the image data onto
        canvas.width = width
        canvas.height = height

        // Draw the image data onto the canvas
        const context = canvas.getContext("2d")
        const imageData = new ImageData(uint8ClampedArray, width, height)
        context.putImageData(imageData, 0, 0)

        // Create a data URL for the image
        const pngUrl = canvas.toDataURL("image/png")

        // Create a new anchor element
        const link = document.createElement("a")

        // Set the href attribute of the anchor element to the PNG data URL
        link.href = pngUrl

        // Set the download attribute of the anchor element to the desired file name
        link.download = "ground_shadows.png"

        // Simulate a click on the anchor element to download the image
        link.click()
    }
}

/**
 * r3f shader material which makes editing uniforms easy
 * @param {Object} uniforms
 * @param {String} vertexShader
 * @param {String} fragmentShader
 * @param {Function} onInit
 * @returns
 */
function shaderMaterial(uniforms = {}, vertexShader, fragmentShader, onInit = (material) => { }) {
    const material = class extends ShaderMaterial {
        constructor(parameters = {}) {
            const entries = Object.entries(uniforms)
            // Create uniforms and shaders
            super({
                uniforms: entries.reduce((acc, [name, value]) => {
                    const uniform = UniformsUtils.clone({ [name]: { value } })
                    return {
                        ...acc,
                        ...uniform,
                    }
                }, {}),
                vertexShader,
                fragmentShader,
            })
            // Create getter/setters
            entries.forEach(([name]) =>
                Object.defineProperty(this, name, {
                    get: () => this.uniforms[name].value,
                    set: (v) => (this.uniforms[name].value = v),
                })
            )

            // Assign parameters, this might include uniforms
            Object.assign(this, parameters)
            // Call onInit
            if (onInit) onInit(this)
        }
    }
    material.key = THREE.MathUtils.generateUUID()
    return material
}

/**
 * r3f shadow material
 */
const SoftShadowMaterial = shaderMaterial(
    {
        transparent: true,
        color: new Color(0, 0, 0),
        alphaTest: 0.0,
        opacity: 1.0,
        map: null,
        depthWrite: false,
        toneMapped: false,
        blend: 2.0,
    },
    `varying vec2 vUv;
   void main() {
     gl_Position = projectionMatrix * viewMatrix * modelMatrix * vec4(position, 1.);
     vUv = uv;
   }`,
    `varying vec2 vUv;
   uniform sampler2D map;
   uniform vec3 color;
   uniform float opacity;
   uniform float alphaTest;
   uniform float blend;
   void main() {
     vec4 sampledDiffuseColor = texture2D(map, vUv);
     gl_FragColor = vec4(color * sampledDiffuseColor.r * blend, max(0.0, (1.0 - (sampledDiffuseColor.r + sampledDiffuseColor.g + sampledDiffuseColor.b) / alphaTest)) * opacity);
     #include <tonemapping_fragment>
     #include <colorspace_fragment>
   }`
)

/**
 * r3f Discard material which helps ignore materials when rendering
 */
const DiscardMaterial = shaderMaterial({}, "void main() { }", "void main() { gl_FragColor = vec4(0.0, 0.0, 0.0, 0.0); discard;  }")

THREE.ProgressiveShadows = ProgressiveShadows;