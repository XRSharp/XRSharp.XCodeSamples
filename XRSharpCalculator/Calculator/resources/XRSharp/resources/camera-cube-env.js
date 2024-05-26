/**
 * Specifies an envMap on an entity, without replacing any existing material properties.
 * The component is based on https://github.com/colinfizgig/aframe_Components/blob/master/components/camera-cube-env.js
 */

AFRAME.registerComponent('camera-cube-env', {
	schema: {
		resolution: { type: 'number', default: 512 },
		distance: { type: 'number', default: 500 },
		interval: { type: 'number', default: 60 },
		matoverride: { type: 'boolean', default: false },
		metalness: { type: 'float', default: 1.0 },
		roughness: { type: 'float', default: 0.0 },
		repeat: { type: 'boolean', default: true }
	},

	/**
	 * Set if component needs multiple instancing.
	 */
	multiple: false,

	/**
	 * Called once when component is attached. Generally for initial setup.
	 */
	init: function () {
		this.tick = AFRAME.utils.throttleTick(this.tick, this.data.interval, this);
		this.renderer = this.el.sceneEl.renderer;
		this.pmremGenerator = new THREE.PMREMGenerator(this.renderer);
		this.pmremGenerator.compileCubemapShader();
		this.cubeRenderTarget = new THREE.WebGLCubeRenderTarget(this.data.resolution, this.data.resolution, { generateMipmaps: true, minFilter: THREE.LinearMipmapLinearFilter });
		this.cam = new THREE.CubeCamera(0.2, this.data.distance, this.cubeRenderTarget);
		this.el.object3D.add(this.cam);

		//this method does target for skinned meshes and unskinned
		this.loaded = this.el.addEventListener('model-loaded', () => {

			// Grab the mesh / scene.
			const myMesh = this.el.getObject3D('mesh');
			// Go over the submeshes and modify materials we want.

			myMesh.traverse(node => {
				myMesh.visible = false;

				var camVector = new THREE.Vector3();
				this.el.object3D.getWorldPosition(camVector);
				this.cam.position.copy(this.el.object3D.worldToLocal(camVector));
				this.cam.update(this.renderer, this.el.sceneEl.object3D);

				if (node.type.indexOf('Mesh') !== -1) {
					if (this.data.matoverride == true) {
						node.material.metalness = this.data.metalness;
						node.material.roughness = this.data.roughness;
					}
					node.material.envMap = this.cam.renderTarget.texture;
					node.material.needsUpdate = true;
				}
				myMesh.visible = true;
			});
		});
	},

	tick: function (t, dt) {
		if (!this.done) {
			this.redraw(this.cam, this.el, this.el.getObject3D('mesh'), this.renderer, this.pmremGenerator);
			if (!this.data.repeat) {
				this.done = true;
			}
		}
	},

	redraw: function (myCam, myEl, myMesh, renderer, pmremGenerator) {
		if (myMesh == null)
			return;

		myMesh.visible = false;

		var camVector = new THREE.Vector3();
		myEl.object3D.getWorldPosition(camVector);
		myCam.position.copy(myEl.object3D.worldToLocal(camVector));
		myCam.update(renderer, myEl.sceneEl.object3D);

		var userData = myEl.object3D.userData;
		userData.renderTarget?.dispose();
		userData.renderTarget = pmremGenerator.fromCubemap(myCam.renderTarget.texture);

		myMesh.traverse(child => {
			if (child.isMesh) {
				child.material.envMap = userData.renderTarget.texture;
				child.material.needsUpdate = true;
			}
		});
		myMesh.visible = true;
	},

	/**
	 * Called when component is attached and when component data changes.
	 * Generally modifies the entity based on the data.
	 */
	update: function (oldData) {
		this.redraw(this.cam, this.el, this.el.getObject3D('mesh'), this.renderer, this.pmremGenerator);
	},

	/**
	 * Called when a component is removed (e.g., via removeAttribute).
	 * Generally undoes all modifications to the entity.
	 */
	remove: function () {
		this.loaded.remove();
		this.cubeRenderTarget.dispose();
		this.pmremGenerator.dispose();
	}
});