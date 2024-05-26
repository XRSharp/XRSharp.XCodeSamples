/*====================================================================================*\
*
* Copyright (c) Userware. This is proprietary code. All rights reserved.
*
\*====================================================================================*/

document.createInputManager3D = function (callback) {
    if (document.inputManager3D) return;

    // This must remain synchronized with the EVENTS enum defined in InputManager3D.cs.
    // Make sure to change both files if you update this !
    const EVENTS = {
        //MOUSE_MOVE: 0,
        MOUSE_LEFT_DOWN: 1,
        MOUSE_LEFT_UP: 2,
        MOUSE_RIGHT_DOWN: 3,
        MOUSE_RIGHT_UP: 4,
        MOUSE_ENTER: 5,
        MOUSE_LEAVE: 6,
        //WHEEL: 7,
        //KEYDOWN: 8,
        //KEYUP: 9,
        //KEYPRESS: 10,
        TOUCH_START: 11,
        TOUCH_END: 12,
        //TOUCH_MOVE: 13,
        //FOCUS_MANAGED: 14,
        //FOCUS_UNMANAGED: 15,
        //WINDOW_FOCUS: 16,
        //WINDOW_BLUR: 17,

        MOUSE_DOWN: 20,
        MOUSE_UP: 21,
        CLICK: 22,
        FUSING: 23,
    };

    //const MODIFIERKEYS = {
    //    NONE: 0,
    //    CONTROL: 1,
    //    ALT: 2,
    //    SHIFT: 4,
    //    WINDOWS: 8,
    //};

    //let _modifiers = MODIFIERKEYS.NONE;
    let _mouseCapture = null;

    //function setModifiers(e) {
    //    _modifiers = MODIFIERKEYS.NONE;
    //    if (e.ctrlKey)
    //        _modifiers |= MODIFIERKEYS.CONTROL;
    //    if (e.altKey)
    //        _modifiers |= MODIFIERKEYS.ALT;
    //    if (e.shiftKey)
    //        _modifiers |= MODIFIERKEYS.SHIFT;
    //    if (e.metaKey)
    //        _modifiers |= MODIFIERKEYS.WINDOWS;
    //};

    function getClosestElementId(element) {
        while (element) {
            const xamlid = element.xamlid;
            if (xamlid) {
                return xamlid;
            }

            element = element.parentElement;
        }

        return '';
    };

    document.inputManager3D = {
        addListeners: function (element, isFocusable, isInteractable, isHandPressable) {
            const view = typeof element === 'string' ? document.getElementById(element) : element;
            if (!view) return;

            if (isInteractable) {
                // raycaster component observes only objects with 'interactable' attribute
                view.setAttribute('interactable', '');
            }

            if (isHandPressable) {
                view.setAttribute('hand-pressable', '');
            }

            view.addEventListener('mousedown', function (e) {
                if (!e.isHandled) {
                    e.isHandled = true;
                    let id = (_mouseCapture === null || this === _mouseCapture) ? getClosestElementId(this) : '';
                    let mouseEvent = e.detail.mouseEvent;
                    let touchEvent = e.detail.touchEvent;
                    if (mouseEvent) {
                        switch (mouseEvent.button) {
                            case 0:
                                callback(id, EVENTS.MOUSE_LEFT_DOWN, e);
                                break;
                            case 2:
                                callback(id, EVENTS.MOUSE_RIGHT_DOWN, e);
                                break;
                        }
                    }
                    else if (touchEvent) {
                        callback(id, EVENTS.TOUCH_START, e);
                    } else {
                        callback(id, EVENTS.MOUSE_DOWN, e);
                    }
                }
            });

            view.addEventListener('mouseup', function (e) {
                if (!e.isHandled) {
                    e.isHandled = true;
                    const target = _mouseCapture || this;
                    let id = getClosestElementId(target);
                    let mouseEvent = e.detail.mouseEvent;
                    let touchEvent = e.detail.touchEvent;
                    if (mouseEvent) {
                        switch (mouseEvent.button) {
                            case 0:
                                callback(id, EVENTS.MOUSE_LEFT_UP, e);
                                break;
                            case 2:
                                callback(id, EVENTS.MOUSE_RIGHT_UP, e);
                                break;
                        }
                    } else if (touchEvent) {
                        callback(id, EVENTS.TOUCH_END, e);
                    } else {
                        callback(id, EVENTS.MOUSE_UP, e);
                    }
                }
            });

            view.addEventListener('click', function (e) {
                if (!e.isHandled) {
                    e.isHandled = true;
                    const target = _mouseCapture || this;
                    callback(getClosestElementId(target), EVENTS.MOUSE_UP, e);
                }
            });

            //view.addEventListener('mousemove', function (e) {
            //    if (!e.isHandled) {
            //        e.isHandled = true;
            //        const target = _mouseCapture || this;
            //        callback(getClosestElementId(target), EVENTS.MOUSE_MOVE, e);
            //    }
            //});

            //view.addEventListener('wheel', function (e) {
            //    if (!e.isHandled) {
            //        e.isHandled = true;
            //        callback(getClosestElementId(this), EVENTS.WHEEL, e);
            //    }
            //});

            view.addEventListener('mouseenter', function (e) {
                if (_mouseCapture === null || this === _mouseCapture) {
                    callback(getClosestElementId(this), EVENTS.MOUSE_ENTER, e);
                }
            });

            view.addEventListener('mouseleave', function (e) {
                if (_mouseCapture === null || this === _mouseCapture) {
                    callback(getClosestElementId(this), EVENTS.MOUSE_LEAVE, e);
                }
            });

            //if (isTouchDevice()) {
            //    view.addEventListener('touchstart', function (e) {
            //        if (!e.isHandled) {
            //            e.isHandled = true;
            //            callback(getClosestElementId(this), EVENTS.TOUCH_START, e);
            //        }
            //    }, { passive: true });

            //    view.addEventListener('touchend', function (e) {
            //        if (!e.isHandled) {
            //            e.isHandled = true;
            //            callback(getClosestElementId(this), EVENTS.TOUCH_END, e);
            //            e.preventDefault();
            //        }
            //    });

            //    view.addEventListener('touchmove', function (e) {
            //        if (!e.isHandled) {
            //            e.isHandled = true;
            //            callback(getClosestElementId(this), EVENTS.TOUCH_MOVE, e);
            //        }
            //    }, { passive: true });
            //}

            //if (isFocusable) {
            //    view.addEventListener('keypress', function (e) {
            //        if (!e.isHandled) {
            //            e.isHandled = true;
            //            callback(getClosestElementId(this), EVENTS.KEYPRESS, e);
            //        }
            //    });

            //    view.addEventListener('keydown', function (e) {
            //        if (!e.isHandled) {
            //            e.isHandled = true;
            //            setModifiers(e);
            //            callback(getClosestElementId(this), EVENTS.KEYDOWN, e);
            //        }
            //    });

            //    view.addEventListener('keyup', function (e) {
            //        if (!e.isHandled) {
            //            e.isHandled = true;
            //            setModifiers(e);
            //            callback(getClosestElementId(this), EVENTS.KEYUP, e);
            //        }
            //    });
            //}
        },
        //getModifiers: function () {
        //    return _modifiers;
        //},
        captureMouse: function (element) {
            _mouseCapture = element;
            document.body.classList.add('opensilver-mouse-captured');
        },
        releaseMouseCapture: function () {
            _mouseCapture = null;
            document.body.classList.remove('opensilver-mouse-captured');
        },
    };
};

document.createScene = function (sceneId, parentId, rendererSettings, isLoadingScreenEnabled, orbitControlsSettings, assetsTimeoutMs) {
    const scene = document.createElement('a-scene');
    scene.setAttribute('id', sceneId);
    Object.defineProperty(scene, 'xamlid', { value: sceneId, writable: false });
    scene.style.pointerEvents = 'auto';

    scene.setAttribute('renderer', rendererSettings);

    scene.setAttribute('loading-screen', `dotsColor: white; backgroundColor: black; enabled: ${isLoadingScreenEnabled}`);
    scene.setAttribute('device-orientation-permission-ui', 'enabled: false');
    scene.setAttribute('xr-mode-ui', 'enabled: false');

    document.buttonsManager.createEnterXRButtons(scene);

    scene.addEventListener('mouseenter', function (e) { if (e instanceof CustomEvent) e.stopImmediatePropagation(); });
    scene.addEventListener('mouseleave', function (e) { if (e instanceof CustomEvent) e.stopImmediatePropagation(); });

    const rig = document.createElement('a-entity');
    const camera = document.createElement('a-camera');
    rig.appendChild(camera);
    scene.appendChild(rig);

    const cursor = document.createElement('a-entity');
    cursor.setAttribute('cursor', 'rayOrigin', 'mouse');
    cursor.setAttribute('raycaster', 'objects', '[interactable]');
    camera.appendChild(cursor);

    if (orbitControlsSettings != null) {
        camera.setAttribute('orbit-controls', orbitControlsSettings);
    }

    const leftLaser = document.createElement('a-entity');
    leftLaser.setAttribute('laser-controls', 'hand: left');
    leftLaser.setAttribute('raycaster', 'objects', '[interactable]');
    scene.appendChild(leftLaser);

    const rightLaser = document.createElement('a-entity');
    rightLaser.setAttribute('laser-controls', 'hand: right');
    rightLaser.setAttribute('raycaster', 'objects', '[interactable]');
    scene.appendChild(rightLaser);

    const leftHand = document.createElement('a-entity');
    leftHand.setAttribute('hand-tracking-controls', 'hand: left');
    scene.appendChild(leftHand);

    const rightHand = document.createElement('a-entity');
    rightHand.setAttribute('hand-tracking-controls', 'hand: right');
    scene.appendChild(rightHand);

    const assets = document.createElement('a-assets');
    assets.setAttribute('timeout', assetsTimeoutMs);
    scene.appendChild(assets);

    Object.defineProperty(scene, 'dump', {
        get() { return document.dumpProperties(sceneId); }
    });

    document.getElementById(parentId).appendChild(scene);
}

// alternative to https://aframe.io/docs/1.5.0/components/xr-mode-ui.html
document.buttonsManager = {

    enterVRText: 'Enter VR',
    enterARText: 'Enter AR',
    enterXRText: 'Enter VR/AR',
    enterXRSmallText: 'VR/AR',
    hiddenClass: 'a-hidden',
    subtleClass: 'subtle',
    modalHtml: `<p>To test VR/AR please open this webpage on a headset or on mobile phone.</p>
                <p><a id="questLink" target="_blank" class="xr-modal-link">Send this page</a> to your Quest headset</p>`,
    smallScreenWidth: 750,
    cardboardModeEnabled: false,
    scene: null,
    container: null,
    vrButton: null,
    arButton: null,

    createEnterXRButtons: function (scene) {
        this.scene = scene;

        var container = document.createElement('div');
        container.classList.add('xr-buttons-container');
        container.classList.add(this.hiddenClass);
        this.container = container;

        var vrButton = document.createElement('button');
        vrButton.classList.add('xr-button');
        vrButton.innerHTML = this.enterVRText;
        vrButton.addEventListener('click', () => this.onEnterVRButtonClick());
        container.appendChild(vrButton);
        this.vrButton = vrButton;

        var arButton = document.createElement('button');
        arButton.classList.add('xr-button');
        arButton.innerHTML = this.enterARText;
        arButton.addEventListener('click', () => scene.enterAR());
        container.appendChild(arButton);
        this.arButton = arButton;

        scene.appendChild(container);
        scene.addEventListener('loaded', () => container.classList.remove(this.hiddenClass));
        this.updateButtons();

        this.onResize = AFRAME.utils.bind(this.onResize, this);
        window.addEventListener('resize', this.onResize);

        if (this.isMobile()) {
            this.applyStickyHoverFix(vrButton);
            this.applyStickyHoverFix(arButton);
        }
    },

    updateButtons: function () {
        if (AFRAME.utils.device.checkVRSupport()) {
            if (!this.isMobile() || this.cardboardModeEnabled) {
                this.vrButton.classList.remove(this.hiddenClass);
                this.setButtonsStyle(false);
            } else {
                this.vrButton.classList.add(this.hiddenClass);
            }
        } else if (!this.isMobile()) {
            this.vrButton.innerHTML = this.enterXRText;
            this.vrButton.classList.remove(this.hiddenClass);
            this.setButtonsStyle(true);
        } else {
            this.vrButton.classList.add(this.hiddenClass);
        }

        if (AFRAME.utils.device.checkARSupport()) {
            this.arButton.classList.remove(this.hiddenClass);
            this.setButtonsStyle(this.isMobile());
        } else {
            this.arButton.classList.add(this.hiddenClass);
        }
    },

    onEnterVRButtonClick: function () {
        if (AFRAME.utils.device.checkVRSupport()) {
            this.scene.enterVR();
        } else {
            // show modal with info how to test XR app
            var modal = document.createElement('div');
            modal.classList.add('xr-modal');

            var closeButton = document.createElement('span');
            closeButton.classList.add('xr-modal-close-button');
            closeButton.innerHTML = '&times;';
            closeButton.addEventListener('click', () => modal.remove());
            modal.appendChild(closeButton);

            var content = document.createElement('div');
            content.innerHTML = this.modalHtml;
            content.querySelector('#questLink')?.setAttribute('href', 'https://www.oculus.com/open_url/?url=' + window.location);
            modal.appendChild(content);
            this.scene.appendChild(modal);
        }
    },

    isMobile: () => AFRAME.utils.device.isMobile(),

    setButtonsStyle: function (subtle) {
        if (subtle) {
            this.container.classList.add(this.subtleClass);
            this.vrButton.classList.add(this.subtleClass);
            this.arButton.classList.add(this.subtleClass);
        } else {
            this.container.classList.remove(this.subtleClass);
            this.vrButton.classList.remove(this.subtleClass);
            this.arButton.classList.remove(this.subtleClass);
        }
    },

    onResize: function () {
        if (this.vrButton.innerHTML == this.enterXRText || this.vrButton.innerHTML == this.enterXRSmallText) {
            if (this.scene.canvas.clientWidth > this.smallScreenWidth) {
                this.vrButton.innerHTML = this.enterXRText;
            } else {
                this.vrButton.innerHTML = this.enterXRSmallText;
            }
        }
    },

    // to remove hover style on mobile devices
    applyStickyHoverFix: function (buttonEl) {
        buttonEl.addEventListener('touchstart', function () {
            buttonEl.classList.remove('resethover');
        });
        buttonEl.addEventListener('touchend', function () {
            buttonEl.classList.add('resethover');
        });
    },
}

document.dumpProperties = function (id, ...names) {
    if (DotNet && DotNet.invokeMethod) {
        return DotNet.invokeMethod('XRSharp', 'DumpProperties', id, names);
    }
    return null;
};