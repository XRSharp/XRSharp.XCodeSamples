AFRAME.registerComponent('hand-draggable', {
    schema: {
        pinchDistance: { default: 0.03 }
    },

    init: function () {
        var sceneEl = this.el.sceneEl;
        this.worldPosition = new THREE.Vector3();
        this.localPosition = new THREE.Vector3();
        this.offset = new THREE.Vector3();
        this.bindMethods();
        this.pinchedHand = null;
        sceneEl.addEventListener('pinchstarted', this.onPinchStarted);
        sceneEl.addEventListener('pinchended', this.onPinchEnded);
        sceneEl.addEventListener('pinchmoved', this.onPinchMoved);
    },

    bindMethods: function () {
        this.onPinchStarted = this.onPinchStarted.bind(this);
        this.onPinchEnded = this.onPinchEnded.bind(this);
        this.onPinchMoved = this.onPinchMoved.bind(this);
    },

    onPinchStarted: function (evt) {
        var pinchDistance = this.calculatePinchDistance(evt.detail.position);
        if (pinchDistance < this.data.pinchDistance) {
            //this.el.emit('pinchedstarted');

            this.el.components.anchored?.deleteAnchor();

            var localPosition = this.localPosition;
            localPosition.copy(evt.detail.position);
            this.el.object3D.worldToLocal(localPosition);
            this.offset = localPosition.clone();
            this.pinchedHand = evt.target;
        }
    },

    calculatePinchDistance: function (pinchWorldPosition) {
        var boundingBox = new THREE.Box3().setFromObject(this.el.object3D);
        return boundingBox.distanceToPoint(pinchWorldPosition);
    },

    onPinchEnded: function (evt) {
        if (this.pinchedHand === evt.target) {
            this.pinchedHand = null;
            //this.el.emit('pinchedended');

            this.el.components.anchored?.createAnchor(this.el.object3D.position, this.el.object3D.quaternion);
        }
    },

    onPinchMoved: function (evt) {
        if (this.pinchedHand !== evt.target) { return; }
        var el = this.el;
        //el.emit('pinchedmoved', evt.detail);       
        var localPosition = this.localPosition;
        localPosition.copy(evt.detail.position);
        el.object3D.worldToLocal(localPosition);
        var offsetPosition = localPosition.sub(this.offset).multiply(el.object3D.scale);
        el.object3D.position.add(offsetPosition);
    }
});
