(function (root, factory) {
	if (typeof define === 'function' && define.amd) define(factory);
	else if (typeof module === 'object' && typeof exports === 'object') module.exports = factory();
	else root.Momentum = factory();
}(this, function () {
	'use strict';

	var baseUri = (function () {
		var scripts = document.getElementsByTagName('script');
		var url = scripts[scripts.length - 1].src;
		if (!url) url = document.URL;
		return url.substring(0, url.lastIndexOf('/') + 1);
	})();

	var styleClassName = '.overflow-scrolling-touch';
	var styleClassDefinition =
		'\t' + styleClassName + ' {\n'
		+ '\t\toverflow: hidden;\n'
		+ '\t\t-webkit-overflow-scrolling: touch;\n'
		+ '\t\tcursor: url(' + baseUri + 'cursors/openhand.cur), move;\n'
		+ '\t\tcursor: -webkit-grab;\n'
		+ '\t\tcursor: -moz-grab;\n'
		+ '\t\tcursor: grab;\n'
		+ '\t}\n'
		+ '\n'
		+ '\t' + styleClassName + ':active, ' + styleClassName + ' :active {\n'
		+ '\t\tcursor: url(' + baseUri + 'cursors/closedhand.cur), move;\n'
		+ '\t\tcursor: -webkit-grabbing;\n'
		+ '\t\tcursor: -moz-grabbing;\n'
		+ '\t\tcursor: grabbing;\n'
		+ '\t}\n';

	function defaultCallback(x, y) {
		var scrollLeftMax = this.scrollLeftMax;
		var scrollTopMax = this.scrollTopMax;

		if (scrollLeftMax) {
			if (x > scrollLeftMax) {
				this.scrollLeft = 0;
				this.style.marginLeft = this.initialMargin.left + x - scrollLeftMax + 'px';
				this.style.marginRight = this.initialMargin.right + scrollLeftMax - x + 'px';
			}
			else if (x < 0) {
				this.scrollLeft = scrollLeftMax;
				this.style.marginRight = this.initialMargin.right - x + 'px';
				this.style.marginLeft = this.initialMargin.left + x + 'px';
			}
			else {
				this.style.marginLeft = 'initial';
				this.style.marginRight = 'initial';
				this.scrollLeft = scrollLeftMax - x;
			}
		}

		if (scrollTopMax) {
			if (y > scrollTopMax) {
				this.scrollTop = 0;
				this.style.marginTop = this.initialMargin.top + y - scrollTopMax + 'px';
				this.style.marginBottom = this.initialMargin.bottom + scrollTopMax - y + 'px';
			}
			else if (y < 0) {
				this.scrollTop = scrollTopMax;
				this.style.marginBottom = this.initialMargin.bottom - y + 'px';
				this.style.marginTop = this.initialMargin.top + y + 'px';
			}
			else {
				this.style.marginTop = 'initial';
				this.style.marginBottom = 'initial';
				this.scrollTop = scrollTopMax - y;
			}
		}
	}

	function Momentum(parameters) {
		var element = parameters.element === undefined ? document : parameters.element;
		var callback = parameters.callback === undefined ? defaultCallback : parameters.callback;
		var multiplier = parameters.multiplier === undefined ? 1 : parameters.multiplier;
		var friction = parameters.friction === undefined ? 0.92 : parameters.friction;
		var elasticity = parameters.elasticity === undefined ? 0.4 : parameters.elasticity;
		var reaction = parameters.reaction === undefined ? 0.2 : parameters.reaction;
		var offset = parameters.initial === undefined ? {x: undefined, y: undefined} : parameters.initial;
		var range = parameters.range === undefined ? {left: undefined, right: undefined, top: undefined, bottom: undefined} : parameters.range;
		var stretch = parameters.stretch === undefined ? true : parameters.stretch;
		var bounce = parameters.bounce === undefined ? false : parameters.bounce;
		var auto = parameters.auto === undefined ? true : parameters.auto;

		var notGecko = true;
		var running = false;
		var dragging = false;
		var moving = false;
		var timeout = 0;
		var current = {x: 0, y: 0};
		var previous = {x: 0, y: 0};
		var velocity = {x: 0, y: 0};

		var requestNewFrame = (function () {
			return window.requestAnimationFrame || window.webkitRequestAnimationFrame || window.mozRequestAnimationFrame || function (callback) {
					window.setTimeout(callback, 1000 / 60);
				};
		})();

		function instantiate(instance, constructor) {
			if (!(instance instanceof constructor)) {
				throw new TypeError('Momentum: Class called as a function');
			}
		}

		function isNumber(value, name) {
			if (typeof value != 'number') throw new Error('Momentum: ' + name + ' not a number');
		}

		function isObject(value, name) {
			if (typeof value != 'object') throw new Error('Momentum: ' + name + ' not an object');
		}

		function isBoolean(value, name) {
			if (typeof value != 'boolean') throw new Error('Momentum: ' + name + ' not a boolean');
		}

		(function validate(me) {
			instantiate(me, Momentum);
			if (!(element instanceof HTMLElement)) throw new Error('Momentum: HTML element not found');
			if (typeof callback != 'function') throw new Error('Momentum: Callback function not defined');
			isNumber(multiplier, 'Multiplier');
			isNumber(friction, 'Friction');
			isNumber(elasticity, 'Elasticity');
			isNumber(reaction, 'Reaction');
			isObject(offset, 'Offset');
			isObject(range, 'Range');
			isBoolean(stretch, 'Stretch');
			isBoolean(bounce, 'Bounce');
			if (range.left !== undefined) isNumber(range.left, 'Range Left');
			if (range.right !== undefined) isNumber(range.right, 'Range Right');
			if (range.top !== undefined) isNumber(range.top, 'Range Top');
			if (range.bottom !== undefined) isNumber(range.bottom, 'Range Bottom');
			if (offset.x !== undefined) isNumber(offset.x, 'Offset X');
			if (offset.y !== undefined) isNumber(offset.y, 'Offset Y');
		})(this);

		(function configure() {
			notGecko = (typeof element.scrollLeftMax != 'number') || (typeof element.scrollTopMax != 'number');
			if (notGecko) {
				element.scrollLeftMax = element.scrollWidth - element.offsetWidth;
				element.scrollTopMax = element.scrollHeight - element.offsetHeight;
			}

			if (auto) {
				range.left = 0;
				range.right = element.scrollLeftMax;
				range.top = 0;
				range.bottom = element.scrollTopMax;
				if (offset.x === undefined) offset.x = range.right - element.scrollLeft;
				if (offset.y === undefined) offset.y = range.bottom - element.scrollTop;
				element.initialMargin = {
					left: Number(/[-.\d]+/.exec(window.getComputedStyle(element).marginLeft)[0]),
					right: Number(/[-.\d]+/.exec(window.getComputedStyle(element).marginRight)[0]),
					top: Number(/[-.\d]+/.exec(window.getComputedStyle(element).marginTop)[0]),
					bottom: Number(/[-.\d]+/.exec(window.getComputedStyle(element).marginBottom)[0])
				};
			} else {
				if (offset.x === undefined) offset.x = 0;
				if (offset.y === undefined) offset.y = 0;
			}
		})();

		function update() {
			callback.call(element, offset.x, offset.y);
		}

		function startDrag(event) {
			event.preventDefault();
			if (!dragging) {
				dragging = true;
				window.clearTimeout(timeout);
				timeout = window.setTimeout(function () {
					moving = false;
				}, 2000);
				if (!moving) {
					moving = true;
					step();
				}
				if (notGecko) {
					element.scrollLeftMax = element.scrollWidth - element.offsetWidth;
					element.scrollTopMax = element.scrollHeight - element.offsetHeight;
				}
				if (auto) {
					range.right = element.scrollLeftMax;
					range.bottom = element.scrollTopMax;
					offset.x = range.right - element.scrollLeft;
					offset.y = range.bottom - element.scrollTop;
				}
				previous.x = current.x = event.clientX;
				previous.y = current.y = event.clientY;
				document.addEventListener('mouseup', stopDrag);
				document.addEventListener('mousemove', moveDrag);
			}
		}

		function stopDrag(event) {
			event.preventDefault();
			if (dragging) {
				dragging = false;
				document.removeEventListener('mouseup', stopDrag);
				document.removeEventListener('mousemove', moveDrag);
			}
		}

		function moveDrag(event) {
			event.preventDefault();
			if (dragging) {
				current.x = event.clientX;
				current.y = event.clientY;
			}
		}

		this.start = function () {
			if (!running) {
				running = true;
				element.addEventListener('mousedown', startDrag);
			}
		};

		this.stop = function () {
			if (running) {
				running = false;
				element.removeEventListener('mousedown', startDrag);
			}
		};

		function step() {
			if (dragging) {
				velocity.x = (current.x - previous.x) * multiplier;
				velocity.y = (current.y - previous.y) * multiplier;
				previous.x = current.x;
				previous.y = current.y;
				offset.x += velocity.x;
				offset.y += velocity.y;
			} else {
				offset.x += velocity.x;
				offset.y += velocity.y;
				velocity.x *= friction;
				velocity.y *= friction;
			}

			if (range.left !== undefined && offset.x <= range.left) {
				if (stretch) {
					velocity.x = (range.left - offset.x) * elasticity;
				} else {
					offset.x = range.left;
					velocity.x *= bounce ? -reaction : 0;
				}
			}
			else if (range.right !== undefined && offset.x >= range.right) {
				if (stretch) {
					velocity.x = (range.right - offset.x) * elasticity;
				} else {
					offset.x = range.right;
					velocity.x *= bounce ? -reaction : 0;
				}
			}

			if (range.top !== undefined && offset.y <= range.top) {
				if (stretch) {
					velocity.y = (range.top - offset.y) * elasticity;
				} else {
					offset.y = range.top;
					velocity.y *= bounce ? -reaction : 0;
				}
			}
			else if (range.bottom !== undefined && offset.y >= range.bottom) {
				if (stretch) {
					velocity.y = (range.bottom - offset.y) * elasticity;
				} else {
					offset.y = range.bottom;
					velocity.y *= bounce ? -reaction : 0;
				}
			}

			update();

			if (running && moving) requestNewFrame(step);
		}

		this.stop();
		update();
		this.start();
	}

	function getDocumentHead() {
		return document.head || document.getElementsByTagName('head')[0];
	}

	function isMobile() {
		return /iPad|iPhone|iPod|Android|Linux arm|BlackBerry|WinCE|Pocket/i.test(navigator.platform);
	}

	function init() {
		var length;

		var head = getDocumentHead();
		var styles = head.getElementsByTagName('style');
		var style;
		length = styles.length;
		if (length) {
			style = styles[length - 1];
			style.innerHTML = style.innerHTML + '\n\n' + styleClassDefinition;
		} else {
			style = document.createElement('style');
			style.innerHTML = styleClassDefinition;
			head.appendChild(style);
		}

		if (!isMobile()) {
			var elements = document.querySelectorAll(styleClassName);
			length = elements.length;
			var i, element;
			for (i = 0; i < length; i++) {
				element = elements[i];
				element.momentum = new Momentum({element: element});
			}
		}
	}

	// Requires Internet Explorer 9.0+, all other browsers and versions supported
	document.addEventListener('DOMContentLoaded', init);

	return Momentum;
}));

// TODO: Don't change cursor, if element does not scroll
