import React from 'react';
import { ProgressiveImage } from './ProgressiveImage';

export default class Pig extends React.Component {
  constructor(props) {
    super(props);
    this.state = { imageData: props.imageData };

    /**
     * Creates an instance of the progressive image grid, inserting boilerplate
     * CSS and loading image data. Instantiating an instance of the Pig class
     * does not cause any images to appear however. After instantiating, call the
     * `enable()` function on the returned instance:
     *
     *   var pig = new Pig(imageData, opts);
     *   pig.enable();
     *
     * @param {array} imageData - An array of metadata about each image to
     *                            include in the grid.
     * @param {string} imageData[0].filename - The filename of the image.
     * @param {string} imageData[0].aspectRatio - The aspect ratio of the image.
     * @param {object} options - An object containing overrides for the default
     *                           options. See below for the full list of options
     *                           and defaults.
     *
     * @returns {object} The Pig instance.
     */
    // Global State
    this.inRAF = false;
    this.isTransitioning = false;
    this.minAspectRatioRequiresTransition = false;
    this.minAspectRatio = null;
    this.latestYOffset = 0;
    this.lastWindowWidth = window.innerWidth;
    this.scrollDirection = 'down';

    // List of images that are loading or completely loaded on screen.
    this.visibleImages = [];

    // These are the default settings, which may be overridden.
    this.settings = {

      /**
       * Type: string
       * Default: 'pig'
       * Description: The class name of the element inside of which images should
       *   be loaded.
       */
      containerId: 'pig',

      /**
       * Type: string
       * Default: 'pig'
       * Description: The prefix associated with this library that should be
       *   prepended to class names within the grid.
       */
      classPrefix: 'pig',

      /**
       * Type: string
       * Default: 'figure'
       * Description: The tag name to use for each figure. The default setting is
       *   to use a <figure></figure> tag.
       */
      figureTagName: 'figure',

      /**
       * Type: Number
       * Default: 8
       * Description: Size in pixels of the gap between images in the grid.
       */
      spaceBetweenImages: 8,

      /**
       * Type: Number
       * Default: 500
       * Description: Transition speed in milliseconds
       */
      transitionSpeed: 500,

      /**
       * Type: Number
       * Default: 3000
       * Description: Height in pixels of images to preload in the direction
       *   that the user is scrolling. For example, in the default case, if the
       *   user is scrolling down, 1000px worth of images will be loaded below
       *   the viewport.
       */
      primaryImageBufferHeight: 1000,

      /**
       * Type: Number
       * Default: 100
       * Description: Height in pixels of images to preload in the direction
       *   that the user is NOT scrolling. For example, in the default case, if
       *   the user is scrolling down, 300px worth of images will be loaded
       *   above the viewport.  Images further up will be removed.
       */
      secondaryImageBufferHeight: 300,

      /**
       * Type: Number
       * Default: 20
       * Description: The height in pixels of the thumbnail that should be
       *   loaded and blurred to give the effect that images are loading out of
       *   focus and then coming into focus.
       */
      thumbnailSize: 20,

      /**
       * Get the URL for an image with the given filename & size.
       *
       * @param {string} filename - The filename of the image.
       * @param {Number} size - The size (height in pixels) of the image.
       *
       * @returns {string} The URL of the image at the given size.
       */
      urlForSize: function(filename, size) {
        return '/img/' + size + '/' + filename;
      },

      onClick: function(elem) {},

      /**
       * Get the minimum required aspect ratio for a valid row of images. The
       * perfect rows are maintained by building up a row of images by adding
       * together their aspect ratios (the aspect ratio when they are placed
       * next to each other) until that aspect ratio exceeds the value returned
       * by this function. Responsive reordering is achieved through changes
       * to what this function returns at different values of the passed
       * parameter `lastWindowWidth`.
       *
       * @param {Number} lastWindowWidth - The last computed width of the
       *                                   browser window.
       *
       * @returns {Number} The minimum aspect ratio at this window width.
       */
      getMinAspectRatio: function(lastWindowWidth) {
        if (lastWindowWidth <= 640)
          return 2;
        else if (lastWindowWidth <= 1280)
          return 4;
        else if (lastWindowWidth <= 1920)
          return 5;
        return 6;
      },

      /**
       * Get the image size (height in pixels) to use for this window width.
       * Responsive resizing of images is achieved through changes to what this
       * function returns at different values of the passed parameter
       * `lastWindowWidth`.
       *
       * @param {Number} lastWindowWidth - The last computed width of the
       *                                   browser window.
       *
       * @returns {Number} The size (height in pixels) of the images to load.
       */
      getImageSize: function(lastWindowWidth) {
        if (lastWindowWidth <= 640)
          return 100;
        else if (lastWindowWidth <= 1920)
          return 250;
        return 500;
      }
    };

    // We extend the default settings with the provided overrides.
    Object.assign(this.settings, this.props.options || {});

    if(this.state.imageData) {
      // Find the container to load images into, if it exists.
      this.container = document.getElementById(this.settings.containerId);
      if (!this.container) {
        console.error('Could not find element with ID ' + this.settings.containerId);
      }

      // Our global reference for images in the grid.  Note that not all of these
      // images are necessarily in view or loaded.
      this.images = this._parseImageData(this.state.imageData);

      // Inject our boilerplate CSS.
      this._injectStyle(this.settings.containerId, this.settings.classPrefix, this.settings.transitionSpeed);

      // if(!this.state.disable) {
        this.onScroll = this._getOnScroll();
        window.addEventListener('scroll', this.onScroll);

        this.onScroll();
        this._computeLayout();
        this._doLayout();

        this.optimizedResize().add(function() {
          this.lastWindowWidth = window.innerWidth;
          this._computeLayout();
          this._doLayout();
        }.bind(this));
      // }
    }
  }

  render() {
    return(null)
  }

  /**
   * This is a manager for our resize handlers. You can add a callback, disable
   * all resize handlers, and re-enable handlers after they have been disabled.
   *
   * optimizedResize is adapted from Mozilla code:
   * https://developer.mozilla.org/en-US/docs/Web/Events/resize
   */
  optimizedResize() {
    var callbacks = [];
    var running = false;

    // fired on resize event
    function resize() {
      if (!running) {
        running = true;
        if (window.requestAnimationFrame) {
          window.requestAnimationFrame(runCallbacks);
        } else {
          setTimeout(runCallbacks, 66);
        }
      }
    }

    // run the actual callbacks
    function runCallbacks() {
      callbacks.forEach(function(callback) {
        callback();
      });

      running = false;
    }

    return {
      /**
       * Add a callback to be run on resize.
       *
       * @param {function} callback - the callback to run on resize.
       */
      add: function(callback) {
        if (!callbacks.length) {
          window.addEventListener('resize', resize);
        }

        callbacks.push(callback);
      },

      /**
       * Disables all resize handlers.
       */
      disable: function() {
        window.removeEventListener('resize', resize);
      },

      /**
       * Enables all resize handlers, if they were disabled.
       */
      reEnable: function() {
        window.addEventListener('resize', resize);
      },
    };
  };

  /**
   * Returns the distance from `elem` to the top of the page. This is done by
   * walking up the node tree, getting the offsetTop of each parent node, until
   * the top of the page.
   *
   * @param {object} elem - The element to compute the offset of.
   **/
  _getOffsetTop(elem){
    var offsetTop = 0;
    do {
      if (!isNaN(elem.offsetTop)){
        offsetTop += elem.offsetTop;
      }
      elem = elem.offsetParent;
    } while(elem);
    return offsetTop;
  }

  /**
   * Inject CSS needed to make the grid work in the <head></head>.
   *
   * @param {string} classPrefix - the prefix associated with this library that
   *                               should be prepended to classnames.
   * @param {string} containerId - ID of the container for the images.
   */
  _injectStyle(containerId, classPrefix, transitionSpeed) {

    var css = (
      '#' + containerId + ' {' +
      '  position: relative;' +
      '}' +
      '.' + classPrefix + '-figure {' +
      '  background-color: #D5D5D5;' +
      '  overflow: hidden;' +
      '  left: 0;' +
      '  position: absolute;' +
      '  top: 0;' +
      '  margin: 0;' +
      '}' +
      '.' + classPrefix + '-figure img {' +
      '  left: 0;' +
      '  position: absolute;' +
      '  top: 0;' +
      '  height: 100%;' +
      '  opacity: 0;' +
      '  transition: ' + (transitionSpeed / 1000) + 's ease opacity;' +
      '  -webkit-transition: ' + (transitionSpeed / 1000) + 's ease opacity;' +
      '}' +
      '.' + classPrefix + '-figure img.' + classPrefix + '-thumbnail {' +
      '  -webkit-filter: blur(30px);' +
      '  filter: blur(30px);' +
      '  left: auto;' +
      '  position: relative;' +
      '  width: auto;' +
      '}' +
      '.' + classPrefix + '-figure img.' + classPrefix + '-loaded {' +
      '  opacity: 1;' +
      '}'
    );

    var head = document.head || document.getElementsByTagName("head")[0];
    var style = document.createElement("style");

    style.type = "text/css";
    if (style.styleSheet) {
      style.styleSheet.cssText = css;
    } else {
      style.appendChild(document.createTextNode(css));
    }

    head.appendChild(style);
  }

  /**
   * Update the DOM to reflect the style values of each image in the PIG,
   * adding or removing images appropriately.
   *
   * PIG ensures that there are not too many images loaded into the DOM at once
   * by maintaining a buffer region around the viewport in which images are
   * allowed, removing all images below and above. Because all of our layout
   * is computed using CSS transforms, removing an image above the buffer will
   * not cause the gird to reshuffle.
   *
   * The primary buffer is the buffer in the direction of the user's scrolling.
   * (Below if they are scrolling down, above if they are scrolling up.) The
   * size of this buffer determines the experience of scrolling down the page.
   *
   * The secondary buffer is the buffer in the opposite direction of the user's
   * scrolling.  The size of this buffer determines the experience of changing
   * scroll directions. (Too small, and we have to reload a ton of images above
   * the viewport if the user changes scroll directions.)
   *
   * While the entire grid has been computed, only images within the viewport,
   * the primary buffer, and the secondary buffer will exist in the DOM.
   *
   *
   *             Illustration: the primary and secondary buffers
   *
   *
   * +---------------------------+
   * |                           |
   * |                           |
   * |                           |
   * |                           |
   * + - - - - - - - - - - - - - +                   -------
   * |                           |                      A
   * |     Secondary Buffer      |   this.setting.secondaryImageBufferHeight
   * |                           |                      V
   * +---------------------------+                   -------
   * |                           |                      A
   * |                           |                      |
   * |                           |                      |
   * |        Viewport           |              window.innerHeight
   * |                           |                      |
   * |                           |                      |
   * |                           |                      V
   * +---------------------------+                   -------
   * |                           |                      A
   * |                           |                      |
   * |                           |                      |
   * |                           |                      |
   * |      Primary Buffer       |    this.settings.primaryImageBufferHeight
   * |                           |                      |
   * |                           |                      |
   * |                           |                      |
   * |                           |                      V
   * + - - - - - - - - - - - - - +                   -------
   * |                           |
   * |    (Scroll direction)     |
   * |            |              |
   * |            |              |
   * |            V              |
   * |                           |
   *
   */
  _doLayout() {
    // Set the container height
    this.container.style.height = this.totalHeight + 'px';

    // Get the top and bottom buffers heights.
    var bufferTop =
      (this.scrollDirection === 'up') ?
      this.settings.primaryImageBufferHeight :
      this.settings.secondaryImageBufferHeight;
    var bufferBottom =
      (this.scrollDirection === 'down') ?
      this.settings.secondaryImageBufferHeight :
      this.settings.primaryImageBufferHeight;

    // Now we compute the location of the top and bottom buffers:
    var containerOffset = this._getOffsetTop(this.container);
    var windowHeight = window.innerHeight;

    // This is the top of the top buffer. If the bottom of an image is above
    // this line, it will be removed.
    var minTranslateYPlusHeight = this.latestYOffset - containerOffset - bufferTop;

    // This is the bottom of the bottom buffer.  If the top of an image is
    // below this line, it will be removed.
    var maxTranslateY = this.latestYOffset + windowHeight + bufferBottom;

    // Here, we loop over every image, determine if it is inside our buffers or
    // no, and either insert it or remove it appropriately.
    this.images.forEach(function(image) {

      if (image.style.translateY + image.style.height < minTranslateYPlusHeight ||
        image.style.translateY > maxTranslateY) {
        // Hide Image
        image.hide();
      } else {
        // Load Image
        image.load();
      }
    });
  }

  /**
   * Create our onScroll handler and return it.
   *
   * @returns {function} Our optimized onScroll handler.
   */
  _getOnScroll() {
    var _this = this;

    /**
     * This function is called on scroll. It computes variables about the page
     * position and scroll direction, and then calls a _doLayout guarded by a
     * window.requestAnimationFrame.
     *
     * We use the boolean variable _this.inRAF to ensure that we don't overload
     * the number of layouts we perform by starting another layout while we are
     * in the middle of doing one.
     *
     * @returns {function} The onScroll handler that we should attach.
     */
    var onScroll = function() {
      // Compute the scroll direction using the latestYOffset and the
      // previousYOffset
      var newYOffset = window.pageYOffset;
      _this.previousYOffset = _this.latestYOffset || newYOffset;
      _this.latestYOffset = newYOffset;
      _this.scrollDirection = (_this.latestYOffset > _this.previousYOffset) ? 'down' : 'up';

      // Call _this.doLayout, guarded by window.requestAnimationFrame
      if (!_this.inRAF) {
        _this.inRAF = true;
        window.requestAnimationFrame(function() {
          _this._doLayout();
          _this.inRAF = false;
        });
      }
    };

    return onScroll;
  }

  /**
   * Because we may be transitioning a very large number of elements on a
   * resize, and because we cannot reliably determine when all elements are
   * done transitioning, we have to approximate the amount of time it will take
   * for the browser to be expected to complete with a transition. This
   * constant gives the scale factor to apply to the given transition time. For
   * example, if transitionTimeoutScaleFactor is 1.5 and transition speed is
   * given as 500ms, we will wait 750ms before assuming that we are actually
   * done resizing.
   *
   * @returns {Number} Time in milliseconds before we can consider a resize to
   *   have been completed.
   */
  _getTransitionTimeout() {
    var transitionTimeoutScaleFactor = 1.5;
    return this.settings.transitionSpeed * transitionTimeoutScaleFactor;
  };

  /**
   * Gives the CSS property string to set for the transition value, depending
   * on whether or not we are transitioning.
   *
   * @returns {string} a value for the `transition` CSS property.
   */
  _getTransitionString() {
    if (this.isTransitioning) {
      return (this.settings.transitionSpeed / 1000) + 's transform ease';
    }

    return 'none';
  };

  /**
   * Computes the current value for `this.minAspectRatio`, using the
   * `getMinAspectRatio` function defined in the settings. Then,
   * `this.minAspectRatioRequiresTransition` will be set, depending on whether
   * or not the value of this.minAspectRatio has changed.
   */
  _recomputeMinAspectRatio() {
    var oldMinAspectRatio = this.minAspectRatio;
    this.minAspectRatio = this.settings.getMinAspectRatio(this.lastWindowWidth);

    if (oldMinAspectRatio !== null && oldMinAspectRatio !== this.minAspectRatio)
      this.minAspectRatioRequiresTransition = true;
    else
      this.minAspectRatioRequiresTransition = false;
  };

  /**
   * Creates new instances of the ProgressiveImage class for each of the images
   * defined in `imageData`.
   *
   * @param {array} imageData - An array of metadata about each image to
   *                            include in the grid.
   * @param {string} imageData[0].filename - The filename of the image.
   * @param {string} imageData[0].aspectRatio - The aspect ratio of the image.
   *
   * @returns {Array[ProgressiveImage]} - An array of ProgressiveImage
   *                                      instances that we created.
   */
  _parseImageData(imageData) {
    var progressiveImages = [];

    this.state.imageData.forEach(function(image, index) {
      var progressiveImage = new ProgressiveImage(image, index, this);
      progressiveImages.push(progressiveImage);
    }.bind(this));

    return progressiveImages;
  };

  /**
   * Remove all scroll and resize listeners.
   *
   * @returns {object} The Pig instance.
   */
  disable() {
    window.removeEventListener('scroll', this.onScroll);
    this.optimizedResize().disable();
    return this;
  }

  /**
   * This computes the layout of the entire grid, setting the height, width,
   * translateX, translateY, and transtion values for each ProgessiveImage in
   * `this.images`. These styles are set on the ProgressiveImage.style property,
   * but are not set on the DOM.
   *
   * This separation of concerns (computing layout and DOM manipulation) is
   * paramount to the performance of the PIG. While we need to manipulate the
   * DOM every time we scroll (adding or remove images, etc.), we only need to
   * compute the layout of the PIG on load and on resize. Therefore, this
   * function will compute the entire grid layout but will not manipulate the
   * DOM at all.
   *
   * All DOM manipulation occurs in `_doLayout`.
   */
  _computeLayout() {
    // Constants
    var wrapperWidth = parseInt(this.container.clientWidth, 10);

    // State
    var row = [];           // The list of images in the current row.
    var translateX = 0;     // The current translateX value that we are at
    var translateY = 0;     // The current translateY value that we are at
    var rowAspectRatio = 0; // The aspect ratio of the row we are building

    // Compute the minimum aspect ratio that should be applied to the rows.
    this._recomputeMinAspectRatio();

    // If we are not currently transitioning, and our minAspectRatio has just
    // changed, then we mark isTransitioning true. If this is the case, then
    // `this._getTransitionString()` will ensure that each image has a value
    // like "0.5s ease all". This will cause images to animate as they change
    // position. (They need to change position because the minAspectRatio has
    // changed.) Once we determine that the transtion is probably over (using
    // `this._getTransitionTimeout`) we unset `this.isTransitioning`, so that
    // future calls to `_computeLayout` will set "transition: none".
    if (!this.isTransitioning && this.minAspectRatioRequiresTransition) {
      this.isTransitioning = true;
      setTimeout(function() {
        this.isTransitioning = false;
      }, this._getTransitionTimeout());
    }

    // Get the valid-CSS transition string.
    var transition = this._getTransitionString();

    // Loop through all our images, building them up into rows and computing
    // the working rowAspectRatio.
    [].forEach.call(this.images, function(image, index) {
      rowAspectRatio += parseFloat(image.aspectRatio);
      row.push(image);

      // When the rowAspectRatio exceeeds the minimum acceptable aspect ratio,
      // or when we're out of images, we say that we have all the images we
      // need for this row, and compute the style values for each of these
      // images.
      if (rowAspectRatio >= this.minAspectRatio || index + 1 === this.images.length) {

        // Compute this row's height.
        var totalDesiredWidthOfImages = wrapperWidth - this.settings.spaceBetweenImages * (row.length - 1);
        var rowHeight = totalDesiredWidthOfImages / rowAspectRatio;

        // For each image in the row, compute the width, height, translateX,
        // and translateY values, and set them (and the transition value we
        // found above) on each image.
        //
        // NOTE: This does not manipulate the DOM, rather it just sets the
        //       style values on the ProgressiveImage instance. The DOM nodes
        //       will be updated in _doLayout.
        row.forEach(function(img) {

          var imageWidth = rowHeight * img.aspectRatio;

          // This is NOT DOM manipulation.
          img.style = {
            width: parseInt(imageWidth, 10),
            height: parseInt(rowHeight, 10),
            translateX: translateX,
            translateY: translateY,
            transition: transition,
          };

          // The next image is this.settings.spaceBetweenImages pixels to the
          // right of this image.
          translateX += imageWidth + this.settings.spaceBetweenImages;

        }.bind(this));

        // Reset our state variables for next row.
        row = [];
        rowAspectRatio = 0;
        translateY += parseInt(rowHeight, 10) + this.settings.spaceBetweenImages;
        translateX = 0;
      }
    }.bind(this));

    // No space below the last image
    this.totalHeight = translateY - this.settings.spaceBetweenImages;
  }
}
