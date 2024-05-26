// for hand tracking, see https://github.com/aframevr/aframe/blob/master/examples/showcase/hand-tracking/pressable.js
AFRAME.registerComponent('hand-pressable', {
    schema: {
        pressDistance: { default: 0.001 },
        hoverDistance: { default: 0.006 }
    },

    init: function () {
        this.worldPosition = new THREE.Vector3();
        this.handEls = document.querySelectorAll('[hand-tracking-controls]');
        this.pressed = [];
        this.fingerOver = [];
        this.indexTipPosition = [];
        this.eventDetails = {};

        for (var i = 0; i < this.handEls.length; i++) {
            this.pressed[i] = false;
            this.fingerOver[i] = false;
            this.indexTipPosition[i] = new THREE.Vector3();
        }
    },

    tick: function () {
        var handEls = this.handEls;
        var handEl;
        var distance;
        for (var i = 0; i < handEls.length; i++) {
            handEl = handEls[i];
            var indexTipPosition = handEl.components['hand-tracking-controls'].indexTipPosition.clone();
            if (this.areVectorsAlmostEqual(indexTipPosition, this.indexTipPosition[i])) {                
                continue; // do not calculate the distance if the finger position is not changed
            }
            this.indexTipPosition[i] = indexTipPosition;            
            distance = this.calculateFingerDistance(indexTipPosition);

            if (distance < this.data.hoverDistance) {
                if (!this.fingerOver[i]) {
                    this.el.emit('mouseenter', this.eventDetails);
                    this.fingerOver[i] = true;
                }
            } else if (this.fingerOver[i]) {
                this.el.emit('mouseleave', this.eventDetails);
                this.fingerOver[i] = false;
            }

            if (distance < this.data.pressDistance) {
                if (!this.pressed[i]) {
                    this.el.emit('mousedown', this.eventDetails);
                    this.pressed[i] = true;
                }
            }
            else if (this.pressed[i]) {
                this.el.emit('mouseup', this.eventDetails);
                this.pressed[i] = false;
            }
        }
    },

    areVectorsAlmostEqual: function (vec1, vec2, epsilon = 0.001) {
        return Math.abs(vec1.x - vec2.x) < epsilon &&
               Math.abs(vec1.y - vec2.y) < epsilon &&
               Math.abs(vec1.z - vec2.z) < epsilon;
    },

    calculateFingerDistance: function (fingerPosition) {
        var boundingBox = new THREE.Box3().setFromObject(this.el.object3D);
        return boundingBox.distanceToPoint(fingerPosition);
    }
});
